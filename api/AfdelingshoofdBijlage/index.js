const path = require("path");
const { getSollicitatiesTableClient, PARTITION_KEY } = require("../shared/sollicitatiesTable");
const { getCvBijlagenContainerClient, TOEGESTANE_EXTENSIES } = require("../shared/cvBijlagenContainer");
const { toegestaneVacatureIds } = require("../shared/afdelingshoofdToegang");
const { huidigeGebruiker } = require("../shared/huidigeGebruiker");

// Zelfde als SollicitatieBijlage (HR-only), maar met de afdelingsscope-check
// ervoor: een afdelingshoofd mag alleen een CV/motivatiebrief downloaden
// van een sollicitatie binnen zijn eigen afdeling(en).
module.exports = async function (context, req) {
  const id = context.bindingData.id;
  const veld = req.query.veld === "motivatiebrief" ? "motivatiebrief" : "cv";
  const email = huidigeGebruiker(req);

  try {
    const toegestaan = await toegestaneVacatureIds(email);

    const tableClient = await getSollicitatiesTableClient();
    const sollicitatie = await tableClient.getEntity(PARTITION_KEY, id);

    if (!toegestaan.has(sollicitatie.vacatureId)) {
      context.res = { status: 403, body: { error: "Geen toegang tot deze sollicitatie" } };
      return;
    }

    const blobNaam = veld === "motivatiebrief" ? sollicitatie.motivatiebriefNaam : sollicitatie.cvNaam;
    const oorspronkelijkeNaam = veld === "motivatiebrief"
      ? sollicitatie.motivatiebriefOorspronkelijkeNaam
      : sollicitatie.cvOorspronkelijkeNaam;

    if (!blobNaam) {
      context.res = { status: 404, body: { error: "Geen bijlage aanwezig" } };
      return;
    }

    const containerClient = await getCvBijlagenContainerClient();
    const blockBlobClient = containerClient.getBlockBlobClient(blobNaam);
    const inhoud = await blockBlobClient.downloadToBuffer();

    const contentType = TOEGESTANE_EXTENSIES[path.extname(blobNaam).toLowerCase()] || "application/octet-stream";

    context.res = {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${(oorspronkelijkeNaam || blobNaam).replace(/"/g, "")}"`
      },
      body: inhoud,
      isRaw: true
    };
  } catch (error) {
    if (error.statusCode === 404) {
      context.res = { status: 404, body: { error: "Sollicitatie niet gevonden" } };
      return;
    }
    context.log.error("Kon bijlage niet ophalen", error.message);
    context.res = { status: 500, body: { error: "Kon bijlage niet ophalen" } };
  }
};
