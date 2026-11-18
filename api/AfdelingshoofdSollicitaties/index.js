const { getSollicitatiesTableClient, toSollicitatieDtoVoorAfdelingshoofd } = require("../shared/sollicitatiesTable");
const { toegestaneVacatureIds } = require("../shared/afdelingshoofdToegang");
const { huidigeGebruiker } = require("../shared/huidigeGebruiker");

// Beveiligd via /api/afdelingshoofd/* in staticwebapp.config.json
// (allowedRoles: ["afdelingshoofd"]) — dat regelt alleen OF iemand hier
// mag komen. WELKE sollicitaties die persoon mag zien wordt hieronder
// zelf bepaald aan de hand van toegestaneVacatureIds() (fail closed: een
// lege afdelingskoppeling geeft een lege lijst, nooit de volledige lijst).
module.exports = async function (context, req) {
  const email = huidigeGebruiker(req);

  try {
    const toegestaan = await toegestaneVacatureIds(email);
    if (toegestaan.size === 0) {
      context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: [] };
      return;
    }

    const sollicitatiesTableClient = await getSollicitatiesTableClient();
    const sollicitaties = [];
    for await (const sollicitatieEntity of sollicitatiesTableClient.listEntities()) {
      if (toegestaan.has(sollicitatieEntity.vacatureId)) {
        sollicitaties.push(toSollicitatieDtoVoorAfdelingshoofd(sollicitatieEntity));
      }
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
