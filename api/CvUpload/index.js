const { randomUUID } = require("crypto");
const path = require("path");
const {
  getCvBijlagenContainerClient,
  TOEGESTANE_EXTENSIES,
  MAX_BESTANDSGROOTTE
} = require("../shared/cvBijlagenContainer");
const { isGeldigUploadToken, isIngeschakeld } = require("../shared/uploadToken");
const { heeftRol } = require("../shared/huidigeGebruiker");

// Publiek endpoint (net als SollicitatieCreate): een kandidaat is niet
// ingelogd. Verwacht de bestandsnaam als query-parameter en de ruwe
// bestandsinhoud als request body, zelfde aanpak als MediaUpload.
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

  // Drempel tegen geautomatiseerd misbruik (zie shared/uploadToken.js):
  // een ingelogde HR-gebruiker (handmatig toevoegen, zie
  // sollicitatie-toevoegen.html) mag altijd door, net als elke aanvraag
  // zolang CV_UPLOAD_TOKEN_SECRET nog niet is ingesteld. Zonder geldig
  // token doen we alsof het gelukt is zonder iets te uploaden — zelfde
  // aanpak als de honeypot bij SollicitatieCreate, geen signaal naar een
  // bot dat het geblokkeerd is.
  const slaatDrempelOver = heeftRol(req, "hrbeheer") || !isIngeschakeld();
  if (!slaatDrempelOver && !isGeldigUploadToken(req.headers["x-upload-token"])) {
    context.res = {
      status: 201,
      headers: { "Content-Type": "application/json" },
      body: { naam: `${randomUUID()}${extensie}`, oorspronkelijkeNaam }
    };
    return;
  }

  if (!req.body || req.body.length === 0) {
    context.res = { status: 400, body: { error: "Lege upload" } };
    return;
  }

  if (req.body.length > MAX_BESTANDSGROOTTE) {
    context.res = { status: 400, body: { error: "Bestand is groter dan 5MB" } };
    return;
  }

  const blobNaam = `${randomUUID()}${extensie}`;

  try {
    const containerClient = await getCvBijlagenContainerClient();
    const blockBlobClient = containerClient.getBlockBlobClient(blobNaam);
    await blockBlobClient.uploadData(req.body, { blobHTTPHeaders: { blobContentType: contentType } });

    context.res = {
      status: 201,
      headers: { "Content-Type": "application/json" },
      body: { naam: blobNaam, oorspronkelijkeNaam }
    };
  } catch (error) {
    context.log.error("Kon bestand niet uploaden", error.message);
    context.res = { status: 500, body: { error: "Kon bestand niet uploaden" } };
  }
};
