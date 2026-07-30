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

// LET OP: pas deze 2 namen aan zodra je de echte interne kolomnamen
// hebt gezien in de Actions log ("Beschikbare kolomnamen").
// Vaste recruiter gegevens, zelfde voor elke vacature. Pas hier aan
// zodra naam, contactgegevens of foto wijzigen.
const RECRUITER = {
  naam: "Iska van der Vlugt",
  functie: "HR",
  email: "vandervlugt@ogcleanfuels.com",
  telefoon: "+31612345678",       // gebruikt voor de "Bellen met" knop (tel: link)
  telefoonWeergave: "06 12 34 56 78",
  foto: "/images/iska-van-der-vlugt.webp"
};

const VELD_LAND = "Country";
const VELD_ADRES = "Workaddress";

// Waar de gegenereerde pagina's terechtkomen, relatief vanaf de repository root.
const OUTPUT_MAP = path.join(__dirname, "..", "..", "vacature");

function getHyperlinkUrl(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.Url) return value.Url;
  return "";
}

// Vertaalt Dienstverband naar een van Google's vaste, toegestane
// employmentType waarden. Onbekende waarden vallen terug op "OTHER".
function naarEmploymentType(dienstverband) {
  const mapping = {
    "Fulltime": "FULL_TIME",
    "Parttime": "PART_TIME",
    "Vast contract": "FULL_TIME",
    "Tijdelijk contract": "TEMPORARY",
    "Stage": "INTERN",
    "Internship": "INTERN",
    "Zzp/Freelance": "CONTRACTOR"
  };
  return mapping[dienstverband] || "OTHER";
}

// Zet een titel om naar een URL-vriendelijke "slug", bijvoorbeeld
// "Sales Manager B2B Clean Fuels" wordt "sales-manager-b2b-clean-fuels".
function maakSlug(tekst) {
  return (tekst || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // accenten weghalen
    .replace(/&/g, " en ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripHtml(html, lengte = 160) {
  const platteTekst = (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return platteTekst.length > lengte ? platteTekst.slice(0, lengte).trim() + "..." : platteTekst;
}

function bouwJsonLd(vacature) {
  const jobPosting = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: vacature.titel,
    description: vacature.omschrijving || "",
    datePosted: vacature.datumGeplaatst || undefined,
    validThrough: vacature.sluitingsdatum || undefined,
    employmentType: naarEmploymentType(vacature.dienstverband),
    hiringOrganization: {
      "@type": "Organization",
      name: "OG Clean Fuels",
      sameAs: "https://www.ogcleanfuels.com"
    }
  };

  // Adres alleen meegeven als er daadwerkelijk een adres is ingevuld.
  // Zonder adres gebruiken we TELECOMMUTE, Google's officiële manier
  // om aan te geven dat een functie niet aan 1 vaste locatie hangt.
  if (vacature.adres) {
    jobPosting.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        streetAddress: vacature.adres,
        addressCountry: vacature.land || ""
      }
    };
  } else {
    jobPosting.jobLocationType = "TELECOMMUTE";
  }

  if (vacature.salarisindicatie) {
    jobPosting.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "EUR",
      value: { "@type": "QuantitativeValue", value: vacature.salarisindicatie }
    };
  }

  return JSON.stringify(jobPosting, null, 2);
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

<script type="application/ld+json">
${bouwJsonLd(vacature)}
</script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Open+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<style>
  .header-afbeelding { width: 100%; height: 340px; object-fit: cover; display: block; }
  .detail-meta { display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0; }
  .detail-omschrijving { max-width: 720px; font-size: 15.5px; color: #333; line-height: 1.7; }
  .detail-omschrijving p { margin-bottom: 16px; }
  .solliciteer-blok { background: var(--og-grey); border-radius: 12px; padding: 32px; max-width: 560px; margin-top: 40px; }
  .form-veld { margin-bottom: 18px; }
  .form-veld label { display: block; font-weight: 700; font-size: 14px; margin-bottom: 6px; }
  .form-veld input, .form-veld textarea { width: 100%; padding: 10px 12px; border: 1px solid #ccc; border-radius: 6px; font-family: inherit; font-size: 14px; transition: border-color 0.2s ease; }
  .form-veld input:focus, .form-veld textarea:focus { border-color: var(--og-orange); outline: none; }
  .form-veld textarea { min-height: 100px; resize: vertical; }
  #form-status { margin-top: 14px; font-size: 14px; font-weight: 600; }

  .sfeer-galerij {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 14px;
    margin: 40px 0;
  }
  .sfeer-foto {
    width: 100%;
    height: 180px;
    object-fit: cover;
    border-radius: 10px;
    display: block;
    transition: transform 0.35s ease, filter 0.35s ease;
    filter: saturate(0.95);
  }
  .sfeer-foto:hover { transform: scale(1.04); filter: saturate(1.1); }

  .recruiter-blok {
    background: var(--og-grey);
    border-radius: 12px;
    padding: 32px;
    margin-top: 48px;
    display: flex;
    align-items: center;
    gap: 32px;
    flex-wrap: wrap;
  }
  .recruiter-foto-blok { text-align: center; flex-shrink: 0; }
  .recruiter-foto {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    object-fit: cover;
    display: block;
    margin: 0 auto 8px;
    border: 3px solid var(--og-orange);
  }
  .recruiter-naam { font-style: italic; font-size: 14px; }
  .recruiter-tekst { flex: 1; min-width: 240px; }
  .recruiter-tekst h3 { color: var(--og-orange-dark); font-size: 20px; margin-bottom: 10px; }
  .recruiter-tekst p { font-size: 14.5px; color: #333; margin-bottom: 6px; }
  .recruiter-tekst a { color: var(--og-orange-dark); font-weight: 600; }
  .recruiter-bel-btn {
    background: var(--og-white);
    color: var(--og-dark);
    font-weight: 700;
    padding: 14px 24px;
    border-radius: 8px;
    text-decoration: none;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(0,0,0,0.08);
    transition: transform 0.2s ease;
  }
  .recruiter-bel-btn:hover { transform: translateY(-2px); }
</style>
</head>
<body>

<header>
  <a href="/index.html" class="logo">o<span>g</span> clean fuels</a>
  <nav>
    <a href="/index.html">Home</a>
    <a href="/vacatures.html" class="active">Vacatures</a>
    <a href="/over-ons.html">Over ons</a>
  </nav>
</header>

${vacature.headerafbeelding ? `<img class="header-afbeelding" src="${vacature.headerafbeelding}" alt="${vacature.titel}">` : ""}

<section class="content">
  <div class="section-head reveal">
    <span class="tag">${vacature.afdeling || "Vacature"}</span>
    <h2>${vacature.titel}</h2>
  </div>

  <div class="detail-meta reveal">
    <span class="meta-pill">${vacature.dienstverband || ""}</span>
    <span class="meta-pill">${vacature.land || ""}</span>
    ${vacature.salarisindicatie ? `<span class="meta-pill">${vacature.salarisindicatie}</span>` : ""}
  </div>

  <div class="detail-omschrijving reveal">${vacature.omschrijving || ""}</div>

  <div class="sfeer-galerij reveal">
    <img class="sfeer-foto" src="/images/office-sfeer.webp" alt="Sfeerbeeld op kantoor bij OG Clean Fuels">
    <img class="sfeer-foto" src="/images/Servicemonteur-FR.webp" alt="Servicemonteur aan het werk in Frankrijk">
    <img class="sfeer-foto" src="/images/Wilco-theoffice.webp" alt="Collega op kantoor bij OG Clean Fuels">
    <img class="sfeer-foto" src="/images/servicetech-DE-1.webp" alt="Technicus aan het werk in Duitsland">
  </div>

  <div class="recruiter-blok reveal">
    <div class="recruiter-foto-blok">
      <img class="recruiter-foto" src="${RECRUITER.foto}" alt="${RECRUITER.naam}">
      <div class="recruiter-naam">${RECRUITER.naam},<br>${RECRUITER.functie}</div>
    </div>
    <div class="recruiter-tekst">
      <h3>Interesse of vragen over de functie?</h3>
      <p>Neem contact met ons op! ✉ <a href="mailto:${RECRUITER.email}">${RECRUITER.email}</a></p>
      <p>Voldoe je niet aan alle functie-eisen, maar spreekt de functie en onze missie je aan? Neem dan ook gerust contact op. We kijken graag verder dan alleen een cv.</p>
    </div>
    <a class="recruiter-bel-btn" href="tel:${RECRUITER.telefoon}">Bellen met ${RECRUITER.naam.split(" ")[0]} 📞</a>
  </div>

  <div class="solliciteer-blok reveal">
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

<script src="/animations.js"></script>
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

  // TIJDELIJK: toont de echte interne kolomnamen in de Actions log,
  // haal deze regel weer weg zodra de mapping klopt.
  if (itemsData.value[0]) {
    console.log("Beschikbare kolomnamen:", Object.keys(itemsData.value[0].fields));
  }

  const vacatures = itemsData.value
    .map(item => {
      const f = item.fields;
      return {
        id: item.id,
        titel: f.Title,
        afdeling: f.Department,
        dienstverband: f.Dienstverband,
        land: f[VELD_LAND],
        adres: f[VELD_ADRES],
        omschrijving: f.Functieomschrijving,
        salarisindicatie: f.Salaryindication,
        datumGeplaatst: f.Datum,
        sluitingsdatum: f.Closingdate,
        headerafbeelding: getHyperlinkUrl(f.Headerafbeelding),
        actief: f.Active === true || f.Active === "Yes" || f.Active === 1
      };
    })
    .filter(v => v.actief);

  if (!fs.existsSync(OUTPUT_MAP)) {
    fs.mkdirSync(OUTPUT_MAP, { recursive: true });
  }

  const gebruikteSlugs = new Set();

  vacatures.forEach(vacature => {
    let slug = maakSlug(vacature.titel) || String(vacature.id);

    // Bij 2 vacatures met (bijna) dezelfde titel, voorkom dat de 2e
    // per ongeluk de 1e overschrijft door het ID toe te voegen.
    if (gebruikteSlugs.has(slug)) {
      slug = `${slug}-${vacature.id}`;
    }
    gebruikteSlugs.add(slug);

    const bestandspad = path.join(OUTPUT_MAP, `${slug}.html`);
    fs.writeFileSync(bestandspad, bouwHtmlPagina(vacature));
    console.log(`Gegenereerd: vacature/${slug}.html`);
  });

  console.log(`Klaar, ${vacatures.length} vacature pagina's gegenereerd.`);
}

main().catch(error => {
  console.error("Onverwachte fout:", error);
  process.exit(1);
});