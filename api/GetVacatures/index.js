const fetch = require("node-fetch");

// Deze 5 waarden komen NIET hier in de code, maar staan als
// Application Settings in je Azure Static Web App (Configuratie).
const TENANT_ID = process.env.SP_TENANT_ID;
const CLIENT_ID = process.env.SP_CLIENT_ID;
const CLIENT_SECRET = process.env.SP_CLIENT_SECRET;
const SITE_HOSTNAME = process.env.SP_SITE_HOSTNAME;
const SITE_PATH = process.env.SP_SITE_PATH;
const LIST_NAME = process.env.SP_LIST_NAME;

// Zoekt een veldwaarde op basis van de weergavenaam, ongeacht of de
// interne naam spaties heeft, _x0020_ codering gebruikt, of afwijkt
// door hoofdletters. "Vacancy" matcht dus ook een interne naam "Title"
// via de extra aliassen hieronder.
function getField(fields, displayName, aliases = []) {
  const targets = [displayName, ...aliases].map(t => t.toLowerCase());
  for (const key of Object.keys(fields)) {
    const decoded = key.replace(/_x0020_/g, " ").toLowerCase();
    if (targets.includes(decoded) || targets.includes(key.toLowerCase())) {
      return fields[key];
    }
  }
  return undefined;
}

// Locatie kan een simpel tekstveld zijn, of een SharePoint "Location"
// kolom die een object teruggeeft. Dit haalt er altijd leesbare tekst uit.
function getLocationText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.DisplayName) return value.DisplayName;
  if (value.Address && value.Address.City) return value.Address.City;
  return JSON.stringify(value);
}

module.exports = async function (context, req) {
  try {
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials"
        })
      }
    );
    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      context.res = { status: 500, body: { error: "Kon niet authenticeren", debug: tokenData } };
      return;
    }

    const headers = { Authorization: `Bearer ${tokenData.access_token}` };

    const siteResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${SITE_HOSTNAME}:${SITE_PATH}`,
      { headers }
    );
    const siteData = await siteResponse.json();

    if (!siteData.id) {
      context.res = { status: 500, body: { error: "SharePoint site niet gevonden", debug: siteData } };
      return;
    }

    const listsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteData.id}/lists`,
      { headers }
    );
    const listsData = await listsResponse.json();
    const targetList = listsData.value.find(l => l.displayName === LIST_NAME);

    if (!targetList) {
      context.res = {
        status: 500,
        body: { error: `Lijst '${LIST_NAME}' niet gevonden`, beschikbare_lijsten: listsData.value.map(l => l.displayName) }
      };
      return;
    }

    const itemsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteData.id}/lists/${targetList.id}/items?expand=fields`,
      { headers }
    );
    const itemsData = await itemsResponse.json();

    // TIJDELIJK: ga naar ?keys=1 om alleen de kolomnamen te zien, dat is
    // korter en makkelijker te plakken dan de volledige data.
    if (req.query.keys) {
      context.res = {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: itemsData.value[0] ? Object.keys(itemsData.value[0].fields) : []
      };
      return;
    }

    const vacatures = itemsData.value.map(item => {
      const f = item.fields;
      return {
        titel: getField(f, "Vacancy", ["Title"]),
        afdeling: getField(f, "Department"),
        dienstverband: getField(f, "Employment"),
        standplaats: getLocationText(getField(f, "Location")),
        omschrijving: getField(f, "Description"),
        salarisindicatie: getField(f, "Salary indication"),
        actief: getField(f, "Active") === true || getField(f, "Active") === "Yes" || getField(f, "Active") === 1
      };
    });

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: vacatures
    };
  } catch (error) {
    context.res = { status: 500, body: { error: "Onverwachte fout", debug: error.message } };
  }
};