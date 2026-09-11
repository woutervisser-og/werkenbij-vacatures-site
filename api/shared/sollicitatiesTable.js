const { TableClient } = require("@azure/data-tables");

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const TABLE_NAME = "Sollicitaties";

// Zelfde aanpak als vacaturesTable.js: 1 vaste PartitionKey, het aantal
// sollicitaties is klein genoeg om in 1 partitie te passen.
const PARTITION_KEY = "sollicitatie";

const ALLOWED_STATUSSEN = [
  "nieuw",
  "in_behandeling",
  "afgewezen",
  "aangenomen",
  "bewaard",
  "gearchiveerd"
];

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
    })();
  }
  return tableClientPromise;
}

// vacatureTitel wordt gedenormaliseerd opgeslagen (op het moment van
// solliciteren), zodat het beheeroverzicht die kan tonen zonder voor elke
// rij de bijbehorende vacature te moeten opzoeken (die kan intussen ook
// verwijderd zijn).
function toEntity(id, sollicitatie, { ingediendOp }) {
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
    status: sollicitatie.status || "nieuw",
    ingediendOp
  };
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
    ingediendOp: entity.ingediendOp
  };
}

module.exports = {
  PARTITION_KEY,
  ALLOWED_STATUSSEN,
  getSollicitatiesTableClient,
  toEntity,
  toSollicitatieDto
};
