const { getVacaturesTableClient } = require("../shared/vacaturesTable");
const { getSollicitatiesTableClient, toSollicitatieDtoVoorAfdelingshoofd } = require("../shared/sollicitatiesTable");
const { getAfdelingshoofdenTableClient, normaliseerEmail, naarAfdelingenArray, PARTITION_KEY } = require("../shared/afdelingshoofdenTable");
const { huidigeGebruiker } = require("../shared/huidigeGebruiker");

// Beveiligd via /api/afdelingshoofd/* in staticwebapp.config.json
// (allowedRoles: ["afdelingshoofd"]) — dat regelt alleen OF iemand hier
// mag komen. WELKE sollicitaties die persoon mag zien wordt hieronder
// zelf bepaald aan de hand van de Afdelingshoofden-tabel: geen rij of
// geen afdelingen gevonden betekent een lege lijst, nooit de volledige
// lijst (fail closed).
module.exports = async function (context, req) {
  const email = normaliseerEmail(huidigeGebruiker(req));

  try {
    const afdelingshoofdenTableClient = await getAfdelingshoofdenTableClient();
    let afdelingen = [];
    try {
      const entity = await afdelingshoofdenTableClient.getEntity(PARTITION_KEY, email);
      afdelingen = naarAfdelingenArray(entity);
    } catch (error) {
      if (error.statusCode !== 404) throw error;
      // Geen rij voor dit e-mailadres: lege lijst, geen fout. Dit kan
      // gewoon voorkomen als iemand wel in de Entra-groep zit maar nog
      // niet aan een afdeling gekoppeld is.
    }

    if (afdelingen.length === 0) {
      context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: [] };
      return;
    }

    const vacaturesTableClient = await getVacaturesTableClient();
    const toegestaneVacatureIds = new Set();
    for await (const vacatureEntity of vacaturesTableClient.listEntities()) {
      if (afdelingen.includes(vacatureEntity.department)) {
        toegestaneVacatureIds.add(vacatureEntity.rowKey);
      }
    }

    const sollicitatiesTableClient = await getSollicitatiesTableClient();
    const sollicitaties = [];
    for await (const sollicitatieEntity of sollicitatiesTableClient.listEntities()) {
      if (toegestaneVacatureIds.has(sollicitatieEntity.vacatureId)) {
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
