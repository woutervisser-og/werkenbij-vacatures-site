const {
  getSollicitatiesTableClient,
  toSollicitatieDto,
  PARTITION_KEY,
  ALLOWED_STATUSSEN
} = require("../shared/sollicitatiesTable");

// Alleen de status is te wijzigen vanuit /beheer (zie Sollicitatie-
// statussen in ARCHITECTUUR-HR-PORTAAL.md); de sollicitatiegegevens zelf
// staan vast zoals de kandidaat ze heeft ingediend.
module.exports = async function (context, req) {
  const id = context.bindingData.id;
  const input = req.body || {};

  if (!input.status || !ALLOWED_STATUSSEN.includes(input.status)) {
    context.res = {
      status: 400,
      body: { error: `Ongeldige status, kies uit: ${ALLOWED_STATUSSEN.join(", ")}` }
    };
    return;
  }

  try {
    const tableClient = await getSollicitatiesTableClient();
    const bestaand = await tableClient.getEntity(PARTITION_KEY, id);
    const bijgewerkt = { ...bestaand, status: input.status };

    await tableClient.updateEntity(bijgewerkt, "Replace");

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: toSollicitatieDto(bijgewerkt)
    };
  } catch (error) {
    if (error.statusCode === 404) {
      context.res = { status: 404, body: { error: "Sollicitatie niet gevonden" } };
      return;
    }
    context.res = { status: 500, body: { error: "Kon sollicitatie niet bijwerken", debug: error.message } };
  }
};
