const fetch = require("node-fetch");

// Deze 6 waarden komen NIET hier in de code, maar staan als
// Application Settings in je Azure Static Web App (Configuratie).
const TENANT_ID = process.env.SP_TENANT_ID;
const CLIENT_ID = process.env.SP_CLIENT_ID;
const CLIENT_SECRET = process.env.SP_CLIENT_SECRET;
const SITE_HOSTNAME = process.env.SP_SITE_HOSTNAME;
const SITE_PATH = process.env.SP_SITE_PATH;
const LIST_NAME = process.env.SP_LIST_NAME;

// Haalt een bruikbare URL uit een Hyperlink kolom, die kan een object
// zijn ({ Url, Description }) of gewoon platte tekst.
function getHyperlinkUrl(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.Url) return value.Url;
  return "";
}

// Location kan soms een object teruggeven in plaats van platte tekst,
// dit haalt er altijd leesbare tekst uit, ongeacht het veldtype.
function getLocationText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.DisplayName) return value.DisplayName;
  if (value.Address && value.Address.City) return value.Address.City;
  return JSON.stringify(value);
}

module.exports = async function (context, req) {
  try {
    // Stap 1: access token ophalen bij Microsoft Entra ID
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

    // Stap 2: SharePoint site opzoeken
    const siteResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${SITE_HOSTNAME}:${SITE_PATH}`,
      { headers }
    );
    const siteData = await siteResponse.json();

    if (!siteData.id) {
      context.res = { status: 500, body: { error: "SharePoint site niet gevonden", debug: siteData } };
      return;
    }

    // Stap 3: de juiste lijst opzoeken op naam
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

    // Stap 4: items ophalen inclusief kolomwaarden
    const itemsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteData.id}/lists/${targetList.id}/items?expand=fields`,
      { headers }
    );
    const itemsData = await itemsResponse.json();

    // Ga naar ?keys=1 om de echte interne kolomnamen te zien.
    if (req.query.keys) {
      context.res = {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: itemsData.value[0] ? Object.keys(itemsData.value[0].fields) : []
      };
      return;
    }

    // Stap 5: omzetten naar de vaste output structuur.
    // Deze interne namen liggen vast sinds het aanmaken van de kolommen
    // in SharePoint, en veranderen niet meer door een label-wijziging.
    const vacatures = itemsData.value.map(item => {
      const f = item.fields;
      return {
        id: item.id,
        titel: f.Title,
        afdeling: f.Department,
        dienstverband: f.Dienstverband,
        standplaats: getLocationText(f.Standplaats),
        omschrijving: f.Functieomschrijving,
        salarisindicatie: f.Salaryindication,
        sluitingsdatum: f.Closingdate,
        headerafbeelding: getHyperlinkUrl(f.Headerafbeelding),
        actief: f.Active === true || f.Active === "Yes" || f.Active === 1
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