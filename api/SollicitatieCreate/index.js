const { randomUUID } = require("crypto");
const { getVacaturesTableClient, PARTITION_KEY: VACATURE_PARTITION_KEY } = require("../shared/vacaturesTable");
const { getSollicitatiesTableClient, toEntity, toSollicitatieDto } = require("../shared/sollicitatiesTable");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Publiek endpoint: een kandidaat is niet ingelogd. Het CV zelf is al apart
// geupload via CvUpload (net als een headerfoto eerst apart via
// MediaUpload gaat), dit endpoint slaat alleen de sollicitatie zelf op met
// een verwijzing naar dat bestand.
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
  if (!input.cv || !input.cv.naam) {
    context.res = { status: 400, body: { error: "CV ontbreekt" } };
    return;
  }

  try {
    const vacaturesTableClient = await getVacaturesTableClient();
    let vacatureTitel = "";
    try {
      const vacatureEntity = await vacaturesTableClient.getEntity(VACATURE_PARTITION_KEY, input.vacatureId);
      vacatureTitel = vacatureEntity.titel || "";
    } catch (error) {
      if (error.statusCode === 404) {
        context.res = { status: 400, body: { error: "Onbekende vacature" } };
        return;
      }
      throw error;
    }

    const id = randomUUID();
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
        cvNaam: input.cv.naam,
        cvOorspronkelijkeNaam: input.cv.oorspronkelijkeNaam,
        motivatiebriefNaam: input.motivatiebrief && input.motivatiebrief.naam,
        motivatiebriefOorspronkelijkeNaam: input.motivatiebrief && input.motivatiebrief.oorspronkelijkeNaam
      },
      { ingediendOp: new Date().toISOString() }
    );

    const sollicitatiesTableClient = await getSollicitatiesTableClient();
    await sollicitatiesTableClient.createEntity(entity);

    context.res = {
      status: 201,
      headers: { "Content-Type": "application/json" },
      body: toSollicitatieDto(entity)
    };
  } catch (error) {
    context.res = { status: 500, body: { error: "Kon sollicitatie niet opslaan", debug: error.message } };
  }
};
