const fetch = require("node-fetch");

// Deze 4 waarden komen NIET hier in de code, maar staan als
// Application Settings in de Azure Static Web App (Configuratie).
const TENANT_ID = process.env.HR_TENANT_ID;
const CLIENT_ID = process.env.HR_CLIENT_ID;
const CLIENT_SECRET = process.env.HR_CLIENT_SECRET;
const GROUP_ID = process.env.HR_GROUP_ID;

const HR_ROLE = "hrbeheer";

// Static Web Apps roept deze Function aan na elke login, met de
// geverifieerde claims van de gebruiker. Wat hier wordt teruggegeven
// bepaalt de rollen van die gebruiker voor de rest van de sessie.
module.exports = async function (context, req) {
  const { identityProvider, userId } = req.body || {};

  // Alleen Microsoft-logins (Entra ID) komen in aanmerking, geen andere
  // providers.
  if (identityProvider !== "aad" || !userId) {
    context.res = { status: 200, body: { roles: [] } };
    return;
  }

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
      context.log.error("Kon geen Graph-token ophalen voor rollen-check", tokenData);
      context.res = { status: 200, body: { roles: [] } };
      return;
    }

    // Check of de ingelogde gebruiker lid is van de beveiligingsgroep
    // HR-Portaal-Toegang.
    const checkResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userId}/checkMemberGroups`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ groupIds: [GROUP_ID] })
      }
    );
    const checkData = await checkResponse.json();
    const isMember = Array.isArray(checkData.value) && checkData.value.includes(GROUP_ID);

    context.res = {
      status: 200,
      body: { roles: isMember ? [HR_ROLE] : [] }
    };
  } catch (error) {
    context.log.error("Onverwachte fout bij rollen-check", error.message);
    context.res = { status: 200, body: { roles: [] } };
  }
};
