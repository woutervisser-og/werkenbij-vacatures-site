const { getAfdelingshoofdenTableClient, normaliseerEmail, PARTITION_KEY } = require("../shared/afdelingshoofdenTable");

// Beveiligd via /api/sollicitatiebeheer/* (hrbeheer-only).
module.exports = async function (context, req) {
  const email = normaliseerEmail(context.bindingData.email);

  try {
    const tableClient = await getAfdelingshoofdenTableClient();
    await tableClient.deleteEntity(PARTITION_KEY, email);
    context.res = { status: 204 };
  } catch (error) {
    if (error.statusCode === 404) {
      context.res = { status: 404, body: { error: "Afdelingshoofd niet gevonden" } };
      return;
    }
    context.res = { status: 500, body: { error: "Kon afdelingshoofd niet verwijderen", debug: error.message } };
  }
};
