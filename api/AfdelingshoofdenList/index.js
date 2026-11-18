const { getAfdelingshoofdenTableClient, toDto } = require("../shared/afdelingshoofdenTable");

// Toegang wordt beperkt via de route-restrictie op /api/sollicitatiebeheer/*
// in staticwebapp.config.json (hrbeheer-only), niet hier in de Function
// zelf. Dit beheert WIE afdelingshoofd is van WELKE afdeling(en), dus
// uitsluitend voor HR, niet voor afdelingshoofden zelf.
module.exports = async function (context, req) {
  try {
    const tableClient = await getAfdelingshoofdenTableClient();
    const afdelingshoofden = [];
    for await (const entity of tableClient.listEntities()) {
      afdelingshoofden.push(toDto(entity));
    }

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: afdelingshoofden
    };
  } catch (error) {
    context.res = { status: 500, body: { error: "Kon afdelingshoofden niet ophalen", debug: error.message } };
  }
};
