const { getVacaturesTableClient, toEntity, toVacatureDto } = require("../shared/vacaturesTable");

// Draait elk uur (zie function.json). Zet vacatures automatisch van
// "ingepland" naar "gepubliceerd" zodra de publicatiedatum is bereikt, en
// van "gepubliceerd" naar "gesloten" zodra de sluitingsdatum is verstreken.
module.exports = async function (context) {
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

  context.log(
    `VacaturesTimer: ${aantalGepubliceerd} vacature(s) gepubliceerd, ${aantalGesloten} vacature(s) gesloten.`
  );
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
