const { TableClient } = require("@azure/data-tables");

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const TABLE_NAME = "Sollicitaties";

// Zelfde aanpak als vacaturesTable.js: 1 vaste PartitionKey, het aantal
// sollicitaties is klein genoeg om in 1 partitie te passen.
const PARTITION_KEY = "sollicitatie";

// Fases in vaste volgorde (het sollicitatieproces zoals dat in het
// beheerportaal doorlopen wordt), plus 2 exit-statussen die vanuit elke
// fase bereikbaar zijn (geen vaste "volgende stap" in de lijn).
const ALLOWED_STATUSSEN = [
  "nieuw",
  "screening",
  "eerste_gesprek",
  "tweede_gesprek",
  "aanbod",
  "aangenomen",
  "afgewezen",
  "ingetrokken"
];

// De 6 fases die het kanban-bord als kolom toont, in vaste volgorde. De
// 2 exit-statussen (laatste 2 van ALLOWED_STATUSSEN) zijn bewust geen
// bordkolom: die zijn een actie vanuit elke fase, geen vaste volgende
// stap in de lijn (zie beheer/sollicitaties.html).
const BORD_FASES = ALLOWED_STATUSSEN.slice(0, 6);
const EXIT_STATUSSEN = ALLOWED_STATUSSEN.slice(6);

let tableClientPromise;

function getSollicitatiesTableClient() {
  if (!tableClientPromise) {
    tableClientPromise = (async () => {
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

// vacatureTitel wordt gedenormaliseerd opgeslagen (op het moment van
// solliciteren), zodat het beheeroverzicht die kan tonen zonder voor elke
// rij de bijbehorende vacature te moeten opzoeken (die kan intussen ook
// verwijderd zijn).
//
// statusHistory is de audit trail achter het losse "status"-veld: elke
// wijziging (ook de allereerste, bij het indienen) is 1 entry met
// from/to/timestamp/user. Table Storage kent geen geneste arrays, dus
// net als bij vacatures' "translationsJson" wordt dit als JSON-string
// opgeslagen ("statusHistoryJson").
// toegevoegdDoor is alleen gezet als HR deze sollicitatie zelf heeft
// aangemaakt (zie SollicitatieCreateIntern, voor kandidaten die buiten
// het publieke formulier om binnenkomen); bij een normale sollicitatie
// blijft dit leeg en is de audit trail-gebruiker gewoon "kandidaat".
function toEntity(id, sollicitatie, { ingediendOp, toegevoegdDoor }) {
  const status = sollicitatie.status || "nieuw";
  return {
    partitionKey: PARTITION_KEY,
    rowKey: id,
    vacatureId: sollicitatie.vacatureId || "",
    vacatureTitel: sollicitatie.vacatureTitel || "",
    voornaam: sollicitatie.voornaam || "",
    achternaam: sollicitatie.achternaam || "",
    email: sollicitatie.email || "",
    telefoon: sollicitatie.telefoon || "",
    motivatie: sollicitatie.motivatie || "",
    cvNaam: sollicitatie.cvNaam || "",
    cvOorspronkelijkeNaam: sollicitatie.cvOorspronkelijkeNaam || "",
    motivatiebriefNaam: sollicitatie.motivatiebriefNaam || "",
    motivatiebriefOorspronkelijkeNaam: sollicitatie.motivatiebriefOorspronkelijkeNaam || "",
    status,
    statusHistoryJson: JSON.stringify([
      { from: null, to: status, timestamp: ingediendOp, user: toegevoegdDoor || "kandidaat" }
    ]),
    notities: "",
    handmatigToegevoegdDoor: toegevoegdDoor || "",
    ingediendOp
  };
}

// Voegt 1 entry toe aan de bestaande statusHistory van een entity, en
// geeft de nieuwe "statusHistoryJson"-waarde terug (nog niet opgeslagen).
// Een entity van vóór deze wijziging heeft nog geen statusHistoryJson —
// valt dan terug op een lege lijst, geen migratiescript nodig.
function metNieuweStatusHistory(entity, { van, naar, gebruiker }) {
  const bestaandeHistory = JSON.parse(entity.statusHistoryJson || "[]");
  const nieuweHistory = [
    ...bestaandeHistory,
    { from: van, to: naar, timestamp: new Date().toISOString(), user: gebruiker }
  ];
  return JSON.stringify(nieuweHistory);
}

// Zelfde aanpak als metNieuweStatusHistory, maar voor het gesprek tussen
// HR en afdelingshoofden over deze kandidaat ("inlezen op een kandidaat,
// maar ook reactie achterlaten na een gesprek"). Bewust een apart veld,
// niet toegevoegd aan HR's eigen "notities": die blijft HR-only. rol is
// "hr" of "afdelingshoofd", zodat de chatlog de 2 kanten kan onderscheiden.
function metNieuweReactie(entity, { tekst, auteur, rol }) {
  const bestaandeReacties = JSON.parse(entity.reactiesJson || "[]");
  const nieuweReacties = [
    ...bestaandeReacties,
    { tekst, auteur, rol, timestamp: new Date().toISOString() }
  ];
  return JSON.stringify(nieuweReacties);
}

function toSollicitatieDto(entity) {
  return {
    id: entity.rowKey,
    vacatureId: entity.vacatureId,
    vacatureTitel: entity.vacatureTitel,
    voornaam: entity.voornaam,
    achternaam: entity.achternaam,
    email: entity.email,
    telefoon: entity.telefoon,
    motivatie: entity.motivatie,
    cvNaam: entity.cvNaam,
    cvOorspronkelijkeNaam: entity.cvOorspronkelijkeNaam,
    motivatiebriefNaam: entity.motivatiebriefNaam,
    motivatiebriefOorspronkelijkeNaam: entity.motivatiebriefOorspronkelijkeNaam,
    status: entity.status,
    statusHistory: JSON.parse(entity.statusHistoryJson || "[]"),
    notities: entity.notities || "",
    handmatigToegevoegdDoor: entity.handmatigToegevoegdDoor || "",
    reacties: JSON.parse(entity.reactiesJson || "[]"),
    ingediendOp: entity.ingediendOp
  };
}

// Afdelingshoofden lezen mee ("inlezen op een kandidaat"), maar krijgen
// niet HR's interne notities en niet wie dit eventueel handmatig heeft
// toegevoegd te zien — dat is bewust HR-only, los van de afdelingsscope.
// reacties (de chatlog met HR) blijft wel staan: dat is juist voor HR én
// het afdelingshoofd zelf bedoeld.
function toSollicitatieDtoVoorAfdelingshoofd(entity) {
  const dto = toSollicitatieDto(entity);
  delete dto.notities;
  delete dto.handmatigToegevoegdDoor;
  return dto;
}

module.exports = {
  PARTITION_KEY,
  ALLOWED_STATUSSEN,
  BORD_FASES,
  EXIT_STATUSSEN,
  getSollicitatiesTableClient,
  toEntity,
  toSollicitatieDto,
  toSollicitatieDtoVoorAfdelingshoofd,
  metNieuweStatusHistory,
  metNieuweReactie
};
