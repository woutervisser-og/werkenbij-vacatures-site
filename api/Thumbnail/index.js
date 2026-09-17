const sharp = require("sharp");
const { getMediaContainerClient } = require("../shared/mediaContainer");

// Vaste, beperkte set breedtes i.p.v. een vrije parameter: voorkomt dat
// iemand de Function kan misbruiken om willekeurig veel unieke, dure
// resizes te forceren (elke unieke breedte is een aparte cache-entry).
// 800px dekt de vacature-tegel ruim, ook op een retina-scherm.
const TOEGESTANE_BREEDTES = [400, 800, 1200];
const STANDAARD_BREEDTE = 800;

// Publieke, anonieme Function (route bewust niet met "media" beginnend,
// anders was hij per ongeluk onder de authenticated-only /api/media*-
// regel in staticwebapp.config.json gevallen — de resultaten hier zijn
// sowieso al publiek: de "media"-container staat zelf ook op publieke
// blob-toegang, zie mediaContainer.js).
//
// Geeft een verkleinde/gecomprimeerde WebP-versie terug van een bestand
// uit de mediabibliotheek, i.p.v. dat vacatures.html de originele
// (vaak 2-4 MB, ongewijzigde camera-)foto rechtstreeks als thumbnail
// laadt. Lang cachebaar: elke geüploade bestandsnaam is een nieuwe,
// willekeurige UUID (zie MediaUpload), dezelfde naam levert dus altijd
// dezelfde inhoud.
module.exports = async function (context, req) {
  const bestand = req.query.bestand;
  if (!bestand) {
    context.res = { status: 400, body: { error: "Query-parameter 'bestand' is verplicht" } };
    return;
  }

  const gevraagdeBreedte = parseInt(req.query.breedte, 10);
  const breedte = TOEGESTANE_BREEDTES.includes(gevraagdeBreedte) ? gevraagdeBreedte : STANDAARD_BREEDTE;

  try {
    const containerClient = await getMediaContainerClient();
    const blobClient = containerClient.getBlockBlobClient(bestand);

    if (!(await blobClient.exists())) {
      context.res = { status: 404, body: { error: "Bestand niet gevonden" } };
      return;
    }

    const origineel = await blobClient.downloadToBuffer();
    const thumbnail = await sharp(origineel)
      .resize({ width: breedte, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    context.res = {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable"
      },
      body: thumbnail
    };
  } catch (error) {
    context.res = { status: 500, body: { error: "Kon thumbnail niet genereren", debug: error.message } };
  }
};
