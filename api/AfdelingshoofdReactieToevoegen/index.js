const {
  getSollicitatiesTableClient,
  PARTITION_KEY,
  metNieuweReactie,
  toSollicitatieDtoVoorAfdelingshoofd
} = require("../shared/sollicitatiesTable");
const { toegestaneVacatureIds } = require("../shared/afdelingshoofdToegang");
const { huidigeGebruiker } = require("../shared/huidigeGebruiker");

// Beveiligd via /api/afdelingshoofd/* (rol-check), plus hier nogmaals de
// afdelingsscope: een afdelingshoofd mag alleen reageren op sollicitaties
// binnen zijn eigen afdeling(en), ook al is het sollicitatie-id te raden.
module.exports = async function (context, req) {
  const id = context.bindingData.id;
  const email = huidigeGebruiker(req);
  const tekst = ((req.body && req.body.tekst) || "").trim();

  if (!tekst) {
    context.res = { status: 400, body: { error: "Reactietekst is verplicht" } };
    return;
  }

  try {
    const toegestaan = await toegestaneVacatureIds(email);

    const tableClient = await getSollicitatiesTableClient();
    const sollicitatie = await tableClient.getEntity(PARTITION_KEY, id);

    if (!toegestaan.has(sollicitatie.vacatureId)) {
      context.res = { status: 403, body: { error: "Geen toegang tot deze sollicitatie" } };
      return;
    }

    const reactiesJson = metNieuweReactie(sollicitatie, { tekst, auteur: email, rol: "afdelingshoofd" });
    await tableClient.updateEntity(
      { partitionKey: PARTITION_KEY, rowKey: id, reactiesJson },
      "Merge"
    );

    const bijgewerkt = await tableClient.getEntity(PARTITION_KEY, id);
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: toSollicitatieDtoVoorAfdelingshoofd(bijgewerkt)
    };
  } catch (error) {
    if (error.statusCode === 404) {
      context.res = { status: 404, body: { error: "Sollicitatie niet gevonden" } };
      return;
    }
    context.res = { status: 500, body: { error: "Kon reactie niet opslaan", debug: error.message } };
  }
};
