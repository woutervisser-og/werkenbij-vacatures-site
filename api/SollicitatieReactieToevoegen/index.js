const {
  getSollicitatiesTableClient,
  PARTITION_KEY,
  metNieuweReactie,
  toSollicitatieDto
} = require("../shared/sollicitatiesTable");
const { huidigeGebruiker } = require("../shared/huidigeGebruiker");

// Beveiligd via /api/sollicitatiebeheer/* (hrbeheer-only). HR's kant van
// dezelfde chatlog als AfdelingshoofdReactieToevoegen: geen afdelingsscope
// nodig, HR ziet en mag reageren op alle sollicitaties.
module.exports = async function (context, req) {
  const id = context.bindingData.id;
  const email = huidigeGebruiker(req);
  const tekst = ((req.body && req.body.tekst) || "").trim();

  if (!tekst) {
    context.res = { status: 400, body: { error: "Reactietekst is verplicht" } };
    return;
  }

  try {
    const tableClient = await getSollicitatiesTableClient();
    const sollicitatie = await tableClient.getEntity(PARTITION_KEY, id);

    const bijgewerkt = { ...sollicitatie };
    bijgewerkt.reactiesJson = metNieuweReactie(sollicitatie, { tekst, auteur: email, rol: "hr" });
    await tableClient.updateEntity(bijgewerkt, "Replace");

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: toSollicitatieDto(bijgewerkt)
    };
  } catch (error) {
    if (error.statusCode === 404) {
      context.res = { status: 404, body: { error: "Sollicitatie niet gevonden" } };
      return;
    }
    context.log.error("Kon reactie niet opslaan", error.message);
    context.res = { status: 500, body: { error: "Kon reactie niet opslaan" } };
  }
};
