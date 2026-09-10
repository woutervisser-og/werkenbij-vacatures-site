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
    })();
  }
  return tableClientPromise;
}

// Zet een vacature (zoals aangeleverd door de admin-UI) om naar een Table
// Storage entity. Geneste structuren (header, body-blokken) kunnen niet
// als zodanig in Table Storage, dus die gaan er als JSON-tekst in.
function toEntity(id, vacature, { createdAt, updatedAt }) {
  return {
    partitionKey: PARTITION_KEY,
    rowKey: id,
    titel: vacature.titel || "",
    afdeling: vacature.afdeling || "",
    locatie: vacature.locatie || "",
    dienstverband: vacature.dienstverband || "",
    salarisMin: vacature.salarisMin ?? null,
    salarisMax: vacature.salarisMax ?? null,
    salarisInOverleg: Boolean(vacature.salarisInOverleg),
    opleidingsniveau: vacature.opleidingsniveau || "",
    sluitingsdatum: vacature.sluitingsdatum || "",
    publicatiedatum: vacature.publicatiedatum || "",
    status: vacature.status || "concept",
    headerJson: JSON.stringify(vacature.header || null),
    bodyBlokkenJson: JSON.stringify(vacature.bodyBlokken || []),
    createdAt,
    updatedAt
  };
}

// En omgekeerd: van Table Storage entity terug naar een vacature-object
// zoals de admin-UI en de site die verwachten.
function toVacatureDto(entity) {
  return {
    id: entity.rowKey,
    titel: entity.titel,
    afdeling: entity.afdeling,
    locatie: entity.locatie,
    dienstverband: entity.dienstverband,
    salarisMin: entity.salarisMin,
    salarisMax: entity.salarisMax,
    salarisInOverleg: entity.salarisInOverleg,
    opleidingsniveau: entity.opleidingsniveau,
    sluitingsdatum: entity.sluitingsdatum,
    publicatiedatum: entity.publicatiedatum,
    status: entity.status,
    header: JSON.parse(entity.headerJson || "null"),
    bodyBlokken: JSON.parse(entity.bodyBlokkenJson || "[]"),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  };
}

module.exports = {
  PARTITION_KEY,
  ALLOWED_STATUSSEN,
  getVacaturesTableClient,
  toEntity,
  toVacatureDto
};
