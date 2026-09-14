const { TableClient } = require("@azure/data-tables");

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const TABLE_NAME = "Vacatures";

// Eén vaste PartitionKey: het aantal vacatures is klein genoeg om in 1
// partitie te passen, en dat maakt "alle vacatures ophalen" een simpele
// query zonder over partities heen te hoeven zoeken.
const PARTITION_KEY = "vacature";

const ALLOWED_STATUSSEN = [
  "concept",
  "ingepland",
  "gepubliceerd",
  "gesloten",
  "gearchiveerd"
];

// Meertaligheid: EN is de verplichte basistaal, de rest is optioneel per
// vacature. "se" (niet de ISO-code "sv") is bewust gekozen voor
// consistentie met de corporate website.
const ONDERSTEUNDE_TALEN = ["en", "nl", "fr", "de", "it", "se"];

// Deze module zet het datamodel om naar het Engels (title, department,
// location, ...). Het bestaande beheerformulier en generate.js sturen en
// verwachten nog de oude Nederlandse veldnamen (titel, afdeling, locatie,
// ...) — die worden pas in een latere stap omgezet. VELD_ALIASSEN koppelt
// elk Engels veld aan zijn oude Nederlandse naam, zodat we in de
// tussentijd niets breken:
// - normalizeVacatureInput() accepteert binnenkomende input in beide talen
// - toVacatureDto() geeft de output in beide talen terug (Engels
//   canonical, Nederlands als alias)
const VELD_ALIASSEN = {
  department: "afdeling",
  location: "locatie",
  employmentType: "dienstverband",
  salaryMin: "salarisMin",
  salaryMax: "salarisMax",
  salaryNegotiable: "salarisInOverleg",
  educationLevel: "opleidingsniveau",
  closingDate: "sluitingsdatum",
  publicationDate: "publicatiedatum"
};

let tableClientPromise;

// Eén gedeelde TableClient. createTable() gooit geen fout als de tabel al
// bestaat, dus dit kan bij elke aanroep herhaald worden.
function getVacaturesTableClient() {
  if (!tableClientPromise) {
    tableClientPromise = (async () => {
      // Alleen bij een lokale Azurite-emulator (http://) is deze vlag
      // nodig, echte Azure Storage-verbindingsstrings zijn altijd https.
      const isLocalEmulator = CONNECTION_STRING && CONNECTION_STRING.includes("http://");
      const client = TableClient.fromConnectionString(
        CONNECTION_STRING,
        TABLE_NAME,
        isLocalEmulator ? { allowInsecureConnection: true } : undefined
      );
      await client.createTable();
      return client;
    })().catch(error => {
      // Niet een mislukte poging permanent laten "vastzitten" voor de
      // levensduur van deze Function-instance, zie mediaContainer.js.
      tableClientPromise = null;
      throw error;
    });
  }
  return tableClientPromise;
}

// Leest een veld van een ruwe Table Storage entity, met terugval op de
// oude Nederlandse kolomnaam voor rijen die van vóór deze omzetting
// dateren (die hebben geen Engelse kolom, alleen de oude).
function leesEntityVeld(entity, engelsVeld) {
  if (entity[engelsVeld] !== undefined) return entity[engelsVeld];
  return entity[VELD_ALIASSEN[engelsVeld]];
}

// Normaliseert binnenkomende input (van de Functions-aanroeper) naar het
// canonieke Engelse datamodel. Accepteert zowel de nieuwe Engelse
// veldnamen als (tijdelijk) de oude Nederlandse, en zowel een
// meertalig `translations`-object als de oude platte `titel`/`bodyBlokken`
// (die dan impliciet als de EN-vertaling worden behandeld). Geeft alleen
// de velden terug die daadwerkelijk in de input aanwezig waren, zodat dit
// ook veilig is voor een partiële update (VacatureUpdate).
function normalizeVacatureInput(input) {
  const genormaliseerd = {};

  for (const [engelsVeld, nlVeld] of Object.entries(VELD_ALIASSEN)) {
    if (input[engelsVeld] !== undefined) genormaliseerd[engelsVeld] = input[engelsVeld];
    else if (input[nlVeld] !== undefined) genormaliseerd[engelsVeld] = input[nlVeld];
  }
  if (input.status !== undefined) genormaliseerd.status = input.status;
  if (input.header !== undefined) genormaliseerd.header = input.header;

  if (input.translations !== undefined) {
    genormaliseerd.translations = input.translations;
  } else if (
    input.title !== undefined || input.titel !== undefined ||
    input.bodyBlocks !== undefined || input.bodyBlokken !== undefined
  ) {
    // Oude platte input (huidig beheerformulier, kent nog geen talen):
    // impliciet de EN-vertaling.
    genormaliseerd.translations = {
      en: {
        title: input.title ?? input.titel ?? "",
        bodyBlocks: input.bodyBlocks ?? input.bodyBlokken ?? []
      }
    };
  }

  return genormaliseerd;
}

// Zet een vacature (al genormaliseerd + eventueel samengevoegd met de
// bestaande vacature bij een update) om naar een Table Storage entity.
// Geneste structuren (header, translations) kunnen niet als zodanig in
// Table Storage, dus die gaan er als JSON-tekst in.
function toEntity(id, vacature, { createdAt, updatedAt }) {
  const translations = vacature.translations || {};
  const enVertaling = translations.en || {};

  return {
    partitionKey: PARTITION_KEY,
    rowKey: id,
    title: enVertaling.title || "",
    department: vacature.department || "",
    location: vacature.location || "",
    employmentType: vacature.employmentType || "",
    salaryMin: vacature.salaryMin ?? null,
    salaryMax: vacature.salaryMax ?? null,
    salaryNegotiable: Boolean(vacature.salaryNegotiable),
    educationLevel: vacature.educationLevel || "",
    closingDate: vacature.closingDate || "",
    publicationDate: vacature.publicationDate || "",
    status: vacature.status || "concept",
    headerJson: JSON.stringify(vacature.header || null),
    translationsJson: JSON.stringify(translations),
    createdAt,
    updatedAt
  };
}

// En omgekeerd: van Table Storage entity terug naar een vacature-object.
// Geeft zowel de nieuwe Engelse velden als (tijdelijk) de oude
// Nederlandse aliassen terug, zie VELD_ALIASSEN hierboven.
function toVacatureDto(entity) {
  let translations;
  if (entity.translationsJson !== undefined) {
    translations = JSON.parse(entity.translationsJson || "{}");
  } else {
    // Rij van vóór de meertaligheid-omzetting: geen translations-kolom,
    // wel de oude platte titel/bodyBlokken. Hieruit translations.en
    // synthetiseren, zodat bestaande vacatures zonder aparte migratie
    // blijven werken.
    translations = {
      en: {
        title: entity.title ?? entity.titel ?? "",
        bodyBlocks: JSON.parse(entity.bodyBlokkenJson || "[]")
      }
    };
  }
  const enVertaling = translations.en || {};

  const dto = {
    id: entity.rowKey,
    title: enVertaling.title || entity.title || entity.titel || "",
    department: leesEntityVeld(entity, "department") || "",
    location: leesEntityVeld(entity, "location") || "",
    employmentType: leesEntityVeld(entity, "employmentType") || "",
    salaryMin: leesEntityVeld(entity, "salaryMin") ?? null,
    salaryMax: leesEntityVeld(entity, "salaryMax") ?? null,
    salaryNegotiable: Boolean(leesEntityVeld(entity, "salaryNegotiable")),
    educationLevel: leesEntityVeld(entity, "educationLevel") || "",
    closingDate: leesEntityVeld(entity, "closingDate") || "",
    publicationDate: leesEntityVeld(entity, "publicationDate") || "",
    status: entity.status,
    header: JSON.parse(entity.headerJson || "null"),
    translations,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  };

  // Tijdelijke Nederlandse aliassen, alleen nodig zolang het huidige
  // beheerformulier en generate.js nog niet meertalig zijn (stap 3-6 uit
  // de meertaligheid-spec). Verwijderen zodra die zijn omgezet.
  dto.titel = dto.title;
  dto.afdeling = dto.department;
  dto.locatie = dto.location;
  dto.dienstverband = dto.employmentType;
  dto.salarisMin = dto.salaryMin;
  dto.salarisMax = dto.salaryMax;
  dto.salarisInOverleg = dto.salaryNegotiable;
  dto.opleidingsniveau = dto.educationLevel;
  dto.sluitingsdatum = dto.closingDate;
  dto.publicatiedatum = dto.publicationDate;
  dto.bodyBlokken = enVertaling.bodyBlocks || [];

  return dto;
}

module.exports = {
  PARTITION_KEY,
  ALLOWED_STATUSSEN,
  ONDERSTEUNDE_TALEN,
  getVacaturesTableClient,
  normalizeVacatureInput,
  toEntity,
  toVacatureDto
};
