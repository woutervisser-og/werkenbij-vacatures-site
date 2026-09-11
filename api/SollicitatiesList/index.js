const { getSollicitatiesTableClient, toSollicitatieDto } = require("../shared/sollicitatiesTable");

// Toegang wordt beperkt via de route-restrictie op /api/sollicitatiebeheer/*
// in staticwebapp.config.json, niet hier in de Function zelf.
module.exports = async function (context, req) {
  try {
    const tableClient = await getSollicitatiesTableClient();
    const sollicitaties = [];
    for await (const entity of tableClient.listEntities()) {
      sollicitaties.push(toSollicitatieDto(entity));
    }

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: sollicitaties
    };
  } catch (error) {
    context.res = { status: 500, body: { error: "Kon sollicitaties niet ophalen", debug: error.message } };
  }
};
