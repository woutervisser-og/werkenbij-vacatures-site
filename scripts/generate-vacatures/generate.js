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

// Publieke basis-URL van de site zelf (voor hreflang-tags), afgeleid van
// VACATURES_API_URL i.p.v. een aparte omgevingsvariabele, zodat er geen
// extra workflow-wijziging nodig is.
const SITE_BASE_URL = VACATURES_API_URL.replace(/\/api\/GetVacatures$/, "");

// Meertaligheid: EN is de verplichte basistaal, de rest optioneel per
// vacature. Moet in sync blijven met ONDERSTEUNDE_TALEN in
// api/shared/vacaturesTable.js (los gehouden, want dit script draait als
// standalone Node-script buiten de Functions-app om).
const ONDERSTEUNDE_TALEN = ["en", "nl", "fr", "de", "it", "se"];

// ===== Site-chrome-vertalingen (menu, footer, knoppen, formulier) =====
// Dit script genereert, anders dan de algemene pagina's (index.html etc.,
// die client-side i18n/i18n.js gebruiken omdat ze 1 fysiek bestand voor
// alle talen delen), al een apart fysiek bestand per taal — dus wordt de
// chrome-tekst hier gewoon rechtstreeks bij het bouwen ingevuld, uit
// dezelfde /i18n/<taal>.json-bestanden als de rest van de site. Geen
// aparte runtime-JS nodig op deze pagina's.
const I18N_MAP = path.join(__dirname, "..", "..", "i18n");
const i18nCache = {};

function leesI18nBestand(taalcode) {
  if (!i18nCache[taalcode]) {
    try {
      i18nCache[taalcode] = JSON.parse(fs.readFileSync(path.join(I18N_MAP, `${taalcode}.json`), "utf8"));
    } catch {
      i18nCache[taalcode] = {};
    }
  }
  return i18nCache[taalcode];
}

function zoekVertaalKey(dict, key) {
  return key.split(".").reduce((acc, deel) => (acc && typeof acc === "object" ? acc[deel] : undefined), dict);
}

// Bouwt een t(key, vervangingen)-functie voor 1 specifieke taal: valt
// terug op EN als een key in die taal ontbreekt of leeg is (fr/de/it/se
// zijn nog niet volledig gevuld), zodat er nooit een lege tekst in de
// gegenereerde HTML terechtkomt.
function maakVertaler(taalcode) {
  const eigenDict = leesI18nBestand(taalcode);
  const basisDict = taalcode === "en" ? eigenDict : leesI18nBestand("en");
  return function t(key, vervangingen) {
    let tekst = zoekVertaalKey(eigenDict, key);
    if (tekst === undefined || tekst === "") tekst = zoekVertaalKey(basisDict, key);
    if (tekst === undefined || tekst === "") tekst = key;
    if (vervangingen) {
      Object.keys(vervangingen).forEach(naam => {
        tekst = tekst.replace(new RegExp(`\\{\\{${naam}\\}\\}`, "g"), vervangingen[naam]);
      });
    }
    return tekst;
  };
}

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

// Waar de gegenereerde pagina's terechtkomen, relatief vanaf de repository
// root: elke taal (óók EN) in zijn eigen submap ("en/vacature/",
// "nl/vacature/", ...) — volledig symmetrisch, geen enkele taal zonder
// prefix. De kale /vacature/<slug>.html van vóór deze wijziging bestaat
// niet meer als fysiek bestand; staticwebapp.config.json regelt de
// algemene /en//nl/-routing voor de rest van de site, maar een generieke
// wildcard-redirect voor oude /vacature/-links is met SWA's routing niet
// haalbaar (geen capture-group-rewrites), dus die blijven daadwerkelijk
// niet meer werken.
function outputMapVoorTaal(taalcode) {
  return path.join(__dirname, "..", "..", taalcode, "vacature");
}

// Site-relatief pad (voor de taalswitcher op de pagina zelf, werkt op elk
// domein) en de volledige publieke URL (voor hreflang-tags, die moeten
// absoluut zijn) delen dezelfde segment-logica.
function padVoorTaal(taalcode, slug) {
  return `/${taalcode}/vacature/${slug}.html`;
}

function publiekeUrlVoorTaal(taalcode, slug) {
  return `${SITE_BASE_URL}${padVoorTaal(taalcode, slug)}`;
}

// Voor de algemene site-pagina's (nav/breadcrumb-links vanuit de
// vacature-template): dezelfde /<taal>/<bestand>-conventie.
function padVoorAlgemenePagina(taalcode, bestand) {
  return `/${taalcode}/${bestand}`;
}

function renderHreflangTags(beschikbareTalen, slug) {
  const tags = beschikbareTalen.map(taal =>
    `<link rel="alternate" hreflang="${taal}" href="${publiekeUrlVoorTaal(taal, slug)}">`
  );
  tags.push(`<link rel="alternate" hreflang="x-default" href="${publiekeUrlVoorTaal("en", slug)}">`);
  return tags.join("\n");
}

const TAAL_LABELS = { en: "EN", nl: "NL", fr: "FR", de: "DE", it: "IT", se: "SE" };
const TAAL_VLAGGEN = { en: "🇬🇧", nl: "🇳🇱", fr: "🇫🇷", de: "🇩🇪", it: "🇮🇹", se: "🇸🇪" };

const GLOBE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
const CHEVRON_SVG = `<svg class="taal-nav-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

// Taal-selector in de header (zelfde component/CSS als de 5 marketing-
// pagina's, zie i18n/i18n.js en styles.css), maar hier gebakken op
// build-time: toont alleen de talen die voor déze vacature daadwerkelijk
// gegenereerd zijn (beschikbareTalen komt uit dezelfde filtering als de
// hreflang-tags). Geen selector tonen als er toch niets te wisselen valt
// (alleen EN gevuld).
function renderTaalNavSelector(huidigeTaal, beschikbareTalen, slug) {
  if (beschikbareTalen.length <= 1) return "";
  const items = beschikbareTalen.map(taal => {
    const label = TAAL_LABELS[taal] || taal.toUpperCase();
    const vlag = TAAL_VLAGGEN[taal] || "";
    const actiefClass = taal === huidigeTaal ? " taal-nav-actief" : "";
    return `<a href="${padVoorTaal(taal, slug)}" class="${actiefClass.trim()}" role="menuitem"><span class="taal-nav-vlag">${vlag}</span> ${label}</a>`;
  });
  return `
    <div class="taal-nav-selector">
      <button class="taal-nav-knop" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Taal">
        ${GLOBE_SVG}
        <span class="taal-nav-code">${TAAL_LABELS[huidigeTaal] || huidigeTaal.toUpperCase()}</span>
        ${CHEVRON_SVG}
      </button>
      <div class="taal-nav-lijst" role="menu">${items.join("\n")}</div>
    </div>`;
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

// Geeft direct de kant-en-klare <span class="meta-pill">-HTML terug (of
// "" als er geen salaris is). De platte "€ X - € Y"-range is bewust niet
// vertaald: dat is valuta-notatie, geen tekst.
function salarisLabel(vacature, t) {
  if (vacature.salarisInOverleg) {
    return `<span class="meta-pill">${t("vacature.salarisInOverleg")}</span>`;
  }
  if (vacature.salarisMin && vacature.salarisMax) {
    return `<span class="meta-pill">€ ${vacature.salarisMin} - € ${vacature.salarisMax}</span>`;
  }
  if (vacature.salarisMin) {
    return `<span class="meta-pill">${t("vacature.salarisVanaf", { bedrag: vacature.salarisMin })}</span>`;
  }
  if (vacature.salarisMax) {
    return `<span class="meta-pill">${t("vacature.salarisTot", { bedrag: vacature.salarisMax })}</span>`;
  }
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
function renderVacatureHero(vacature, salaris, t) {
  const media = vacature.header.type === "video"
    ? `<div class="vacature-hero-media vacature-hero-video"><iframe src="${escapeHtml(vacature.header.bron)}" allowfullscreen loading="lazy"></iframe></div>`
    : `<img class="vacature-hero-media" src="${escapeHtml(vacature.header.bron)}" alt="${escapeHtml(vacature.titel)}">`;

  return `<div class="vacature-hero">
    ${media}
    <div class="vacature-hero-schaduw" aria-hidden="true"></div>
    <div class="vacature-hero-content">
      <span class="tag">${escapeHtml(vacature.afdeling || t("vacature.tagFallback"))}</span>
      <h1>${escapeHtml(vacature.titel)}</h1>
      <div class="detail-meta">
        <span class="meta-pill">${escapeHtml(vacature.dienstverband || "")}</span>
        <span class="meta-pill">${escapeHtml(vacature.locatie || "")}</span>
        ${salaris}
      </div>
      <a href="#solliciteer-blok" class="btn">${t("vacature.solliciteerDirect")}</a>
    </div>
  </div>`;
}

// Fallback zonder headerafbeelding: gewoon de titel + meta-info als
// platte sectie bovenaan de content, zoals voorheen.
function renderTitelSectie(vacature, salaris, t) {
  return `<div class="section-head reveal">
    <span class="tag">${escapeHtml(vacature.afdeling || t("vacature.tagFallback"))}</span>
    <h2>${escapeHtml(vacature.titel)}</h2>
  </div>
  <div class="detail-meta reveal">
    <span class="meta-pill">${escapeHtml(vacature.dienstverband || "")}</span>
    <span class="meta-pill">${escapeHtml(vacature.locatie || "")}</span>
    ${salaris}
  </div>`;
}

function renderBroodkruimel(vacature, taalcode, t) {
  return `<nav class="broodkruimel" aria-label="Broodkruimelpad">
    <a href="${padVoorAlgemenePagina(taalcode, "index.html")}">${t("breadcrumb.home")}</a> <span class="scheiding" aria-hidden="true">/</span>
    <a href="${padVoorAlgemenePagina(taalcode, "vacatures.html")}">${t("nav.vacatures")}</a> <span class="scheiding" aria-hidden="true">/</span>
    <span>${escapeHtml(vacature.titel)}</span>
  </nav>`;
}

function bouwHtmlPagina(vacature, { taalcode, beschikbareTalen, slug }) {
  const t = maakVertaler(taalcode);
  const metaDescription = vindSamenvatting(vacature.bodyBlokken) || vacature.titel;
  const isFotoHeader = vacature.header && vacature.header.type !== "video" && vacature.header.bron;
  const heeftHeaderMedia = Boolean(vacature.header && vacature.header.bron);
  const salaris = salarisLabel(vacature, t);
  const titelSuffix = t("meta.titelSuffix");

  return `<!DOCTYPE html>
<html lang="${taalcode}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(vacature.titel)} | ${escapeHtml(titelSuffix)}</title>
<meta name="description" content="${escapeHtml(metaDescription)}">

<meta property="og:title" content="${escapeHtml(vacature.titel)} | ${escapeHtml(titelSuffix)}">
<meta property="og:description" content="${escapeHtml(metaDescription)}">
<meta property="og:type" content="website">
${isFotoHeader ? `<meta property="og:image" content="${escapeHtml(vacature.header.bron)}">` : ""}

${renderHreflangTags(beschikbareTalen, slug)}

<script type="application/ld+json">
${bouwJsonLd(vacature)}
</script>

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
</style>
</head>
<body class="${heeftHeaderMedia ? "pagina-met-hero" : ""}">

<header>
  <a href="${padVoorAlgemenePagina(taalcode, "index.html")}" class="logo" aria-label="OG Clean Fuels, naar de homepage">
    <span class="logo-afbeelding-wrap">
      <img class="logo-afbeelding logo-afbeelding-wit" src="/images/logo/og-logo-wit.png" alt="">
      <img class="logo-afbeelding logo-afbeelding-kleur" src="/images/logo/og-logo-kleur.png" alt="OG Clean Fuels">
    </span>
  </a>
  <nav>
    <a href="${padVoorAlgemenePagina(taalcode, "vacatures.html")}" class="active">${t("nav.vacatures")}</a>
    <a href="${padVoorAlgemenePagina(taalcode, "werken-bij-og.html")}">${t("nav.werkenBijOg")}</a>
    <a href="${padVoorAlgemenePagina(taalcode, "over-ons.html")}">${t("nav.overOns")}</a>
    <a href="${padVoorAlgemenePagina(taalcode, "contact.html")}">${t("nav.contact")}</a>
    <a href="https://www.ogcleanfuels.com" target="_blank" rel="noopener">${t("nav.corporateSite")}</a>
  </nav>
  <div class="header-rechts">${renderTaalNavSelector(taalcode, beschikbareTalen, slug)}
    <button type="button" class="hamburger-knop" id="hamburger-knop" aria-label="Menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  </div>
</header>

${heeftHeaderMedia ? renderVacatureHero(vacature, salaris, t) : ""}
${renderBroodkruimel(vacature, taalcode, t)}

<section class="content">
  ${!heeftHeaderMedia ? renderTitelSectie(vacature, salaris, t) : ""}

  <div class="detail-omschrijving reveal">${renderBlokken(vacature)}</div>

  <div class="recruiter-blok reveal">
    <div class="recruiter-foto-blok">
      <img class="recruiter-foto" src="${RECRUITER.foto}" alt="${RECRUITER.naam}">
      <div class="recruiter-naam">${RECRUITER.naam},<br>${RECRUITER.functie}</div>
    </div>
    <div class="recruiter-tekst">
      <h3>${t("recruiter.vraagKop")}</h3>
      <p>✉ <a href="mailto:${RECRUITER.email}">${RECRUITER.email}</a></p>
      <p>${t("recruiter.contactUitleg")}</p>
    </div>
    <a class="recruiter-bel-btn" href="tel:${RECRUITER.telefoon}">${t("recruiter.bellenMet", { naam: RECRUITER.naam.split(" ")[0] })}</a>
  </div>

  <div class="solliciteer-blok reveal" id="solliciteer-blok">
    <h3 style="margin-bottom:20px;"><span class="titel-highlight">${t("form.titel")}</span></h3>
    <form id="sollicitatie-form">
      <input type="hidden" name="vacatureId" value="${escapeHtml(vacature.id)}">
      <fieldset id="sollicitatie-velden" style="border:0;padding:0;margin:0;">
      <div class="form-veld">
        <label for="first_name">${t("form.voornaam")}</label>
        <input type="text" id="first_name" name="first_name" required>
      </div>
      <div class="form-veld">
        <label for="last_name">${t("form.achternaam")}</label>
        <input type="text" id="last_name" name="last_name" required>
      </div>
      <div class="form-veld">
        <label for="email">${t("form.email")}</label>
        <input type="email" id="email" name="email" required>
      </div>
      <div class="form-veld">
        <label for="tel">${t("form.telefoon")}</label>
        <input type="tel" id="tel" name="tel">
      </div>
      <div class="form-veld">
        <label for="motivation">${t("form.motivatieLabel")}</label>
        <textarea id="motivation" name="motivation"></textarea>
      </div>
      <div class="form-veld">
        <label for="cv">${t("form.cvLabel")}</label>
        <input type="file" id="cv" name="cv" accept=".pdf,.doc,.docx" required>
      </div>
      <div class="form-veld">
        <label for="motivation_letter">${t("form.motivatiebriefLabel")}</label>
        <input type="file" id="motivation_letter" name="motivation_letter" accept=".pdf,.doc,.docx">
      </div>
      <button type="submit" class="btn" id="submit-btn">${t("form.versturen")}</button>
      </fieldset>
      <div id="form-status" role="status" aria-live="polite"></div>
    </form>
  </div>
</section>

<footer>
  <div class="footer-content">
    <div class="footer-kolom">
      <span class="logo-footer">OG Clean Fuels</span>
      <p class="footer-tagline">${t("common.labelBold")}. ${t("common.labelEager")}. ${t("common.labelHuman")}.</p>
    </div>
    <div class="footer-kolom">
      <span class="footer-kop">${t("footer.menuKop")}</span>
      <nav class="footer-nav">
        <a href="${padVoorAlgemenePagina(taalcode, "vacatures.html")}">${t("nav.vacatures")}</a>
        <a href="${padVoorAlgemenePagina(taalcode, "werken-bij-og.html")}">${t("nav.werkenBijOg")}</a>
        <a href="${padVoorAlgemenePagina(taalcode, "over-ons.html")}">${t("nav.overOns")}</a>
        <a href="${padVoorAlgemenePagina(taalcode, "contact.html")}">${t("nav.contact")}</a>
      </nav>
    </div>
    <div class="footer-kolom">
      <span class="footer-kop">${t("nav.contact")}</span>
      <a href="mailto:${RECRUITER.email}">${RECRUITER.email}</a>
      <a href="tel:${RECRUITER.telefoon}">${RECRUITER.telefoonWeergave}</a>
      <a href="https://www.ogcleanfuels.com" target="_blank" rel="noopener">${t("nav.corporateSite")}</a>
    </div>
  </div>
  <div class="footer-onder">
    <p>${t("footer.copyright")}</p>
  </div>
</footer>

<script>
  window.OG_FORM_TEKSTEN = ${JSON.stringify({
    cvVeldnaam: t("form.cvVeldnaam"),
    motivatiebriefVeldnaam: t("form.motivatiebriefVeldnaam"),
    cvVerplicht: t("form.cvVerplicht"),
    bestandTypeFout: t("form.bestandTypeFout"),
    bestandGrootteFout: t("form.bestandGrootteFout"),
    versturen: t("form.versturen"),
    bezigMetVersturen: t("form.bezigMetVersturen"),
    succes: t("form.succes"),
    fout: t("form.fout")
  })};
</script>
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

  const gebruikteSlugs = new Set();
  let aantalPaginas = 0;

  vacatures.forEach(vacature => {
    // EN-vertaling, met terugval op de platte (NL-alias) velden voor een
    // vacature die (nog) geen "translations"-object heeft.
    const enVertaling = (vacature.translations && vacature.translations.en) ||
      { title: vacature.titel, bodyBlocks: vacature.bodyBlokken || [] };
    const talenData = vacature.translations || { en: enVertaling };

    // 1 slug per vacature, gebaseerd op de EN-titel: dezelfde slug wordt
    // in elke taal-submap hergebruikt, zodat de taalswitcher straks simpel
    // de taalprefix kan wisselen i.p.v. een aparte mapping te moeten
    // bijhouden.
    let slug = maakSlug(enVertaling.title) || String(vacature.id);
    if (gebruikteSlugs.has(slug)) {
      slug = `${slug}-${vacature.id}`;
    }
    gebruikteSlugs.add(slug);

    // Alleen talen die daadwerkelijk een titel hebben genereren: geen lege
    // pagina's voor een taal die voor déze vacature nog niet vertaald is.
    const beschikbareTalen = ONDERSTEUNDE_TALEN.filter(taal => talenData[taal] && talenData[taal].title);
    if (!beschikbareTalen.includes("en")) beschikbareTalen.unshift("en");

    beschikbareTalen.forEach(taalcode => {
      const vertaling = talenData[taalcode] || enVertaling;
      const vertaaldeVacature = {
        ...vacature,
        titel: vertaling.title,
        bodyBlokken: vertaling.bodyBlocks || []
      };

      const outputMap = outputMapVoorTaal(taalcode);
      if (!fs.existsSync(outputMap)) {
        fs.mkdirSync(outputMap, { recursive: true });
      }

      const bestandspad = path.join(outputMap, `${slug}.html`);
      const html = bouwHtmlPagina(vertaaldeVacature, { taalcode, beschikbareTalen, slug });
      fs.writeFileSync(bestandspad, html);

      console.log(`Gegenereerd: ${taalcode}/vacature/${slug}.html`);
      aantalPaginas++;
    });
  });

  console.log(`Klaar, ${aantalPaginas} pagina's gegenereerd voor ${vacatures.length} vacatures.`);
}

main().catch(error => {
  console.error("Onverwachte fout:", error);
  process.exit(1);
});
