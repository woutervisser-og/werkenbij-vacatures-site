const { BlobServiceClient } = require("@azure/storage-blob");

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = "sollicitatie-bijlagen";

// CV's en motivatiebrieven, in tegenstelling tot de mediabibliotheek NIET
// publiek leesbaar: alleen op te vragen via de (beveiligde)
// SollicitatieBijlage-Function.
const TOEGESTANE_EXTENSIES = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};

const MAX_BESTANDSGROOTTE = 5 * 1024 * 1024; // 5MB

let containerClientPromise;

function getCvBijlagenContainerClient() {
  if (!containerClientPromise) {
    containerClientPromise = (async () => {
      const serviceClient = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
      const containerClient = serviceClient.getContainerClient(CONTAINER_NAME);
      await containerClient.createIfNotExists(); // geen "access"-optie: private
      return containerClient;
    })();
  }
  return containerClientPromise;
}

module.exports = { getCvBijlagenContainerClient, TOEGESTANE_EXTENSIES, MAX_BESTANDSGROOTTE };
