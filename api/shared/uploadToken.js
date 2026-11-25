const crypto = require("crypto");

// Dit zet een drempel op het publieke /api/cv-endpoint (CvUpload): zonder
// enige beveiliging kan een script dat endpoint los blijven aanroepen
// (bestandsgrootte/-type zijn al beperkt, maar er is geen limiet op het
// AANTAL uploads), puur opslag-/kostenmisbruik, zonder ooit een echte
// sollicitatie in te dienen. Een honeypot zoals bij SollicitatieCreate
// past hier niet: dit endpoint krijgt geen formuliervelden mee, alleen
// een bestandsnaam en de ruwe bytes.
//
// Aanpak: de statisch gegenereerde vacaturepagina's (zie
// scripts/generate-vacatures/generate.js, die 2x per dag opnieuw draait
// via de GitHub Actions-schedule) krijgen een token mee dat hier
// gevalideerd wordt. Zelfde beveiligingsniveau als de honeypot: dit houdt
// naïeve/geautomatiseerde misbruik tegen (rechtstreeks tegen de API
// scripten, zonder ooit een echte pagina geladen te hebben), geen garantie
// tegen een gerichte aanvaller die een pagina wél eerst laadt. Dat is een
// bewuste, geaccepteerde grens, net als bij de honeypot.
//
// CV_UPLOAD_TOKEN_SECRET moet op 2 plekken hetzelfde staan: als Azure
// Static Web App Application Setting (voor deze Function) én als GitHub
// Actions secret (voor de "Genereer vacature pagina's"-stap, zie
// azure-static-web-apps-*.yml). Zolang die niet is ingesteld, staat deze
// drempel bewust UIT (zie isIngeschakeld) i.p.v. per ongeluk alle echte
// uploads te blokkeren.
const SECRET = process.env.CV_UPLOAD_TOKEN_SECRET;

// 24 uur: ruim langer dan de 2x-daagse automatische paginaregeneratie
// (cron '0 9 * * *' / '0 14 * * *' in de deploy-workflow), kort genoeg
// dat een gekopieerd token niet eindeloos bruikbaar blijft.
const VENSTER_MS = 24 * 60 * 60 * 1000;

function isIngeschakeld() {
  return !!SECRET;
}

function tokenVoorVenster(vensterIndex) {
  return crypto.createHmac("sha256", SECRET).update(String(vensterIndex)).digest("hex");
}

// Gebruikt bij het genereren van de statische pagina's.
function genereerUploadToken() {
  if (!isIngeschakeld()) return "";
  return tokenVoorVenster(Math.floor(Date.now() / VENSTER_MS));
}

function veiligGelijk(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Geaccepteerd: het huidige venster en het vorige (marge voor pagina's
// die nog niet opnieuw gegenereerd zijn sinds de vensterovergang).
function isGeldigUploadToken(token) {
  if (!isIngeschakeld() || !token) return false;
  const huidigVenster = Math.floor(Date.now() / VENSTER_MS);
  return veiligGelijk(token, tokenVoorVenster(huidigVenster)) ||
    veiligGelijk(token, tokenVoorVenster(huidigVenster - 1));
}

module.exports = { isIngeschakeld, genereerUploadToken, isGeldigUploadToken };
