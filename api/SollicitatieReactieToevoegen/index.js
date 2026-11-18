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

    const reactiesJson = metNieuweReactie(sollicitatie, { tekst, auteur: email, rol: "hr" });
    await tableClient.updateEntity(
      { partitionKey: PARTITION_KEY, rowKey: id, reactiesJson },
      "Merge"
    );

    const bijgewerkt = await tableClient.getEntity(PARTITION_KEY, id);
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
    context.res = { status: 500, body: { error: "Kon reactie niet opslaan", debug: error.message } };
  }
};
