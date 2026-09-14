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

module.exports = { huidigeGebruiker };
