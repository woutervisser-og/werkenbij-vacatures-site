const { getMediaContainerClient } = require("../shared/mediaContainer");

// Toont de bestaande bestanden in de mediabibliotheek, zodat HR een
// eerder geüploade foto kan hergebruiken bij een nieuwe vacature in
// plaats van steeds opnieuw te moeten uploaden.
module.exports = async function (context, req) {
  try {
    const containerClient = await getMediaContainerClient();
    const bestanden = [];

    for await (const blob of containerClient.listBlobsFlat()) {
      const blobClient = containerClient.getBlobClient(blob.name);
      bestanden.push({
        naam: blob.name,
        url: blobClient.url,
        grootte: blob.properties.contentLength,
        aangemaakt: blob.properties.createdOn
      });
    }

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: bestanden
    };
  } catch (error) {
    context.res = { status: 500, body: { error: "Kon mediabibliotheek niet ophalen", debug: error.message } };
  }
};
