const fetch = require("node-fetch");

// Deze 5 waarden komen NIET hier in de code, maar staan als
// Application Settings in je Azure Static Web App (Configuratie).
// Zo staan je geheimen nooit in GitHub.
const TENANT_ID = process.env.SP_TENANT_ID;
const CLIENT_ID = process.env.SP_CLIENT_ID;
const CLIENT_SECRET = process.env.SP_CLIENT_SECRET;
const SITE_HOSTNAME = process.env.SP_SITE_HOSTNAME; // bijv. ogcleanfuels.sharepoint.com
const SITE_PATH = process.env.SP_SITE_PATH;         // bijv. /sites/hr
const LIST_NAME = process.env.SP_LIST_NAME;         // bijv. Vacatures

module.exports = async function (context, req) {
  try {
    // Stap 1: een access token ophalen bij Microsoft Entra ID
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
      context.log.error("Geen token ontvangen:", tokenData);
      context.res = { status: 500, body: { error: "Kon niet authenticeren bij Microsoft Graph", debug: tokenData } };
      return;
    }

    const accessToken = tokenData.access_token;
    const headers = { Authorization: `Bearer ${accessToken}` };

    // Stap 2: de SharePoint site ID opzoeken via hostname + pad
    const siteResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${SITE_HOSTNAME}:${SITE_PATH}`,
      { headers }
    );
    const siteData = await siteResponse.json();

    if (!siteData.id) {
      context.log.error("Site niet gevonden:", siteData);
      // TIJDELIJK: geeft de echte Graph foutmelding terug, zodat we kunnen
      // zien of dit een naamgevingsfout is of een ontbrekende consent.
      // Zet dit terug naar de simpele foutmelding zodra dit is opgelost.
      context.res = {
        status: 500,
        body: {
          error: "SharePoint site niet gevonden",
          debug: siteData,
          gebruikte_url: `https://graph.microsoft.com/v1.0/sites/${SITE_HOSTNAME}:${SITE_PATH}`
        }
      };
      return;
    }

    // Stap 3: de juiste lijst opzoeken op naam binnen die site
    const listsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteData.id}/lists`,
      { headers }
    );
    const listsData = await listsResponse.json();
    const targetList = listsData.value.find(l => l.displayName === LIST_NAME);

    if (!targetList) {
      context.log.error("Lijst niet gevonden, beschikbare lijsten:", listsData.value.map(l => l.displayName));
      context.res = {
        status: 500,
        body: {
          error: `Lijst '${LIST_NAME}' niet gevonden`,
          beschikbare_lijsten: listsData.value.map(l => l.displayName)
        }
      };
      return;
    }

    // Stap 4: de items uit die lijst ophalen, inclusief de kolomwaarden (fields)
    const itemsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteData.id}/lists/${targetList.id}/items?expand=fields`,
      { headers }
    );
    const itemsData = await itemsResponse.json();

    // Stap 5: omzetten naar dezelfde structuur als vacatures.json
    // LET OP: pas de veldnamen hieronder (bijv. fields.Titel) aan naar
    // de exacte interne kolomnamen zoals ze in jouw SharePoint lijst heten.
    const vacatures = itemsData.value.map(item => ({
      titel: item.fields.Title,
      afdeling: item.fields.Afdeling,
      dienstverband: item.fields.Dienstverband,
      standplaats: item.fields.Standplaats,
      omschrijving: item.fields.Functieomschrijving,
      salarisindicatie: item.fields.Salarisindicatie,
      actief: item.fields.Actief === true || item.fields.Actief === "Yes"
    }));

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: vacatures
    };
  } catch (error) {
    context.log.error("Onverwachte fout:", error);
    context.res = { status: 500, body: { error: "Er ging iets mis bij het ophalen van de vacatures", debug: error.message } };
  }
};