const {
  getAfdelingshoofdenTableClient,
  normaliseerEmail,
  naarAfdelingenCsv,
  toDto,
  PARTITION_KEY
} = require("../shared/afdelingshoofdenTable");
const { ALLOWED_AFDELINGEN } = require("../shared/vacaturesTable");

const EMAIL_REGEX = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

// Beveiligd via /api/sollicitatiebeheer/* (hrbeheer-only). Maakt een
// afdelingshoofd aan, of werkt de afdeling(en) bij als het e-mailadres
// al bestaat ("upsert", geen apart create/update-onderscheid nodig voor
// zo'n kleine, handmatig beheerde tabel).
//
// Let op: dit regelt alleen WELKE afdeling(en) iemand ziet. Of iemand
// de rol "afdelingshoofd" krijgt bij het inloggen hangt af van
// lidmaatschap van de Entra-groep Afdelingshoofden-Toegang (zie
// GetRoles) — dat moet apart in Entra geregeld worden.
module.exports = async function (context, req) {
  const input = req.body || {};
  const email = normaliseerEmail(input.email);
  const afdelingen = Array.isArray(input.afdelingen) ? input.afdelingen : [];

  if (!email || !EMAIL_REGEX.test(email)) {
    context.res = { status: 400, body: { error: "Een geldig e-mailadres is verplicht" } };
    return;
  }
  const onbekendeAfdeling = afdelingen.find(a => !ALLOWED_AFDELINGEN.includes(a));
  if (onbekendeAfdeling) {
    context.res = {
      status: 400,
      body: { error: `Onbekende afdeling "${onbekendeAfdeling}", kies uit: ${ALLOWED_AFDELINGEN.join(", ")}` }
    };
    return;
  }

  try {
    const tableClient = await getAfdelingshoofdenTableClient();
    const entity = {
      partitionKey: PARTITION_KEY,
      rowKey: email,
      afdelingenCsv: naarAfdelingenCsv(afdelingen)
    };
    await tableClient.upsertEntity(entity, "Replace");

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: toDto(entity)
    };
  } catch (error) {
    context.res = { status: 500, body: { error: "Kon afdelingshoofd niet opslaan", debug: error.message } };
  }
};
