// Azure Static Web Apps geeft de geverifieerde gebruiker aan elke
// /api/*-aanroep mee via de "x-ms-client-principal"-header (base64-JSON),
// dezelfde info als /.auth/me clientside teruggeeft. Gebruikt om bij te
// houden wie een statuswijziging heeft gedaan (statusHistory).
function huidigeGebruiker(req) {
  const header = req.headers && req.headers["x-ms-client-principal"];
  if (!header) return "onbekend";
  try {
    const principal = JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
    return principal.userDetails || principal.userId || "onbekend";
  } catch {
    return "onbekend";
  }
}

// Of de ingelogde gebruiker een bepaalde rol heeft (bv. "hrbeheer").
// Gebruikt door endpoints die zelf open staan voor anonieme aanvragen
// (zoals CvUpload) maar binnen diezelfde Function anders willen reageren
// als de aanvraag toch al van een ingelogde HR-gebruiker komt.
function heeftRol(req, rol) {
  const header = req.headers && req.headers["x-ms-client-principal"];
  if (!header) return false;
  try {
    const principal = JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
    return Array.isArray(principal.userRoles) && principal.userRoles.includes(rol);
  } catch {
    return false;
  }
}

module.exports = { huidigeGebruiker, heeftRol };
