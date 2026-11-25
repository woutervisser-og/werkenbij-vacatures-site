const { randomUUID } = require("crypto");
const { getVacaturesTableClient, PARTITION_KEY: VACATURE_PARTITION_KEY } = require("../shared/vacaturesTable");
const {
  getSollicitatiesTableClient,
  toEntity,
  toSollicitatieDto,
  ALLOWED_STATUSSEN
} = require("../shared/sollicitatiesTable");
const { huidigeGebruiker } = require("../shared/huidigeGebruiker");

const EMAIL_REGEX = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
const TELEFOON_REGEX = /^\+?[0-9]{7,15}$/;

// Beveiligd endpoint (allowedRoles: ["hrbeheer"] via de /api/sollicitatiebeheer*
// route in staticwebapp.config.json, zelfde als SollicitatieUpdate/Delete):
// voor kandidaten die buiten het publieke sollicitatieformulier om
// binnenkomen (LinkedIn, Indeed, telefoon). In tegenstelling tot het
// publieke SollicitatieCreate is een CV hier niet verplicht.
module.exports = async function (context, req) {
  const input = req.body || {};

  if (!input.vacatureId) {
    context.res = { status: 400, body: { error: "vacatureId is verplicht" } };
    return;
  }
  if (!input.voornaam || !input.achternaam) {
    context.res = { status: 400, body: { error: "Voornaam en achternaam zijn verplicht" } };
    return;
  }
  if (!input.email || !EMAIL_REGEX.test(input.email)) {
    context.res = { status: 400, body: { error: "Een geldig e-mailadres is verplicht" } };
    return;
  }
  if (input.telefoon && !TELEFOON_REGEX.test(input.telefoon.replace(/[\s\-().]/g, ""))) {
    context.res = { status: 400, body: { error: "Telefoonnummer is ongeldig" } };
    return;
  }
  if (input.status && !ALLOWED_STATUSSEN.includes(input.status)) {
    context.res = {
      status: 400,
      body: { error: `Ongeldige status, kies uit: ${ALLOWED_STATUSSEN.join(", ")}` }
    };
    return;
  }
  if (input.toestemmingGegeven !== true) {
    context.res = {
      status: 400,
      body: { error: "Bevestig eerst dat er een geldige rechtsgrond is om deze gegevens te verwerken" }
    };
    return;
  }

  try {
    const vacaturesTableClient = await getVacaturesTableClient();
    let vacatureTitel = "";
    try {
      const vacatureEntity = await vacaturesTableClient.getEntity(VACATURE_PARTITION_KEY, input.vacatureId);
      vacatureTitel = vacatureEntity.title || vacatureEntity.titel || "";
    } catch (error) {
      if (error.statusCode === 404) {
        context.res = { status: 400, body: { error: "Onbekende vacature" } };
        return;
      }
      throw error;
    }

    const id = randomUUID();
    const ingediendOp = new Date().toISOString();
    const entity = toEntity(
      id,
      {
        vacatureId: input.vacatureId,
        vacatureTitel,
        voornaam: input.voornaam,
        achternaam: input.achternaam,
        email: input.email,
        telefoon: input.telefoon,
        motivatie: input.motivatie,
        status: input.status,
        cvNaam: input.cv && input.cv.naam,
        cvOorspronkelijkeNaam: input.cv && input.cv.oorspronkelijkeNaam,
        motivatiebriefNaam: input.motivatiebrief && input.motivatiebrief.naam,
        motivatiebriefOorspronkelijkeNaam: input.motivatiebrief && input.motivatiebrief.oorspronkelijkeNaam
      },
      { ingediendOp, toegevoegdDoor: huidigeGebruiker(req), toestemmingGegevenOp: ingediendOp }
    );

    const sollicitatiesTableClient = await getSollicitatiesTableClient();
    await sollicitatiesTableClient.createEntity(entity);

    context.res = {
      status: 201,
      headers: { "Content-Type": "application/json" },
      body: toSollicitatieDto(entity)
    };
  } catch (error) {
    context.log.error("Kon sollicitatie niet opslaan", error.message);
    context.res = { status: 500, body: { error: "Kon sollicitatie niet opslaan" } };
  }
};
