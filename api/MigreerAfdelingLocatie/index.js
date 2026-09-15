const {
  getVacaturesTableClient,
  toEntity,
  toVacatureDto,
  ALLOWED_AFDELINGEN,
  ALLOWED_LOCATIES
} = require("../shared/vacaturesTable");
const { triggerRebuild } = require("../shared/rebuildTrigger");

const TICK_SECRET = process.env.VACATURES_TICK_SECRET;

// Eenmalige migratie: afdeling/locatie gingen van vrije tekst naar een
// vaste lijst (zie ALLOWED_AFDELINGEN/ALLOWED_LOCATIES in
// shared/vacaturesTable.js). Zelfde beveiliging als VacaturesTick
// (gedeelde secret, want dit raakt productiedata) — eenmalig aan te
// roepen via GitHub Actions workflow_dispatch, niet op een schema.
//
// Mapt bestaande waarden waar mogelijk automatisch naar de nieuwe lijst
// (exacte match ongeacht hoofdletters/spaties/accenten, of een duidelijke
// substring-match); alles wat niet zeker genoeg is blijft ongewijzigd en
// komt terug in het "onduidelijk"-overzicht voor handmatige controle.
module.exports = async function (context, req) {
  const meegestuurdeSecret = req.headers["x-tick-secret"];
  if (!TICK_SECRET || meegestuurdeSecret !== TICK_SECRET) {
    context.res = { status: 401, body: { error: "Ongeldige of ontbrekende secret" } };
    return;
  }

  const tableClient = await getVacaturesTableClient();
  const rapport = {
    afdelingBijgewerkt: [],
    afdelingOnduidelijk: [],
    locatieBijgewerkt: [],
    locatieOnduidelijk: []
  };
  let aantalGewijzigd = 0;

  for await (const entity of tableClient.listEntities()) {
    const vacature = toVacatureDto(entity);
    let wijziging = false;
    const bijgewerkteVacature = { ...vacature };

    const afdelingMatch = vindMatch(vacature.department, ALLOWED_AFDELINGEN, ALIAS_AFDELING);
    if (afdelingMatch.status === "gewijzigd") {
      rapport.afdelingBijgewerkt.push({ id: vacature.id, titel: vacature.title, van: vacature.department, naar: afdelingMatch.waarde });
      bijgewerkteVacature.department = afdelingMatch.waarde;
      wijziging = true;
    } else if (afdelingMatch.status === "onduidelijk") {
      rapport.afdelingOnduidelijk.push({ id: vacature.id, titel: vacature.title, huidigeWaarde: vacature.department });
    }

    const locatieMatch = vindMatch(vacature.location, ALLOWED_LOCATIES, ALIAS_LOCATIE);
    if (locatieMatch.status === "gewijzigd") {
      rapport.locatieBijgewerkt.push({ id: vacature.id, titel: vacature.title, van: vacature.location, naar: locatieMatch.waarde });
      bijgewerkteVacature.location = locatieMatch.waarde;
      wijziging = true;
    } else if (locatieMatch.status === "onduidelijk") {
      rapport.locatieOnduidelijk.push({ id: vacature.id, titel: vacature.title, huidigeWaarde: vacature.location });
    }

    if (wijziging) {
      const bijgewerkteEntity = toEntity(
        vacature.id,
        bijgewerkteVacature,
        { createdAt: vacature.createdAt, updatedAt: new Date().toISOString() }
      );
      await tableClient.updateEntity(bijgewerkteEntity, "Replace");
      aantalGewijzigd++;
    }
  }

  if (aantalGewijzigd > 0) {
    await triggerRebuild(context);
  }

  context.res = {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: rapport
  };
};

// Bekende oude waarden die niet automatisch (via exacte of substring-
// match) naar de nieuwe lijst te herleiden zijn, maar wel een duidelijke
// betekenis hebben. Sleutel is de genormaliseerde oude waarde.
const ALIAS_AFDELING = {
  techniek: "Operations"
};
const ALIAS_LOCATIE = {
  utrecht: "Nederland (reizend)"
};

function normaliseer(tekst) {
  return (tekst || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, " ")
    .trim();
}

// "geen" (leeg veld, niets in te vullen), "exact" (staat al goed, geen
// wijziging nodig), "gewijzigd" (zeker genoeg gemapt), "onduidelijk"
// (geen confident match, blijft ongewijzigd staan voor handmatige check).
function vindMatch(huidigeWaarde, toegestaneWaarden, aliassen = {}) {
  if (!huidigeWaarde) return { status: "geen" };
  if (toegestaneWaarden.includes(huidigeWaarde)) return { status: "exact" };

  const genormaliseerd = normaliseer(huidigeWaarde);

  const exacteMatch = toegestaneWaarden.find(optie => normaliseer(optie) === genormaliseerd);
  if (exacteMatch) return { status: "gewijzigd", waarde: exacteMatch };

  const substringMatches = toegestaneWaarden.filter(optie => {
    const genormaliseerdeOptie = normaliseer(optie);
    return genormaliseerd.includes(genormaliseerdeOptie) || genormaliseerdeOptie.includes(genormaliseerd);
  });
  if (substringMatches.length === 1) return { status: "gewijzigd", waarde: substringMatches[0] };

  if (aliassen[genormaliseerd] && toegestaneWaarden.includes(aliassen[genormaliseerd])) {
    return { status: "gewijzigd", waarde: aliassen[genormaliseerd] };
  }

  return { status: "onduidelijk" };
}
