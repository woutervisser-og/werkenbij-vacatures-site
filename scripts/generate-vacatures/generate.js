const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

// De live site zelf, ipv rechtstreeks SharePoint/Graph API. Wordt in
// GitHub Actions gezet vanuit de repository variable SITE_URL (zodat een
// toekomstig custom domain een instelling is, geen code-wijziging). Kan
// lokaal ook overschreven worden (bijvoorbeeld tijdens testen tegen een
// lokale server) via de omgevingsvariabele VACATURES_API_URL.
//
// Verdraagt een SITE_URL zonder "https://" ervoor (een licht foutieve
// waarde in de repository variable is anders lastig te debuggen).
function metSchema(url) {
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

const VACATURES_API_URL = metSchema(
  process.env.VACATURES_API_URL || "victorious-sea-0b50b4303.7.azurestaticapps.net/api/GetVacatures"
);

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

// Waar de gegenereerde pagina's terechtkomen, relatief vanaf de repository root.
const OUTPUT_MAP = path.join(__dirname, "..", "..", "vacature");

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

function escapeHtml(tekst) {
  return String(tekst || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Zet platte tekst (uit een textarea in het beheerportaal) om naar
// alinea's, met behoud van enters.
function paragrafen(tekst) {
  const stukken = escapeHtml(tekst).split(/\n{2,}/).filter(Boolean);
  return stukken.map(stuk => `<p>${stuk.replace(/\n/g, "<br>")}</p>`).join("");
}

function inkorten(tekst, lengte = 160) {
  return tekst.length > lengte ? tekst.slice(0, lengte).trim() + "..." : tekst;
}

// Voor de meta-description en de JSON-LD "description": platte tekst
// uit het eerste tekstuele body-blok, geen HTML.
function vindSamenvatting(bodyBlokken) {
  const blok = (bodyBlokken || []).find(b => ["intro_gecentreerd", "intro_split", "tekst"].includes(b.type));
  const ruweTekst = (blok && (blok.tekst || blok.inhoud) || "").replace(/\s+/g, " ").trim();
  return inkorten(ruweTekst);
}

function salarisLabel(vacature) {
  if (vacature.salarisInOverleg) return "Salaris in overleg";
  if (vacature.salarisMin && vacature.salarisMax) return `€ ${vacature.salarisMin} - € ${vacature.salarisMax}`;
  if (vacature.salarisMin) return `Vanaf € ${vacature.salarisMin}`;
  if (vacature.salarisMax) return `Tot € ${vacature.salarisMax}`;
  return "";
}

// Vertaalt Dienstverband naar een van Google's vaste, toegestane
// employmentType waarden. Onbekende waarden vallen terug op "OTHER".
function naarEmploymentType(dienstverband) {
  const mapping = { Fulltime: "FULL_TIME", Parttime: "PART_TIME", Stage: "INTERN" };
  return mapping[dienstverband] || "OTHER";
}

function bouwJsonLd(vacature) {
  const jobPosting = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: vacature.titel,
    description: vindSamenvatting(vacature.bodyBlokken) || vacature.titel,
    datePosted: vacature.publicatiedatum || vacature.createdAt || undefined,
    validThrough: vacature.sluitingsdatum || undefined,
    employmentType: naarEmploymentType(vacature.dienstverband),
    hiringOrganization: {
      "@type": "Organization",
      name: "OG Clean Fuels",
      sameAs: "https://www.ogcleanfuels.com"
    }
  };

  // Locatie alleen meegeven als er daadwerkelijk een locatie is
  // ingevuld. Zonder locatie gebruiken we TELECOMMUTE, Google's
  // officiële manier om aan te geven dat een functie niet aan 1 vaste
  // locatie hangt.
  if (vacature.locatie) {
    jobPosting.jobLocation = {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: vacature.locatie, addressCountry: "NL" }
    };
  } else {
    jobPosting.jobLocationType = "TELECOMMUTE";
  }

  if (!vacature.salarisInOverleg && (vacature.salarisMin || vacature.salarisMax)) {
    jobPosting.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "EUR",
      value: {
        "@type": "QuantitativeValue",
        ...(vacature.salarisMin ? { minValue: vacature.salarisMin } : {}),
        ...(vacature.salarisMax ? { maxValue: vacature.salarisMax } : {}),
        unitText: "MONTH"
      }
    };
  }

  return JSON.stringify(jobPosting, null, 2);
}

// ===== Body-blokken renderen naar HTML =====

function renderSluitingsdatumBanner(vacature) {
  if (!vacature.sluitingsdatum) return "";
  const sluiting = new Date(vacature.sluitingsdatum);
  if (isNaN(sluiting)) return "";
  const dagenResterend = Math.ceil((sluiting - new Date()) / (1000 * 60 * 60 * 24));
  if (dagenResterend < 0) return "";
  const tekst =
    dagenResterend === 0 ? "Sluit vandaag" :
    dagenResterend === 1 ? "Sluit morgen" :
    `Nog ${dagenResterend} dagen om te solliciteren`;
  return `<a href="#solliciteer-blok" class="blok blok-sluitingsdatum-banner">${tekst}</a>`;
}

function renderBlok(blok, vacature) {
  switch (blok.type) {
    case "intro_gecentreerd":
      return `<div class="blok blok-intro-gecentreerd">
        ${blok.eyebrow ? `<span class="eyebrow">${escapeHtml(blok.eyebrow)}</span>` : ""}
        ${blok.kop ? `<h3>${escapeHtml(blok.kop)}</h3>` : ""}
        <div class="blok-tekstinhoud">${paragrafen(blok.tekst)}</div>
      </div>`;

    case "intro_split":
      return `<div class="blok blok-intro-split">
        <div class="blok-tekstinhoud">${paragrafen(blok.tekst)}</div>
        ${blok.uitgelicht ? `<div class="blok-uitgelicht">${escapeHtml(blok.uitgelicht)}</div>` : ""}
      </div>`;

    case "tekst":
      return `<div class="blok blok-tekst">
        ${blok.kop ? `<h3 class="blok-kop">${escapeHtml(blok.kop)}</h3>` : ""}
        ${paragrafen(blok.inhoud)}
      </div>`;

    case "tekst_kolommen":
      return `<div class="blok">
        ${blok.kop ? `<h3 class="blok-kop">${escapeHtml(blok.kop)}</h3>` : ""}
        <div class="blok-tekst-kolommen">
          <div>${paragrafen(blok.kolom1)}</div>
          <div>${paragrafen(blok.kolom2)}</div>
        </div>
      </div>`;

    case "uitgelichte_quote":
      return `<blockquote class="blok blok-quote">
        <div class="blok-quote-inner">
          <span class="blok-quote-mark" aria-hidden="true">&ldquo;</span>
          <p>${escapeHtml(blok.quote)}</p>
        </div>
      </blockquote>`;

    case "afbeelding_tekst":
      return `<div class="blok">
        ${blok.kop ? `<h3 class="blok-kop">${escapeHtml(blok.kop)}</h3>` : ""}
        <div class="blok-afbeelding-tekst blok-richting-${blok.richting === "rechts" ? "rechts" : "links"}">
          ${blok.afbeelding ? `<img src="${escapeHtml(blok.afbeelding)}" alt="">` : ""}
          <div class="blok-tekstinhoud">${paragrafen(blok.tekst)}</div>
        </div>
      </div>`;

    case "bullet_lijst":
      return `<div class="blok blok-bullets">
        ${blok.titel ? `<h4>${escapeHtml(blok.titel)}</h4>` : ""}
        <ul>
          ${(blok.punten || []).map(punt => `<li>${escapeHtml(punt.tekst)}</li>`).join("")}
        </ul>
      </div>`;

    case "arbeidsvoorwaarden_grid":
      return `<div class="blok blok-arbeidsvoorwaarden">
        ${(blok.items || []).map(item => `<div class="blok-arbeidsvoorwaarde">
          <span>${escapeHtml(item.tekst)}</span>
        </div>`).join("")}
      </div>`;

    case "collega_quote":
      return `<div class="blok blok-collega-quote">
        ${blok.foto ? `<img src="${escapeHtml(blok.foto)}" alt="${escapeHtml(blok.naam)}">` : ""}
        <div>
          <blockquote>${escapeHtml(blok.quote)}</blockquote>
          <div class="blok-collega-naam">${escapeHtml(blok.naam)}${blok.functie ? `, ${escapeHtml(blok.functie)}` : ""}</div>
        </div>
      </div>`;

    case "video_embed":
      return blok.url ? `<div class="blok blok-video">
        <iframe src="${escapeHtml(blok.url)}" allowfullscreen loading="lazy"></iframe>
      </div>` : "";

    case "team_voorstelling":
      return `<div class="blok blok-team">
        ${(blok.leden || []).map(lid => `<div class="blok-team-lid">
          ${lid.foto ? `<img src="${escapeHtml(lid.foto)}" alt="${escapeHtml(lid.voornaam)}">` : ""}
          <span>${escapeHtml(lid.voornaam)}</span>
        </div>`).join("")}
      </div>`;

    case "sollicitatieproces":
      return `<div class="blok blok-sollicitatieproces">
        ${(blok.stappen || []).map((stap, index) => `<div class="blok-stap">
          <span class="blok-stap-nummer">${index + 1}</span>
          <div>
            <h4>${escapeHtml(stap.titel)}</h4>
            <div>${paragrafen(stap.omschrijving)}</div>
          </div>
        </div>`).join("")}
      </div>`;

    case "veelgestelde_vragen":
      return `<div class="blok blok-faq">
        ${blok.kop ? `<h3 class="blok-kop">${escapeHtml(blok.kop)}</h3>` : ""}
        ${(blok.vragen || []).map(item => `<details>
          <summary>${escapeHtml(item.vraag)}</summary>
          <div>${paragrafen(item.antwoord)}</div>
        </details>`).join("")}
      </div>`;

    case "sluitingsdatum_banner":
      return renderSluitingsdatumBanner(vacature);

    default:
      return "";
  }
}

function renderBlokken(vacature) {
  return (vacature.bodyBlokken || []).map(blok => renderBlok(blok, vacature)).join("\n");
}

// De headerafbeelding/video als volle-breedte hero, met titel, meta-info
// en een "Solliciteer direct"-knop er rechtstreeks op overlayd (i.p.v.
// een losse titel-sectie eronder). Alleen gebruikt als er daadwerkelijk
// een header is; zonder header valt bouwHtmlPagina terug op een gewone
// titel-sectie (zie renderTitelSectie hieronder).
function renderVacatureHero(vacature, salaris) {
  const media = vacature.header.type === "video"
    ? `<div class="vacature-hero-media vacature-hero-video"><iframe src="${escapeHtml(vacature.header.bron)}" allowfullscreen loading="lazy"></iframe></div>`
    : `<img class="vacature-hero-media" src="${escapeHtml(vacature.header.bron)}" alt="${escapeHtml(vacature.titel)}">`;

  return `<div class="vacature-hero">
    ${media}
    <div class="vacature-hero-schaduw" aria-hidden="true"></div>
    <div class="vacature-hero-content">
      <span class="tag">${escapeHtml(vacature.afdeling || "Vacature")}</span>
      <h1>${escapeHtml(vacature.titel)}</h1>
      <div class="detail-meta">
        <span class="meta-pill">${escapeHtml(vacature.dienstverband || "")}</span>
        <span class="meta-pill">${escapeHtml(vacature.locatie || "")}</span>
        ${salaris ? `<span class="meta-pill">${escapeHtml(salaris)}</span>` : ""}
      </div>
      <a href="#solliciteer-blok" class="btn">Solliciteer direct!</a>
    </div>
  </div>`;
}

// Fallback zonder headerafbeelding: gewoon de titel + meta-info als
// platte sectie bovenaan de content, zoals voorheen.
function renderTitelSectie(vacature, salaris) {
  return `<div class="section-head reveal">
    <span class="tag">${escapeHtml(vacature.afdeling || "Vacature")}</span>
    <h2>${escapeHtml(vacature.titel)}</h2>
  </div>
  <div class="detail-meta reveal">
    <span class="meta-pill">${escapeHtml(vacature.dienstverband || "")}</span>
    <span class="meta-pill">${escapeHtml(vacature.locatie || "")}</span>
    ${salaris ? `<span class="meta-pill">${escapeHtml(salaris)}</span>` : ""}
  </div>`;
}

function renderBroodkruimel(vacature) {
  return `<nav class="broodkruimel" aria-label="Broodkruimelpad">
    <a href="/index.html">Home</a> <span class="scheiding" aria-hidden="true">/</span>
    <a href="/vacatures.html">Vacatures</a> <span class="scheiding" aria-hidden="true">/</span>
    <span>${escapeHtml(vacature.titel)}</span>
  </nav>`;
}

function bouwHtmlPagina(vacature) {
  const metaDescription = vindSamenvatting(vacature.bodyBlokken) || vacature.titel;
  const isFotoHeader = vacature.header && vacature.header.type !== "video" && vacature.header.bron;
  const heeftHeaderMedia = Boolean(vacature.header && vacature.header.bron);
  const salaris = salarisLabel(vacature);

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(vacature.titel)} | Werken bij OG Clean Fuels</title>
<meta name="description" content="${escapeHtml(metaDescription)}">

<meta property="og:title" content="${escapeHtml(vacature.titel)} | Werken bij OG Clean Fuels">
<meta property="og:description" content="${escapeHtml(metaDescription)}">
<meta property="og:type" content="website">
${isFotoHeader ? `<meta property="og:image" content="${escapeHtml(vacature.header.bron)}">` : ""}

<script type="application/ld+json">
${bouwJsonLd(vacature)}
</script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Open+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<style>
  .detail-meta { display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0; }
  .detail-omschrijving { max-width: 720px; font-size: 15.5px; color: #333; line-height: 1.7; }
  .detail-omschrijving p { margin-bottom: 16px; }
  .solliciteer-blok { background: var(--og-cream); border-radius: 12px; padding: 32px; max-width: 560px; margin-top: 40px; scroll-margin-top: 100px; }
  .form-veld { margin-bottom: 18px; }
  .form-veld label { display: block; font-weight: 700; font-size: 14px; margin-bottom: 6px; }
  .form-veld input, .form-veld textarea { width: 100%; padding: 10px 12px; border: 1px solid #ccc; border-radius: 6px; font-family: inherit; font-size: 14px; transition: border-color 0.2s ease; }
  .form-veld input:focus, .form-veld textarea:focus { border-color: var(--og-orange); outline: none; }
  .form-veld textarea { min-height: 100px; resize: vertical; }
  #form-status { margin-top: 14px; font-size: 14px; font-weight: 600; }
  #form-status.form-status-ok { color: var(--og-green-dark); }
  #form-status.form-status-fout { color: #b3261e; }
  .form-veld-fout { color: #b3261e; font-size: 13px; margin-top: 4px; }
  #sollicitatie-form fieldset[disabled] { opacity: 0.6; }

  .recruiter-blok {
    background: var(--og-cream);
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
<body class="${heeftHeaderMedia ? "pagina-met-hero" : ""}">

<header>
  <a href="/index.html" class="logo" aria-label="OG Clean Fuels, naar de homepage">
    <span class="logo-afbeelding-wrap">
      <img class="logo-afbeelding logo-afbeelding-wit" src="/images/logo/og-logo-wit.png" alt="">
      <img class="logo-afbeelding logo-afbeelding-kleur" src="/images/logo/og-logo-kleur.png" alt="OG Clean Fuels">
    </span>
  </a>
  <nav>
    <a href="/index.html">Home</a>
    <a href="/vacatures.html" class="active">Vacatures</a>
    <a href="/over-ons.html">Over ons</a>
  </nav>
</header>

${heeftHeaderMedia ? renderVacatureHero(vacature, salaris) : ""}
${renderBroodkruimel(vacature)}

<section class="content">
  ${!heeftHeaderMedia ? renderTitelSectie(vacature, salaris) : ""}

  <div class="detail-omschrijving reveal">${renderBlokken(vacature)}</div>

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

  <div class="solliciteer-blok reveal" id="solliciteer-blok">
    <h3 style="margin-bottom:20px;">Solliciteer <span class="titel-highlight">direct</span></h3>
    <form id="sollicitatie-form">
      <input type="hidden" name="vacatureId" value="${escapeHtml(vacature.id)}">
      <fieldset id="sollicitatie-velden" style="border:0;padding:0;margin:0;">
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
      </fieldset>
      <div id="form-status" role="status" aria-live="polite"></div>
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
  const response = await fetch(VACATURES_API_URL);
  if (!response.ok) {
    console.error("Kon vacatures niet ophalen:", response.status);
    process.exit(1);
  }
  const vacatures = await response.json();

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
