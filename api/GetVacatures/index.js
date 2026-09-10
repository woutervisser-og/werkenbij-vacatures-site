const { getVacaturesTableClient, toVacatureDto } = require("../shared/vacaturesTable");

// Publieke, anonieme Function: toont alleen vacatures met status
// "gepubliceerd". Gebruikt door vacatures.html (rechtstreeks in de
// browser) en door scripts/generate-vacatures (bij het bouwen van de
// site, om de losse vacature-detailpagina's te genereren).
module.exports = async function (context, req) {
  try {
    const tableClient = await getVacaturesTableClient();
    const vacatures = [];

    for await (const entity of tableClient.listEntities({ queryOptions: { filter: "status eq 'gepubliceerd'" } })) {
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
