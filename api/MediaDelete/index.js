const { getMediaContainerClient } = require("../shared/mediaContainer");

module.exports = async function (context, req) {
  const naam = context.bindingData.naam;

  try {
    const containerClient = await getMediaContainerClient();
    const response = await containerClient.getBlockBlobClient(naam).deleteIfExists();

    if (!response.succeeded) {
      context.res = { status: 404, body: { error: "Bestand niet gevonden" } };
      return;
    }

    context.res = { status: 204 };
  } catch (error) {
    context.res = { status: 500, body: { error: "Kon bestand niet verwijderen", debug: error.message } };
  }
};
