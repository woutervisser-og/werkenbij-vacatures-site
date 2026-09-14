const {
  getVacaturesTableClient,
  normalizeVacatureInput,
  toEntity,
  toVacatureDto,
  PARTITION_KEY,
  ALLOWED_STATUSSEN
} = require("../shared/vacaturesTable");
const { triggerRebuild, raaktPubliekeSite } = require("../shared/rebuildTrigger");

module.exports = async function (context, req) {
  const id = context.bindingData.id;
  const input = req.body || {};
  const genormaliseerd = normalizeVacatureInput(input);

  if (genormaliseerd.status && !ALLOWED_STATUSSEN.includes(genormaliseerd.status)) {
    context.res = {
      status: 400,
      body: { error: `Ongeldige status, kies uit: ${ALLOWED_STATUSSEN.join(", ")}` }
    };
    return;
  }

  try {
    const tableClient = await getVacaturesTableClient();
    const bestaand = await tableClient.getEntity(PARTITION_KEY, id);
    const bestaandeVacature = toVacatureDto(bestaand);

    const samengevoegd = { ...bestaandeVacature, ...genormaliseerd };
    // Talen per stuk samenvoegen i.p.v. het hele translations-object te
    // vervangen: anders verdwijnen andere talen zodra iemand (bv. het
    // huidige, nog niet-meertalige beheerformulier) alleen de EN-tekst
    // opslaat.
    if (genormaliseerd.translations) {
      samengevoegd.translations = { ...bestaandeVacature.translations, ...genormaliseerd.translations };
    }

    if (!samengevoegd.translations || !samengevoegd.translations.en || !samengevoegd.translations.en.title) {
      context.res = { status: 400, body: { error: "Titel (EN) is verplicht" } };
      return;
    }

    const nu = new Date().toISOString();
    const bijgewerkt = toEntity(
      id,
      samengevoegd,
      { createdAt: bestaand.createdAt, updatedAt: nu }
    );

    await tableClient.updateEntity(bijgewerkt, "Replace");

    if (raaktPubliekeSite(bestaandeVacature.status, bijgewerkt.status)) {
      await triggerRebuild(context);
    }

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: toVacatureDto(bijgewerkt)
    };
  } catch (error) {
    if (error.statusCode === 404) {
      context.res = { status: 404, body: { error: "Vacature niet gevonden" } };
      return;
    }
    context.res = { status: 500, body: { error: "Kon vacature niet bijwerken", debug: error.message } };
  }
};
