const { getVacaturesTableClient, PARTITION_KEY } = require("../shared/vacaturesTable");
const { triggerRebuild, raaktPubliekeSite } = require("../shared/rebuildTrigger");

// Voor een bewust ingetrokken vacature is meestal de status "gearchiveerd"
// (via VacatureUpdate) het juiste middel, dit is echte, onomkeerbare
// verwijdering uit Table Storage.
module.exports = async function (context, req) {
  const id = context.bindingData.id;

  try {
    const tableClient = await getVacaturesTableClient();
    const bestaand = await tableClient.getEntity(PARTITION_KEY, id);
    await tableClient.deleteEntity(PARTITION_KEY, id);

    if (raaktPubliekeSite(bestaand.status, null)) {
      await triggerRebuild(context);
    }

    context.res = { status: 204 };
  } catch (error) {
    if (error.statusCode === 404) {
      context.res = { status: 404, body: { error: "Vacature niet gevonden" } };
      return;
    }
    context.res = { status: 500, body: { error: "Kon vacature niet verwijderen", debug: error.message } };
  }
};
