const { BlobServiceClient } = require("@azure/storage-blob");

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = "media";

// Toegestane extensies voor headers en afbeelding-blokken. Geen CV's of
// andere documenten: die horen niet in deze publiek leesbare bibliotheek.
const TOEGESTANE_EXTENSIES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

let containerClientPromise;

// Publieke leestoegang op blob-niveau ("blob"): een headerafbeelding moet
// rechtstreeks door bezoekers van de site geladen kunnen worden zonder
// token, maar de inhoud van de container is niet op te sommen zonder de
// (beveiligde) MediaList-Function.
function getMediaContainerClient() {
  if (!containerClientPromise) {
    containerClientPromise = (async () => {
      const serviceClient = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
      const containerClient = serviceClient.getContainerClient(CONTAINER_NAME);
      await containerClient.createIfNotExists({ access: "blob" });
      // De "access"-optie hierboven werkt alleen bij het daadwerkelijk
      // aanmaken van de container. Als de container al bestond (bv. een
      // eerdere poging die de container wél aanmaakte maar niet publiek
      // kon zetten, toen "Anonieme blobtoegang toestaan" op het
      // storage-account nog uitstond), verandert createIfNotExists niets
      // aan een bestaande container. Daarom hier expliciet en altijd
      // opnieuw de toegang instellen, ongeacht of de container al bestond.
      await containerClient.setAccessPolicy("blob");
      return containerClient;
    })().catch(error => {
      // Een mislukte poging niet permanent laten "vastzitten": zonder dit
      // blijft een Function-instance die eenmaal een fout tegenkwam (bv.
      // een storage-instelling die nog niet klopte) die fout tot in
      // lengte van dagen herhalen, ook nadat de oorzaak is opgelost.
      containerClientPromise = null;
      throw error;
    });
  }
  return containerClientPromise;
}

module.exports = { getMediaContainerClient, TOEGESTANE_EXTENSIES };
