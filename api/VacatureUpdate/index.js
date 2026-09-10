const {
  getVacaturesTableClient,
  toEntity,
  toVacatureDto,
  PARTITION_KEY,
  ALLOWED_STATUSSEN
} = require("../shared/vacaturesTable");

module.exports = async function (context, req) {
  const id = context.bindingData.id;
  const input = req.body || {};

  if (input.status && !ALLOWED_STATUSSEN.includes(input.status)) {
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

    const nu = new Date().toISOString();
    const bijgewerkt = toEntity(
      id,
      { ...bestaandeVacature, ...input },
      { createdAt: bestaand.createdAt, updatedAt: nu }
    );

    await tableClient.updateEntity(bijgewerkt, "Replace");

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
