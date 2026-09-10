const { getVacaturesTableClient, toEntity, toVacatureDto } = require("../shared/vacaturesTable");

const TICK_SECRET = process.env.VACATURES_TICK_SECRET;

// Static Web Apps' managed Functions ondersteunen geen timer-triggers,
// dus dit is een gewone HTTP-Function die periodiek wordt aangeroepen
// door de GitHub Actions workflow (.github/workflows/vacatures-tick.yml),
// beveiligd met een gedeelde secret in plaats van een AAD-login.
//
// Zet "ingepland" om naar "gepubliceerd" zodra de publicatiedatum is
// bereikt, en "gepubliceerd" naar "gesloten" zodra de sluitingsdatum is
// verstreken.
module.exports = async function (context, req) {
  const meegestuurdeSecret = req.headers["x-tick-secret"];
  if (!TICK_SECRET || meegestuurdeSecret !== TICK_SECRET) {
    context.res = { status: 401, body: { error: "Ongeldige of ontbrekende secret" } };
    return;
  }

  const nu = new Date();
  const tableClient = await getVacaturesTableClient();

  const aantalGepubliceerd = await zetStatusOm(
    tableClient,
    "ingepland",
    "gepubliceerd",
    vacature => vacature.publicatiedatum && new Date(vacature.publicatiedatum) <= nu
  );
  const aantalGesloten = await zetStatusOm(
    tableClient,
    "gepubliceerd",
    "gesloten",
    vacature => vacature.sluitingsdatum && new Date(vacature.sluitingsdatum) <= nu
  );

  context.res = {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: { gepubliceerd: aantalGepubliceerd, gesloten: aantalGesloten }
  };
};

async function zetStatusOm(tableClient, vanStatus, naarStatus, voorwaarde) {
  let aantal = 0;

  for await (const entity of tableClient.listEntities({ queryOptions: { filter: `status eq '${vanStatus}'` } })) {
    const vacature = toVacatureDto(entity);
    if (!voorwaarde(vacature)) continue;

    const bijgewerkt = toEntity(
      vacature.id,
      { ...vacature, status: naarStatus },
      { createdAt: vacature.createdAt, updatedAt: new Date().toISOString() }
    );
    await tableClient.updateEntity(bijgewerkt, "Replace");
    aantal++;
  }

  return aantal;
}
