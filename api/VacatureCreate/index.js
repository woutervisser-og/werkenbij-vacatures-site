const { randomUUID } = require("crypto");
const {
  getVacaturesTableClient,
  normalizeVacatureInput,
  toEntity,
  toVacatureDto,
  ALLOWED_STATUSSEN,
  ALLOWED_AFDELINGEN,
  ALLOWED_LOCATIES
} = require("../shared/vacaturesTable");
const { triggerRebuild, raaktPubliekeSite } = require("../shared/rebuildTrigger");

module.exports = async function (context, req) {
  const input = req.body || {};
  const genormaliseerd = normalizeVacatureInput(input);

  if (!genormaliseerd.translations || !genormaliseerd.translations.en || !genormaliseerd.translations.en.title) {
    context.res = { status: 400, body: { error: "Titel (EN) is verplicht" } };
    return;
  }
  if (genormaliseerd.status && !ALLOWED_STATUSSEN.includes(genormaliseerd.status)) {
    context.res = {
      status: 400,
      body: { error: `Ongeldige status, kies uit: ${ALLOWED_STATUSSEN.join(", ")}` }
    };
    return;
  }
  if (genormaliseerd.department && !ALLOWED_AFDELINGEN.includes(genormaliseerd.department)) {
    context.res = {
      status: 400,
      body: { error: `Ongeldige afdeling, kies uit: ${ALLOWED_AFDELINGEN.join(", ")}` }
    };
    return;
  }
  if (genormaliseerd.location && !ALLOWED_LOCATIES.includes(genormaliseerd.location)) {
    context.res = {
      status: 400,
      body: { error: `Ongeldige locatie, kies uit: ${ALLOWED_LOCATIES.join(", ")}` }
    };
    return;
  }

  const nu = new Date().toISOString();
  const id = randomUUID();
  const entity = toEntity(id, genormaliseerd, { createdAt: nu, updatedAt: nu });

  try {
    const tableClient = await getVacaturesTableClient();
    await tableClient.createEntity(entity);

    if (raaktPubliekeSite(null, entity.status)) {
      await triggerRebuild(context);
    }

    context.res = {
      status: 201,
      headers: { "Content-Type": "application/json" },
      body: toVacatureDto(entity)
    };
  } catch (error) {
    context.res = { status: 500, body: { error: "Kon vacature niet aanmaken", debug: error.message } };
  }
};
