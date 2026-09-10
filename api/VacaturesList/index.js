const { getVacaturesTableClient, toVacatureDto } = require("../shared/vacaturesTable");

// Toegang wordt beperkt via de route-restrictie op /api/vacatures/* in
// staticwebapp.config.json, niet hier in de Function zelf.
module.exports = async function (context, req) {
  try {
    const tableClient = await getVacaturesTableClient();
    const vacatures = [];
    for await (const entity of tableClient.listEntities()) {
      vacatures.push(toVacatureDto(entity));
    }

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: vacatures
    };
  } catch (error) {
    context.res = { status: 500, body: { error: "Kon vacatures niet ophalen", debug: error.message } };
  }
};
