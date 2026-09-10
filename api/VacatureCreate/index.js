const { randomUUID } = require("crypto");
const { getVacaturesTableClient, toEntity, toVacatureDto, ALLOWED_STATUSSEN } = require("../shared/vacaturesTable");

module.exports = async function (context, req) {
  const input = req.body || {};

  if (!input.titel) {
    context.res = { status: 400, body: { error: "Titel is verplicht" } };
    return;
  }
  if (input.status && !ALLOWED_STATUSSEN.includes(input.status)) {
    context.res = {
      status: 400,
      body: { error: `Ongeldige status, kies uit: ${ALLOWED_STATUSSEN.join(", ")}` }
    };
    return;
  }

  const nu = new Date().toISOString();
  const id = randomUUID();
  const entity = toEntity(id, input, { createdAt: nu, updatedAt: nu });

  try {
    const tableClient = await getVacaturesTableClient();
    await tableClient.createEntity(entity);

    context.res = {
      status: 201,
      headers: { "Content-Type": "application/json" },
      body: toVacatureDto(entity)
    };
  } catch (error) {
    context.res = { status: 500, body: { error: "Kon vacature niet aanmaken", debug: error.message } };
  }
};
