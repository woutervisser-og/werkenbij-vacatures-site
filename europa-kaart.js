// Interactieve Europa-kaart met vacatures per land (choropleth via D3 +
// TopoJSON/GeoJSON, zie DATASET-toelichting in het bijbehorende PR-bericht).
//
// Dummy-databronnen op dit moment: DATA_URL wijst naar een los, statisch
// JSON-bestand. Zodra de Azure Function live is verandert alleen de
// constante DATA_URL hieronder naar het echte endpoint (bv.
// "/api/VacaturesPerLand") — de rest van dit bestand (rendering, kleuren,
// tooltip, klik-navigatie, animatie) blijft ongewijzigd, want het
// responseformaat is al afgestemd: [{ "land": "FR", "aantal": 3 }, ...].
(function () {
  "use strict";

  const GEO_URL = "/data/europa-landen.geo.json";
  const DATA_URL = "/data/dummy-vacatures-per-land.json";

  // TopoJSON/GeoJSON-bron (world-atlas, afgeleid van Natural Earth) gebruikt
  // de NUMERIEKE ISO 3166-1-landcode als feature-id (bv. "528"). Deze tabel
  // koppelt dat aan de ISO 3166-1 alpha-2-code waarmee de vacature-data werkt.
  const ID_NAAR_ALPHA2 = {
    "008": "AL", "020": "AD", "040": "AT", "112": "BY", "056": "BE",
    "070": "BA", "100": "BG", "191": "HR", "196": "CY", "203": "CZ",
    "208": "DK", "233": "EE", "234": "FO", "246": "FI", "250": "FR",
    "276": "DE", "300": "GR", "348": "HU", "352": "IS", "372": "IE",
    "380": "IT", "428": "LV", "438": "LI", "440": "LT", "442": "LU",
    "470": "MT", "498": "MD", "492": "MC", "499": "ME", "528": "NL",
    "807": "MK", "578": "NO", "616": "PL", "620": "PT", "642": "RO",
    "674": "SM", "688": "RS", "703": "SK", "705": "SI", "724": "ES",
    "752": "SE", "756": "CH", "804": "UA", "826": "GB", "336": "VA",
    "248": "AX"
  };

  // Weergavenaam per alpha-2-code (Engels): matcht de bestaande "Locatie"-
  // conventie op deze site ("Stad, Land", Land in het Engels — zie
  // vacatures.html's LANDEN-lijst), zodat een klik op een land linkt naar
  // hetzelfde filter dat vacatures.html al ondersteunt (?land=Netherlands).
  const ALPHA2_NAAR_NAAM = {
    AL: "Albania", AD: "Andorra", AT: "Austria", BY: "Belarus", BE: "Belgium",
    BA: "Bosnia and Herzegovina", BG: "Bulgaria", HR: "Croatia", CY: "Cyprus",
    CZ: "Czechia", DK: "Denmark", EE: "Estonia", FO: "Faroe Islands",
    FI: "Finland", FR: "France", DE: "Germany", GR: "Greece", HU: "Hungary",
    IS: "Iceland", IE: "Ireland", IT: "Italy", LV: "Latvia", LI: "Liechtenstein",
    LT: "Lithuania", LU: "Luxembourg", MT: "Malta", MD: "Moldova", MC: "Monaco",
    ME: "Montenegro", NL: "Netherlands", MK: "North Macedonia", NO: "Norway",
    PL: "Poland", PT: "Portugal", RO: "Romania", SM: "San Marino", RS: "Serbia",
    SK: "Slovakia", SI: "Slovenia", ES: "Spain", SE: "Sweden", CH: "Switzerland",
    UA: "Ukraine", GB: "United Kingdom", VA: "Vatican City", AX: "Åland Islands"
  };

  function alpha2VoorFeature(feature) {
    return ID_NAAR_ALPHA2[feature.id] || null;
  }

  function naamVoorFeature(feature) {
    const alpha2 = alpha2VoorFeature(feature);
    return (alpha2 && ALPHA2_NAAR_NAAM[alpha2]) || feature.properties.name;
  }

  // Vertaalt via de site-brede i18n.js (window.t, gevuld door /i18n/<taal>.json)
  // met een Nederlandstalige terugval als i18n.js om wat voor reden dan ook
  // niet geladen is — zelfde progressive-enhancement-patroon als elders.
  function vertaal(key, vars, terugval) {
    return typeof window.t === "function" ? window.t(key, vars) : terugval;
  }

  function aantalTekst(aantal) {
    const key = aantal === 1 ? "europaKaart.vacatureEnkelvoud" : "europaKaart.vacatureMeervoud";
    const terugval = aantal === 1 ? `${aantal} openstaande vacature` : `${aantal} openstaande vacatures`;
    return vertaal(key, { aantal }, terugval);
  }

  function init() {
    const container = document.getElementById("europa-kaart");
    if (!container) return;

    Promise.all([
      fetch(GEO_URL).then((r) => r.json()),
      fetch(DATA_URL).then((r) => r.json()),
      window.OG_I18N_KLAAR || Promise.resolve()
    ])
      .then(([geojson, vacatureData]) => {
        const aantallen = {};
        vacatureData.forEach((rij) => { aantallen[rij.land] = rij.aantal; });
        renderKaart(container, geojson, aantallen);
        renderMobieleLijst(container, geojson, aantallen);
      })
      .catch((err) => {
        console.error("Europa-kaart kon niet geladen worden:", err);
      });
  }

  function renderKaart(container, geojson, aantallen) {
    const svgHouder = document.createElement("div");
    svgHouder.className = "europa-kaart-svg-houder";
    container.appendChild(svgHouder);

    const tooltip = document.createElement("div");
    tooltip.className = "europa-kaart-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    container.appendChild(tooltip);

    const aantalVoorFeature = (feature) => {
      const alpha2 = alpha2VoorFeature(feature);
      return (alpha2 && aantallen[alpha2]) || 0;
    };

    const maxAantal = Math.max(1, ...Object.values(aantallen));
    const kleurschaal = d3.scaleLinear()
      .domain([1, maxAantal])
      .range(["#F9B662", "#C96100"])
      .interpolate(d3.interpolateRgb)
      .clamp(true);

    const kleurVoorFeature = (feature) => {
      const aantal = aantalVoorFeature(feature);
      return aantal > 0 ? kleurschaal(aantal) : "#E5E5E2";
    };

    let svg, projectie, pad, landenSelectie;

    const teken = () => {
      const breedte = svgHouder.clientWidth;
      const hoogte = Math.round(breedte * 0.62);

      svgHouder.innerHTML = "";
      svg = d3.select(svgHouder)
        .append("svg")
        .attr("class", "europa-kaart-svg")
        .attr("viewBox", `0 0 ${breedte} ${hoogte}`)
        .attr("role", "img")
        .attr("aria-label", vertaal("europaKaart.ariaLabel", null, "Interactieve kaart van Europa met het aantal openstaande vacatures per land"));

      projectie = d3.geoMercator().fitSize([breedte, hoogte], geojson);
      pad = d3.geoPath(projectie);

      landenSelectie = svg.selectAll("path.europa-kaart-land")
        .data(geojson.features)
        .join("path")
        .attr("class", "europa-kaart-land")
        .attr("d", pad)
        .attr("fill", kleurVoorFeature)
        .attr("tabindex", (d) => (aantalVoorFeature(d) > 0 ? 0 : -1))
        .attr("role", (d) => (aantalVoorFeature(d) > 0 ? "button" : null))
        .attr("aria-hidden", (d) => (aantalVoorFeature(d) > 0 ? null : "true"))
        .attr("aria-label", (d) => {
          const aantal = aantalVoorFeature(d);
          if (aantal <= 0) return null;
          return `${naamVoorFeature(d)}: ${aantalTekst(aantal)}`;
        })
        .style("cursor", (d) => (aantalVoorFeature(d) > 0 ? "pointer" : "default"))
        .on("mouseenter mousemove", (event, d) => {
          if (aantalVoorFeature(d) > 0) toonTooltip(event, d);
        })
        .on("mouseleave", verbergTooltip)
        .on("click", (event, d) => gaNaarVacatures(d))
        .on("keydown", (event, d) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            gaNaarVacatures(d);
          }
        });
    };

    function gaNaarVacatures(feature) {
      const aantal = aantalVoorFeature(feature);
      if (aantal <= 0) return;
      window.location.href = `vacatures.html?land=${encodeURIComponent(naamVoorFeature(feature))}`;
    }

    function toonTooltip(event, feature) {
      const aantal = aantalVoorFeature(feature);
      const naam = naamVoorFeature(feature);
      tooltip.textContent = `${naam}: ${aantalTekst(aantal)}`;
      tooltip.hidden = false;

      const containerRect = container.getBoundingClientRect();
      const x = event.clientX - containerRect.left;
      const y = event.clientY - containerRect.top;
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
    }

    function verbergTooltip() {
      tooltip.hidden = true;
    }

    teken();

    let herTekenGepland = null;
    window.addEventListener("resize", () => {
      clearTimeout(herTekenGepland);
      herTekenGepland = setTimeout(teken, 200);
    });

    // Fade + lichte scale-in (0.95 -> 1) zodra de kaart voor het eerst in
    // beeld komt, niet bij hover. GSAP/ScrollTrigger is progressive
    // enhancement (zie over-ons-animaties.js voor hetzelfde patroon): als de
    // CDN niet laadt, staat de kaart gewoon meteen op volle opacity/schaal.
    const gereduceerdeMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!gereduceerdeMotion && typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
      gsap.registerPlugin(ScrollTrigger);
      gsap.set(container, { opacity: 0, scale: 0.95, transformOrigin: "center center" });
      gsap.to(container, {
        opacity: 1,
        scale: 1,
        duration: 0.7,
        ease: "power2.out",
        scrollTrigger: { trigger: container, start: "top 85%", once: true }
      });
    }
  }

  // Mobiel: een lijstweergave naast (onder) de kaart. Zie toelichting in het
  // PR-bericht — micro-staten (Andorra, Monaco, Vaticaanstad, ...) zijn op
  // een telefoonscherm nooit precies genoeg aan te tikken op de kaart zelf,
  // een lijst met echte tekst-links garandeert een bruikbaar aanraakvlak
  // ongeacht de fysieke grootte van het land. De kaart zelf blijft ook op
  // mobiel gewoon zichtbaar (context/oogstrelend), de lijst is een
  // aanvulling, geen vervanging.
  function renderMobieleLijst(container, geojson, aantallen) {
    const metVacatures = geojson.features
      .map((f) => ({ naam: naamVoorFeature(f), alpha2: alpha2VoorFeature(f), aantal: (alpha2VoorFeature(f) && aantallen[alpha2VoorFeature(f)]) || 0 }))
      .filter((land) => land.aantal > 0)
      .sort((a, b) => b.aantal - a.aantal);

    if (!metVacatures.length) return;

    const lijst = document.createElement("ul");
    lijst.className = "europa-kaart-lijst";
    metVacatures.forEach((land) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `vacatures.html?land=${encodeURIComponent(land.naam)}`;
      link.innerHTML = `<span>${land.naam}</span><span class="europa-kaart-lijst-aantal">${land.aantal}</span>`;
      item.appendChild(link);
      lijst.appendChild(item);
    });
    container.appendChild(lijst);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
