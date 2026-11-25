const {
  getSollicitatiesTableClient,
  toSollicitatieDto,
  PARTITION_KEY,
  EXIT_STATUSSEN,
  BEWAARTERMIJN_DAGEN,
  laatsteWijzigingTijdstip
} = require("../shared/sollicitatiesTable");
const { getCvBijlagenContainerClient } = require("../shared/cvBijlagenContainer");

// Hergebruikt dezelfde gedeelde secret als VacaturesTick (zie
// VACATURES_TICK_SECRET): Static Web Apps' managed Functions ondersteunen
// geen echte timer-triggers, dus ook dit is een gewone HTTP-Function die
// periodiek wordt aangeroepen door een GitHub Actions workflow.
const TICK_SECRET = process.env.VACATURES_TICK_SECRET;

// AVG-bewaartermijn (zie BEWAARTERMIJN_DAGEN in api/shared/sollicitatiesTable.js):
// verwijdert afgewezen/ingetrokken sollicitaties (incl. CV/motivatiebrief)
// die langer dan de bewaartermijn geleden voor het laatst van status
// wijzigden. Niet-afgewezen/ingetrokken sollicitaties worden nooit geraakt.
//
// ?proefdraai=1 laat precies zien wat verwijderd zou worden, zonder
// daadwerkelijk iets te verwijderen — gebruik dit om de logica te
// controleren voordat deze Function op een vaste planning gezet wordt
// (zie .github/workflows/sollicitaties-retentie.yml, die begint zonder
// automatische schedule, alleen handmatig te starten).
module.exports = async function (context, req) {
  const meegestuurdeSecret = req.headers["x-tick-secret"];
  if (!TICK_SECRET || meegestuurdeSecret !== TICK_SECRET) {
    context.res = { status: 401, body: { error: "Ongeldige of ontbrekende secret" } };
    return;
  }

  const proefdraai = req.query.proefdraai === "1" || req.query.proefdraai === "true";
  const grens = Date.now() - BEWAARTERMIJN_DAGEN * 24 * 60 * 60 * 1000;

  const tableClient = await getSollicitatiesTableClient();
  const containerClient = await getCvBijlagenContainerClient();

  const verwijderd = [];
  for await (const entity of tableClient.listEntities()) {
    if (!EXIT_STATUSSEN.includes(entity.status)) continue;

    const dto = toSollicitatieDto(entity);
    const tijdstip = laatsteWijzigingTijdstip(dto);
    if (!tijdstip || new Date(tijdstip).getTime() > grens) continue;

    verwijderd.push({
      id: entity.rowKey,
      naam: `${entity.voornaam || ""} ${entity.achternaam || ""}`.trim(),
      vacatureTitel: entity.vacatureTitel,
      status: entity.status,
      laatsteWijziging: tijdstip
    });

    if (!proefdraai) {
      await tableClient.deleteEntity(PARTITION_KEY, entity.rowKey);
      if (entity.cvNaam) {
        await containerClient.getBlockBlobClient(entity.cvNaam).deleteIfExists();
      }
      if (entity.motivatiebriefNaam) {
        await containerClient.getBlockBlobClient(entity.motivatiebriefNaam).deleteIfExists();
      }
    }
  }

  context.res = {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: { proefdraai, bewaartermijnDagen: BEWAARTERMIJN_DAGEN, aantalVerwijderd: verwijderd.length, verwijderd }
  };
};
