const sanitizeHtml = require("sanitize-html");
const {
  getSollicitatiesTableClient,
  toSollicitatieDto,
  PARTITION_KEY,
  ALLOWED_STATUSSEN,
  metNieuweStatusHistory
} = require("../shared/sollicitatiesTable");
const { huidigeGebruiker } = require("../shared/huidigeGebruiker");

// Notities komen binnen als HTML (rich-text editor in het beheerformulier,
// zie beheer/sollicitatie-dossier.html). Alleen de opmaak die de editor
// daadwerkelijk kan produceren is toegestaan, verder niks (geen attributen,
// geen script/style/etc.) — dit is opgeslagen HTML die later met
// innerHTML wordt getoond, dus zonder whitelist zou dit een opslagplek
// voor XSS worden.
function sanitizeerNotities(html) {
  return sanitizeHtml(html, {
    allowedTags: ["b", "strong", "i", "em", "u", "ul", "ol", "li", "br", "div", "p"],
    allowedAttributes: {}
  });
}

// Vanuit /beheer zijn de status en de notities te wijzigen (zie
// Sollicitatie-statussen in ARCHITECTUUR-HR-PORTAAL.md); de
// sollicitatiegegevens zelf staan vast zoals de kandidaat ze heeft
// ingediend. Beide velden zijn onafhankelijk van elkaar mee te geven
// (alleen status, alleen notities, of allebei). Een daadwerkelijke
// statuswijziging (niet dezelfde status opnieuw opslaan) krijgt er ook
// altijd een entry bij in statusHistory, de audit trail.
module.exports = async function (context, req) {
  const id = context.bindingData.id;
  const input = req.body || {};

  const heeftStatus = input.status !== undefined;
  const heeftNotities = input.notities !== undefined;

  if (!heeftStatus && !heeftNotities) {
    context.res = { status: 400, body: { error: "Geef status en/of notities mee om te wijzigen" } };
    return;
  }
  if (heeftStatus && !ALLOWED_STATUSSEN.includes(input.status)) {
    context.res = {
      status: 400,
      body: { error: `Ongeldige status, kies uit: ${ALLOWED_STATUSSEN.join(", ")}` }
    };
    return;
  }

  try {
    const tableClient = await getSollicitatiesTableClient();
    const bestaand = await tableClient.getEntity(PARTITION_KEY, id);
    const bijgewerkt = { ...bestaand };

    if (heeftStatus) {
      bijgewerkt.status = input.status;
      if (input.status !== bestaand.status) {
        bijgewerkt.statusHistoryJson = metNieuweStatusHistory(bestaand, {
          van: bestaand.status,
          naar: input.status,
          gebruiker: huidigeGebruiker(req)
        });
      }
    }
    if (heeftNotities) {
      bijgewerkt.notities = sanitizeerNotities(input.notities);
    }

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
