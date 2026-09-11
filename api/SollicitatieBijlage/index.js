const path = require("path");
const { getSollicitatiesTableClient, PARTITION_KEY } = require("../shared/sollicitatiesTable");
const { getCvBijlagenContainerClient, TOEGESTANE_EXTENSIES } = require("../shared/cvBijlagenContainer");

// Streamt een CV of motivatiebrief. Toegang wordt beperkt via de
// route-restrictie op /api/sollicitatiebeheer/* in staticwebapp.config.json:
// de bijlagen zelf staan in een private container, dit is de enige manier
// om ze op te vragen.
module.exports = async function (context, req) {
  const id = context.bindingData.id;
  const veld = req.query.veld === "motivatiebrief" ? "motivatiebrief" : "cv";

  try {
    const tableClient = await getSollicitatiesTableClient();
    const sollicitatie = await tableClient.getEntity(PARTITION_KEY, id);

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
    context.res = { status: 500, body: { error: "Kon bijlage niet ophalen", debug: error.message } };
  }
};
