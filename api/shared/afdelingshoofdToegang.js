const { getVacaturesTableClient, toVacatureDto } = require("./vacaturesTable");
const { getAfdelingshoofdenTableClient, normaliseerEmail, naarAfdelingenArray, PARTITION_KEY } = require("./afdelingshoofdenTable");

// Eén plek voor de "welke vacature-id's mag dit afdelingshoofd zien"-logica,
// gedeeld door alle afdelingshoofd-endpoints (lijst, bijlage, reactie). Geeft
// een lege Set terug als er geen afdelingskoppeling is — nooit alles
// (fail closed).
//
// Let op: leest toVacatureDto().department, niet de ruwe entity, omdat
// oudere vacature-rijen dit nog onder de Nederlandse kolomnaam "afdeling"
// hebben staan (zie VELD_ALIASSEN in vacaturesTable.js).
async function toegestaneVacatureIds(email) {
  const genormaliseerdeEmail = normaliseerEmail(email);

  const afdelingshoofdenTableClient = await getAfdelingshoofdenTableClient();
  let afdelingen = [];
  try {
    const entity = await afdelingshoofdenTableClient.getEntity(PARTITION_KEY, genormaliseerdeEmail);
    afdelingen = naarAfdelingenArray(entity);
  } catch (error) {
    if (error.statusCode !== 404) throw error;
  }
  if (afdelingen.length === 0) return new Set();

  const vacaturesTableClient = await getVacaturesTableClient();
  const ids = new Set();
  for await (const vacatureEntity of vacaturesTableClient.listEntities()) {
    if (afdelingen.includes(toVacatureDto(vacatureEntity).department)) {
      ids.add(vacatureEntity.rowKey);
    }
  }
  return ids;
}

module.exports = { toegestaneVacatureIds };
