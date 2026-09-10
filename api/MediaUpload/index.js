const { randomUUID } = require("crypto");
const path = require("path");
const { getMediaContainerClient, TOEGESTANE_EXTENSIES } = require("../shared/mediaContainer");

// Verwacht de bestandsnaam als query-parameter (?bestandsnaam=foto.jpg) en
// de ruwe bestandsinhoud als request body. Geen multipart/form-data, om
// dit simpel te houden.
module.exports = async function (context, req) {
  const oorspronkelijkeNaam = req.query.bestandsnaam;
  if (!oorspronkelijkeNaam) {
    context.res = { status: 400, body: { error: "Query-parameter 'bestandsnaam' is verplicht" } };
    return;
  }

  const extensie = path.extname(oorspronkelijkeNaam).toLowerCase();
  const contentType = TOEGESTANE_EXTENSIES[extensie];
  if (!contentType) {
    context.res = {
      status: 400,
      body: { error: `Bestandstype niet toegestaan, kies uit: ${Object.keys(TOEGESTANE_EXTENSIES).join(", ")}` }
    };
    return;
  }

  if (!req.body || req.body.length === 0) {
    context.res = { status: 400, body: { error: "Lege upload" } };
    return;
  }

  const blobNaam = `${randomUUID()}${extensie}`;

  try {
    const containerClient = await getMediaContainerClient();
    const blockBlobClient = containerClient.getBlockBlobClient(blobNaam);
    await blockBlobClient.uploadData(req.body, { blobHTTPHeaders: { blobContentType: contentType } });

    context.res = {
      status: 201,
      headers: { "Content-Type": "application/json" },
      body: { naam: blobNaam, oorspronkelijkeNaam, url: blockBlobClient.url }
    };
  } catch (error) {
    context.res = { status: 500, body: { error: "Kon bestand niet uploaden", debug: error.message } };
  }
};
