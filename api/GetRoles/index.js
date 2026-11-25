const fetch = require("node-fetch");
const { heeftAfdelingskoppeling } = require("../shared/afdelingshoofdenTable");

// Deze waarden komen NIET hier in de code, maar staan als Application
// Settings in de Azure Static Web App (Configuratie).
const TENANT_ID = process.env.HR_TENANT_ID;
const CLIENT_ID = process.env.HR_CLIENT_ID;
const CLIENT_SECRET = process.env.HR_CLIENT_SECRET;
const HR_GROUP_ID = process.env.HR_GROUP_ID;

const HR_ROLE = "hrbeheer";
const AFDELINGSHOOFD_ROLE = "afdelingshoofd";

// Check of userId lid is van groupId. Gevraagd vanuit de groep zelf (in
// plaats van "in welke groepen zit deze gebruiker") zodat alleen
// GroupMember.Read.All nodig is, zonder apart leesrecht op het
// gebruikersobject.
async function isLidVanGroep(context, accessToken, groupId, userId) {
  if (!groupId) return false;

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/groups/${groupId}/members/${userId}/$ref`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (response.status === 200 || response.status === 204) {
    // Graph geeft bij een gevonden lid 200 (met de referentie in de body)
    // terug, niet 204 zoals de documentatie voor $ref suggereert.
    return true;
  }
  if (response.status === 404) return false;

  // Onverwachte status (bijv. een permissieprobleem): loggen, want zonder
  // dit geeft dit stilletjes "geen lid" i.p.v. een zichtbare reden.
  const errorBody = await response.text();
  context.log.error("Onverwachte respons bij groepscheck", {
    groupId,
    status: response.status,
    errorBody
  });
  return false;
}

// Static Web Apps roept deze Function aan na elke login (gekoppeld via
// "auth.rolesSource" in staticwebapp.config.json), met de geverifieerde
// claims van de gebruiker. Wat hier wordt teruggegeven bepaalt de rollen
// van die gebruiker voor de rest van de sessie. Een gebruiker kan beide
// rollen tegelijk hebben (bv. HR die ook afdelingshoofd is).
//
// De afdelingshoofd-rol komt bewust niet (meer) uit een Entra-groep, maar
// rechtstreeks uit de Afdelingshoofden-koppeltabel die HR al beheert via
// beheer/afdelingshoofden.html. Zo kan HR zelf iemand als leidinggevende
// aanwijzen zonder dat daar een Entra-beheerder aan te pas hoeft te komen.
// hrbeheer blijft wel aan de Entra-groep gekoppeld, dat is een zwaardere
// rol (alle vacatures/sollicitaties) die bewust apart beheerd wordt.
module.exports = async function (context, req) {
  const { identityProvider, userId, userDetails } = req.body || {};

  // Alleen Microsoft-logins (Entra ID) komen in aanmerking, geen andere
  // providers.
  if (identityProvider !== "aad" || !userId) {
    context.res = { status: 200, body: { roles: [] } };
    return;
  }

  const roles = [];

  // Losse try/catch per rol: een fout in de ene check mag de andere rol
  // niet laten vervallen (en een fout betekent hier altijd "geen rol",
  // nooit "wel toegang").
  try {
    if (await heeftAfdelingskoppeling(userDetails)) roles.push(AFDELINGSHOOFD_ROLE);
  } catch (error) {
    context.log.error("Onverwachte fout bij afdelingshoofd-koppelcheck", error.message);
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
    } else if (await isLidVanGroep(context, tokenData.access_token, HR_GROUP_ID, userId)) {
      roles.push(HR_ROLE);
    }
  } catch (error) {
    context.log.error("Onverwachte fout bij rollen-check", error.message);
  }

  context.res = { status: 200, body: { roles } };
};
