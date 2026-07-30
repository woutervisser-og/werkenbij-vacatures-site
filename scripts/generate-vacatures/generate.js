const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

// Deze waarden komen uit GitHub Actions secrets, niet uit de code zelf.
const TENANT_ID = process.env.SP_TENANT_ID;
const CLIENT_ID = process.env.SP_CLIENT_ID;
const CLIENT_SECRET = process.env.SP_CLIENT_SECRET;
const SITE_HOSTNAME = process.env.SP_SITE_HOSTNAME;
const SITE_PATH = process.env.SP_SITE_PATH;
const LIST_NAME = process.env.SP_LIST_NAME;

// Waar de gegenereerde pagina's terechtkomen, relatief vanaf de repository root.
const OUTPUT_MAP = path.join(__dirname, "..", "..", "vacature");

function getHyperlinkUrl(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.Url) return value.Url;
  return "";
}

function getLocationText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.DisplayName) return value.DisplayName;
  if (value.Address && value.Address.City) return value.Address.City;
  return "";
}

// Haalt platte tekst uit de rich-text HTML, voor de meta description.
function stripHtml(html, lengte = 160) {
  const platteTekst = (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return platteTekst.length > lengte ? platteTekst.slice(0, lengte).trim() + "..." : platteTekst;
}

function bouwHtmlPagina(vacature) {
  const metaDescription = stripHtml(vacature.omschrijving);

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${vacature.titel} | Werken bij OG Clean Fuels</title>
<meta name="description" content="${metaDescription}">

<meta property="og:title" content="${vacature.titel} | Werken bij OG Clean Fuels">
<meta property="og:description" content="${metaDescription}">
<meta property="og:type" content="website">
${vacature.headerafbeelding ? `<meta property="og:image" content="${vacature.headerafbeelding}">` : ""}

<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<style>
  .header-afbeelding { width: 100%; height: 320px; object-fit: cover; display: block; }
  .detail-meta { display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0; }
  .detail-omschrijving { max-width: 720px; font-size: 15.5px; color: #333; line-height: 1.7; }
  .detail-omschrijving p { margin-bottom: 16px; }
  .solliciteer-blok { background: var(--og-grey); border-radius: 10px; padding: 32px; max-width: 560px; margin-top: 40px; }
  .form-veld { margin-bottom: 18px; }
  .form-veld label { display: block; font-weight: 700; font-size: 14px; margin-bottom: 6px; }
  .form-veld input, .form-veld textarea { width: 100%; padding: 10px 12px; border: 1px solid #ccc; border-radius: 6px; font-family: inherit; font-size: 14px; }
  .form-veld textarea { min-height: 100px; resize: vertical; }
  #form-status { margin-top: 14px; font-size: 14px; font-weight: 600; }
</style>
</head>
<body>

<header>
  <a href="/index.html" class="logo">OG Clean Fuels</a>
  <nav>
    <a href="/index.html">Home</a>
    <a href="/vacatures.html" class="active">Vacatures</a>
    <a href="/over-ons.html">Over ons</a>
  </nav>
</header>

${vacature.headerafbeelding ? `<img class="header-afbeelding" src="${vacature.headerafbeelding}" alt="${vacature.titel}">` : ""}

<section class="content">
  <div class="section-head">
    <span class="tag">${vacature.afdeling || "Vacature"}</span>
    <h2>${vacature.titel}</h2>
  </div>

  <div class="detail-meta">
    <span class="meta-pill">${vacature.dienstverband || ""}</span>
    <span class="meta-pill">${vacature.standplaats || ""}</span>
    ${vacature.salarisindicatie ? `<span class="meta-pill">${vacature.salarisindicatie}</span>` : ""}
  </div>

  <div class="detail-omschrijving">${vacature.omschrijving || ""}</div>

  <div class="solliciteer-blok">
    <h3 style="margin-bottom:20px;">Solliciteer direct</h3>
    <form id="sollicitatie-form">
      <input type="hidden" name="vacancy" value="${vacature.titel}">
      <div class="form-veld">
        <label for="first_name">Voornaam</label>
        <input type="text" id="first_name" name="first_name" required>
      </div>
      <div class="form-veld">
        <label for="last_name">Achternaam</label>
        <input type="text" id="last_name" name="last_name" required>
      </div>
      <div class="form-veld">
        <label for="email">E-mailadres</label>
        <input type="email" id="email" name="email" required>
      </div>
      <div class="form-veld">
        <label for="tel">Telefoonnummer</label>
        <input type="tel" id="tel" name="tel">
      </div>
      <div class="form-veld">
        <label for="motivation">Motivatie (optioneel als je een motivatiebrief uploadt)</label>
        <textarea id="motivation" name="motivation"></textarea>
      </div>
      <div class="form-veld">
        <label for="cv">CV (PDF of Word, max 5MB)</label>
        <input type="file" id="cv" name="cv" accept=".pdf,.doc,.docx" required>
      </div>
      <div class="form-veld">
        <label for="motivation_letter">Motivatiebrief (optioneel, PDF of Word, max 5MB)</label>
        <input type="file" id="motivation_letter" name="motivation_letter" accept=".pdf,.doc,.docx">
      </div>
      <button type="submit" class="btn" id="submit-btn">Versturen</button>
      <div id="form-status"></div>
    </form>
  </div>
</section>

<footer>
  <span class="logo-footer">OG Clean Fuels</span>
  <p>&copy; 2026 OG Clean Fuels. Alle rechten voorbehouden.</p>
</footer>

<script src="/solliciteer.js"></script>
</body>
</html>
`;
}

async function main() {
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
    console.error("Kon niet authenticeren:", tokenData);
    process.exit(1);
  }
  const headers = { Authorization: `Bearer ${tokenData.access_token}` };

  const siteResponse = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${SITE_HOSTNAME}:${SITE_PATH}`,
    { headers }
  );
  const siteData = await siteResponse.json();
  if (!siteData.id) {
    console.error("Site niet gevonden:", siteData);
    process.exit(1);
  }

  const listsResponse = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteData.id}/lists`,
    { headers }
  );
  const listsData = await listsResponse.json();
  const targetList = listsData.value.find(l => l.displayName === LIST_NAME);
  if (!targetList) {
    console.error(`Lijst '${LIST_NAME}' niet gevonden.`);
    console.error("Beschikbare lijsten op deze site:", listsData.value.map(l => l.displayName));
    process.exit(1);
  }

  const itemsResponse = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteData.id}/lists/${targetList.id}/items?expand=fields`,
    { headers }
  );
  const itemsData = await itemsResponse.json();

  const vacatures = itemsData.value
    .map(item => {
      const f = item.fields;
      return {
        id: item.id,
        titel: f.Title,
        afdeling: f.Department,
        dienstverband: f.Dienstverband,
        standplaats: getLocationText(f.Standplaats),
        omschrijving: f.Functieomschrijving,
        salarisindicatie: f.Salaryindication,
        headerafbeelding: getHyperlinkUrl(f.Headerafbeelding),
        actief: f.Active === true || f.Active === "Yes" || f.Active === 1
      };
    })
    .filter(v => v.actief);

  if (!fs.existsSync(OUTPUT_MAP)) {
    fs.mkdirSync(OUTPUT_MAP, { recursive: true });
  }

  vacatures.forEach(vacature => {
    const bestandspad = path.join(OUTPUT_MAP, `${vacature.id}.html`);
    fs.writeFileSync(bestandspad, bouwHtmlPagina(vacature));
    console.log(`Gegenereerd: vacature/${vacature.id}.html`);
  });

  console.log(`Klaar, ${vacatures.length} vacature pagina's gegenereerd.`);
}

main().catch(error => {
  console.error("Onverwachte fout:", error);
  process.exit(1);
});