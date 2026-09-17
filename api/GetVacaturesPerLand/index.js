const { getVacaturesTableClient, toVacatureDto, LOCATIE_LANDCODE } = require("../shared/vacaturesTable");

// Landnaam (zoals die na de komma in "Stad, Land" staat) -> ISO 3166-1
// alpha-2. Dekt dezelfde landen als ALPHA2_NAAR_NAAM in europa-kaart.js,
// plus een paar veelvoorkomende alternatieve schrijfwijzen, voor Locatie-
// waarden die niet (meer) in de bekende LOCATIE_LANDCODE-lijst voorkomen
// (nieuwe kantoren, of oudere/afwijkende handmatige invoer).
const NAAM_NAAR_ALPHA2 = {
  "Albania": "AL", "Andorra": "AD", "Austria": "AT", "Belarus": "BY",
  "Belgium": "BE", "Bosnia and Herzegovina": "BA", "Bosnia & Herzegovina": "BA",
  "Bulgaria": "BG", "Croatia": "HR", "Cyprus": "CY", "Czechia": "CZ",
  "Czech Republic": "CZ", "Denmark": "DK", "Estonia": "EE",
  "Faroe Islands": "FO", "Finland": "FI", "France": "FR", "Germany": "DE",
  "Greece": "GR", "Hungary": "HU", "Iceland": "IS", "Ireland": "IE",
  "Italy": "IT", "Latvia": "LV", "Liechtenstein": "LI", "Lithuania": "LT",
  "Luxembourg": "LU", "Malta": "MT", "Moldova": "MD", "Monaco": "MC",
  "Montenegro": "ME", "Netherlands": "NL", "The Netherlands": "NL",
  "Holland": "NL", "Nederland": "NL", "North Macedonia": "MK",
  "Macedonia": "MK", "Norway": "NO", "Poland": "PL", "Portugal": "PT",
  "Romania": "RO", "San Marino": "SM", "Serbia": "RS", "Slovakia": "SK",
  "Slovenia": "SI", "Spain": "ES", "Sweden": "SE", "Switzerland": "CH",
  "Ukraine": "UA", "United Kingdom": "GB", "UK": "GB", "England": "GB",
  "Great Britain": "GB", "Vatican City": "VA", "Vatican": "VA",
  "Åland Islands": "AX"
};

// Parseert het landdeel uit "Stad, Land" — zelfde conventie als
// vacatures.html's landVoorVacature(): tweede, door komma gescheiden
// deel, met "Nederland (reizend)" als vaste uitzondering (geen komma).
function landNaamUitLocatie(locatie) {
  const waarde = (locatie || "").trim();
  if (!waarde) return null;
  if (waarde === "Nederland (reizend)") return "Netherlands";
  const delen = waarde.split(",");
  return delen.length > 1 ? delen[1].trim() : null;
}

// Eerst de exacte, al bestaande LOCATIE_LANDCODE-tabel proberen (dekt alle
// huidige kantoren + "Nederland (reizend)" met zekerheid), pas daarna de
// generieke split-en-lookup als terugval voor onbekende Locatie-waardes.
function alpha2VoorLocatie(locatie) {
  if (LOCATIE_LANDCODE[locatie]) return LOCATIE_LANDCODE[locatie];
  const landNaam = landNaamUitLocatie(locatie);
  return landNaam ? NAAM_NAAR_ALPHA2[landNaam] || null : null;
}

// Publieke, anonieme Function (net als GetVacatures): telt per land hoeveel
// GEPUBLICEERDE vacatures er zijn, voor de Europa-kaart op de homepage.
// Responseformaat afgestemd met europa-kaart.js:
//   { "tellingen": [{ "land": "FR", "aantal": 3 }, ...], "niet_gematcht": [...] }
// "niet_gematcht" bevat elke vacature waarvan de Locatie niet op "Stad, Land"
// te splitsen was, of waarvan het landdeel niet in de lookup-tabel stond —
// zodat die met titel/locatie zichtbaar zijn en handmatig opgeschoond of
// aan NAAM_NAAR_ALPHA2 toegevoegd kunnen worden.
module.exports = async function (context, req) {
  try {
    const tableClient = await getVacaturesTableClient();
    const perLand = {};
    const nietGematcht = [];

    for await (const entity of tableClient.listEntities({ queryOptions: { filter: "status eq 'gepubliceerd'" } })) {
      const vacature = toVacatureDto(entity);
      const locatie = vacature.location || "";
      const alpha2 = alpha2VoorLocatie(locatie);

      if (alpha2) {
        perLand[alpha2] = (perLand[alpha2] || 0) + 1;
      } else {
        nietGematcht.push({ id: vacature.id, titel: vacature.title, locatie });
      }
    }

    const tellingen = Object.keys(perLand)
      .sort()
      .map((land) => ({ land, aantal: perLand[land] }));

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: { tellingen, niet_gematcht: nietGematcht }
    };
  } catch (error) {
    context.res = {
      status: 500,
      body: { error: "Kon vacatures per land niet ophalen", debug: error.message }
    };
  }
};
