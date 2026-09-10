const { getVacaturesTableClient, toVacatureDto, PARTITION_KEY } = require("../shared/vacaturesTable");

module.exports = async function (context, req) {
  const id = context.bindingData.id;

  try {
    const tableClient = await getVacaturesTableClient();
    const entity = await tableClient.getEntity(PARTITION_KEY, id);

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: toVacatureDto(entity)
    };
  } catch (error) {
    if (error.statusCode === 404) {
      context.res = { status: 404, body: { error: "Vacature niet gevonden" } };
      return;
    }
    context.res = { status: 500, body: { error: "Kon vacature niet ophalen", debug: error.message } };
  }
};
