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

// Vaste lijst i.p.v. vrije tekst, om te voorkomen dat dezelfde afdeling
// op meerdere manieren getypt wordt (nodig om straks betrouwbaar op te
// kunnen filteren). Aangeleverd door Wouter.
const ALLOWED_AFDELINGEN = [
  "Business Development",
  "Cybersecurity",
  "Directory",
  "Energy & Wholesale",
  "Facility",
  "Finance",
  "HR",
  "Legal",
  "Management",
  "Marketing",
  "Office Management",
  "Operations",
  "Project Management",
  "Public Affairs",
  "QHSE",
  "Sales",
  "Sustainability Advisory"
];

// Locatie is bewust niet alleen een vaste kantorenlijst: sommige functies
// (bv. servicemonteur) zijn regiogebonden i.p.v. aan 1 kantoor. Daarom
// staan de 5 echte kantoren en 1 generieke "reizend"-optie naast elkaar
// in dezelfde lijst, i.p.v. een los "regio"-veld erbij te verzinnen.
// Stad + land gecombineerd (i.p.v. alleen de stad), zodat in 1 oogopslag
// duidelijk is om welk land het gaat.
const ALLOWED_LOCATIES = [
  "Heerenveen, Netherlands",
  "Rousset, France",
  "Emstek, Germany",
  "Parma, Italy",
  "Göteborg, Sweden",
  "Nederland (reizend)"
];

// Voor de JobPosting-structured-data (generate.js): landcode per locatie,
// zodat addressCountry klopt ongeacht welk kantoor het is (voorheen
// stond dit altijd hardcoded op "NL").
const LOCATIE_LANDCODE = {
  "Heerenveen, Netherlands": "NL",
  "Rousset, France": "FR",
  "Emstek, Germany": "DE",
  "Parma, Italy": "IT",
  "Göteborg, Sweden": "SE",
  "Nederland (reizend)": "NL"
};

// Los, optioneel veld naast locatie: voor regiogebonden functies (bv.
// servicemonteur) is "Nederland (reizend)" als locatie niet specifiek
// genoeg. Werkgebied laat zien in welk deel van het land iemand vooral
// werkt, ongeacht welke locatie (kantoor of "reizend") is gekozen.
const ALLOWED_WERKGEBIEDEN = [
  "Noord",
  "Oost",
  "Zuid",
  "West",
  "Midden"
];

// Werkgebied komt vaak in combinatie voor (bv. "Zuid/West"), dus is dit
// geen vaste lijst van losse waarden maar een combinatie van 1 of meer
// windrichtingen uit ALLOWED_WERKGEBIEDEN, met "/" gescheiden. Altijd in
// de vaste volgorde hierboven opgeslagen (canoniseerWerkgebied), zodat
// "Zuid/West" en "West/Zuid" niet als 2 verschillende waarden gaan
// filteren.
function canoniseerWerkgebied(waarden) {
  const unieke = [...new Set(waarden)];
  return ALLOWED_WERKGEBIEDEN.filter(optie => unieke.includes(optie)).join("/");
}

function isGeldigWerkgebied(waarde) {
  if (!waarde) return true;
  const delen = waarde.split("/");
  return delen.length === new Set(delen).size && delen.every(deel => ALLOWED_WERKGEBIEDEN.includes(deel));
}

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
  workArea: "werkgebied",
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

  // Werkgebied mag als array van losse windrichtingen binnenkomen (bv.
  // vanuit checkboxes in het beheerformulier): dan hier samenvoegen tot
  // de canonieke "/"-gescheiden string i.p.v. bij elke aanroeper apart.
  if (Array.isArray(genormaliseerd.workArea)) {
    genormaliseerd.workArea = canoniseerWerkgebied(genormaliseerd.workArea);
  }

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
    workArea: vacature.workArea || "",
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
    workArea: leesEntityVeld(entity, "workArea") || "",
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
  dto.werkgebied = dto.workArea;
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
  ALLOWED_AFDELINGEN,
  ALLOWED_LOCATIES,
  ALLOWED_WERKGEBIEDEN,
  LOCATIE_LANDCODE,
  ONDERSTEUNDE_TALEN,
  isGeldigWerkgebied,
  getVacaturesTableClient,
  normalizeVacatureInput,
  toEntity,
  toVacatureDto
};
