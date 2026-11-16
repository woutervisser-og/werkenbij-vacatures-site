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
//
// Nog niet gekoppeld: rolesSource ("auth" config in staticwebapp.config.json)
// vereist de Standard SKU van Azure Static Web Apps, die nu (bewust, om
// kosten) nog niet actief is. Zodra die upgrade er is, hier "rolesSource":
// "/api/GetRoles" weer toevoegen aan staticwebapp.config.json.
module.exports = async function (context, req) {
  const { identityProvider, userId } = req.body || {};
  // TIJDELIJK (diagnose toegangsprobleem, te verwijderen zodra opgelost):
  context.log("GetRoles aangeroepen", { identityProvider, userId });

  // Alleen Microsoft-logins (Entra ID) komen in aanmerking, geen andere
  // providers.
  if (identityProvider !== "aad" || !userId) {
    context.log("GetRoles: afgewezen vóór groepscheck (provider/userId)");
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
      context.log.error("Kon geen Graph-token ophalen voor rollen-check", {
        status: tokenResponse.status,
        tokenData
      });
      context.res = { status: 200, body: { roles: [] } };
      return;
    }

    // Check of de ingelogde gebruiker lid is van de beveiligingsgroep
    // HR-Portaal-Toegang. Gevraagd vanuit de groep zelf (in plaats van
    // "in welke groepen zit deze gebruiker") zodat alleen GroupMember.Read.All
    // nodig is, zonder apart leesrecht op het gebruikersobject.
    const checkResponse = await fetch(
      `https://graph.microsoft.com/v1.0/groups/${GROUP_ID}/members/${userId}/$ref`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );

    let isMember;
    if (checkResponse.status === 204) {
      isMember = true;
    } else if (checkResponse.status === 404) {
      isMember = false;
    } else {
      // TIJDELIJK: onverwachte status loggen, want zonder dit geeft een
      // fout hier stilletjes "geen lid" in plaats van een zichtbare reden.
      const errorBody = await checkResponse.text();
      context.log.error("Onverwachte respons bij groepscheck", {
        status: checkResponse.status,
        errorBody
      });
      isMember = false;
    }
    // TIJDELIJK (diagnose toegangsprobleem, te verwijderen zodra opgelost):
    context.log("Groepscheck resultaat", { status: checkResponse.status, isMember });

    context.res = {
      status: 200,
      body: { roles: isMember ? [HR_ROLE] : [] }
    };
  } catch (error) {
    context.log.error("Onverwachte fout bij rollen-check", error.message);
    context.res = { status: 200, body: { roles: [] } };
  }
};
