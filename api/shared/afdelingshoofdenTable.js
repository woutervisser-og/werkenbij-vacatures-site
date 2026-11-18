const { TableClient } = require("@azure/data-tables");

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const TABLE_NAME = "Afdelingshoofden";

// Zelfde aanpak als vacaturesTable.js/sollicitatiesTable.js: 1 vaste
// PartitionKey, het aantal afdelingshoofden is klein genoeg om in 1
// partitie te passen. RowKey is het e-mailadres zelf (genormaliseerd),
// dat is de natuurlijke sleutel hier: HR beheert dit op e-mailadres,
// niet op een intern Entra-object-id.
const PARTITION_KEY = "afdelingshoofd";

let tableClientPromise;

function getAfdelingshoofdenTableClient() {
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

// E-mailadressen zijn in Entra niet hoofdlettergevoelig; dit voorkomt
// dubbele rijen voor hetzelfde adres met een andere schrijfwijze.
function normaliseerEmail(email) {
  return (email || "").trim().toLowerCase();
}

// Afdelingen opgeslagen als kommagescheiden string (Table Storage kent
// geen geneste arrays), zelfde patroon als vacatures' "werkgebied".
function naarAfdelingenCsv(afdelingen) {
  return (Array.isArray(afdelingen) ? afdelingen : [])
    .map(a => (a || "").trim())
    .filter(Boolean)
    .join(",");
}

function naarAfdelingenArray(entity) {
  return (entity.afdelingenCsv || "")
    .split(",")
    .map(a => a.trim())
    .filter(Boolean);
}

function toDto(entity) {
  return {
    email: entity.rowKey,
    afdelingen: naarAfdelingenArray(entity)
  };
}

module.exports = {
  PARTITION_KEY,
  getAfdelingshoofdenTableClient,
  normaliseerEmail,
  naarAfdelingenCsv,
  naarAfdelingenArray,
  toDto
};
