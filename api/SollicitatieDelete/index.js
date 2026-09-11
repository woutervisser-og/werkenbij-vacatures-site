const { getSollicitatiesTableClient, PARTITION_KEY } = require("../shared/sollicitatiesTable");
const { getCvBijlagenContainerClient } = require("../shared/cvBijlagenContainer");

module.exports = async function (context, req) {
  const id = context.bindingData.id;

  try {
    const tableClient = await getSollicitatiesTableClient();
    const bestaand = await tableClient.getEntity(PARTITION_KEY, id);
    await tableClient.deleteEntity(PARTITION_KEY, id);

    const containerClient = await getCvBijlagenContainerClient();
    if (bestaand.cvNaam) {
      await containerClient.getBlockBlobClient(bestaand.cvNaam).deleteIfExists();
    }
    if (bestaand.motivatiebriefNaam) {
      await containerClient.getBlockBlobClient(bestaand.motivatiebriefNaam).deleteIfExists();
    }

    context.res = { status: 204 };
  } catch (error) {
    if (error.statusCode === 404) {
      context.res = { status: 404, body: { error: "Sollicitatie niet gevonden" } };
      return;
    }
    context.res = { status: 500, body: { error: "Kon sollicitatie niet verwijderen", debug: error.message } };
  }
};
