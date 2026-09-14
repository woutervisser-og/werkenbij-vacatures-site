// Eenvoudig, vanilla-JS i18n-systeem voor de algemene site-teksten (menu,
// footer, knoppen, formulieren) — los van het CMS. Vacature-inhoud zelf
// wordt apart per taal opgeslagen (zie api/shared/vacaturesTable.js en
// generate.js), dit bestand regelt alleen de vaste site-chrome.
//
// Werking: leest de taal uit het URL-pad (een prefix als "/nl/..." of
// "/fr/...", zelfde conventie als de door generate.js gegenereerde
// vacature-detailpagina's), haalt "/i18n/<taal>.json" op, en zet de tekst
// van elk element met een "data-i18n"-attribuut. Ontbreekt een key in de
// gekozen taal (fr/de/it/se zijn nog niet volledig gevuld), dan valt dit
// terug op de EN-waarde, zodat er nooit een lege tekst verschijnt.
(function () {
  "use strict";

  const ONDERSTEUNDE_TALEN = ["en", "nl", "fr", "de", "it", "se"];
  const BASISTAAL = "en";

  function huidigeTaal() {
    const eersteSegment = location.pathname.split("/").filter(Boolean)[0];
    return ONDERSTEUNDE_TALEN.includes(eersteSegment) ? eersteSegment : BASISTAAL;
  }

  const taal = huidigeTaal();

  // De vaste, taalbewuste site-pagina's: een link naar een van deze
  // bestanden krijgt de huidige taalprefix mee. Vacature-detaillinks
  // (/vacature/...) worden hier bewust niet aangepast: die hangen af van
  // welke taalversie er voor die specifieke vacature bestaat, en dat
  // regelt vacatures.html zelf (het kent de beschikbare vertalingen per
  // vacature al uit de API-respons).
  const SITE_PAGINAS = ["index.html", "vacatures.html", "werken-bij-og.html", "over-ons.html", "contact.html"];

  function zoekOp(dict, key) {
    return key.split(".").reduce((acc, deel) => (acc && typeof acc === "object" ? acc[deel] : undefined), dict);
  }

  let woordenboek = {};
  let basisWoordenboek = {};

  function t(key, vervangingen) {
    let tekst = zoekOp(woordenboek, key);
    if (tekst === undefined || tekst === "") tekst = zoekOp(basisWoordenboek, key);
    if (tekst === undefined || tekst === "") tekst = key;
    if (vervangingen) {
      Object.keys(vervangingen).forEach(naam => {
        tekst = tekst.replace(new RegExp("\\{\\{" + naam + "\\}\\}", "g"), vervangingen[naam]);
      });
    }
    return tekst;
  }

  function haalTaalbestandOp(taalcode) {
    return fetch("/i18n/" + taalcode + ".json")
      .then(response => (response.ok ? response.json() : {}))
      .catch(() => ({}));
  }

  // Vult de taal-selector in de header: zet de huidige taalcode op de
  // knop, en de href van elke taaloptie naar dezelfde pagina in die taal.
  function huidigePaginaBestand() {
    const laatsteSegment = location.pathname.split("/").filter(Boolean).pop();
    return laatsteSegment && SITE_PAGINAS.includes(laatsteSegment) ? laatsteSegment : "index.html";
  }

  function vulTaalSelectorIn() {
    const bestand = huidigePaginaBestand();
    document.querySelectorAll(".taal-nav-selector").forEach(selector => {
      const code = selector.querySelector(".taal-nav-code");
      if (code) code.textContent = taal.toUpperCase();
      selector.querySelectorAll(".taal-nav-lijst a[data-taal]").forEach(link => {
        const linkTaal = link.getAttribute("data-taal");
        link.setAttribute("href", "/" + linkTaal + "/" + bestand);
        link.classList.toggle("taal-nav-actief", linkTaal === taal);
      });
    });
  }

  function pastInterneLinksAan() {
    if (taal === BASISTAAL) return;
    document.querySelectorAll("a[href]").forEach(link => {
      const href = link.getAttribute("href");
      if (!href) return;
      const zonderSlash = href.replace(/^\//, "");
      const isHomepage = href === "/" || href === "" || zonderSlash === "index.html";
      if (isHomepage || SITE_PAGINAS.includes(zonderSlash)) {
        link.setAttribute("href", "/" + taal + "/" + (isHomepage ? "index.html" : zonderSlash));
      }
    });
  }

  function pasToe() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const varsAttr = el.getAttribute("data-i18n-vars");
      const vars = varsAttr ? JSON.parse(varsAttr) : undefined;
      el.textContent = t(key, vars);
    });
    document.querySelectorAll("[data-i18n-html]").forEach(el => {
      const key = el.getAttribute("data-i18n-html");
      const varsAttr = el.getAttribute("data-i18n-vars");
      const vars = varsAttr ? JSON.parse(varsAttr) : undefined;
      el.innerHTML = t(key, vars);
    });
    document.querySelectorAll("[data-i18n-attr]").forEach(el => {
      el.getAttribute("data-i18n-attr").split(";").forEach(paar => {
        const stukken = paar.split(":");
        const attr = stukken[0] && stukken[0].trim();
        const key = stukken[1] && stukken[1].trim();
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
    pastInterneLinksAan();
    vulTaalSelectorIn();
    document.documentElement.lang = taal;
  }

  window.OG_HUIDIGE_TAAL = taal;
  window.t = t;
  window.OG_I18N_KLAAR = Promise.all([haalTaalbestandOp(BASISTAAL), haalTaalbestandOp(taal)]).then(
    ([basis, huidige]) => {
      basisWoordenboek = basis;
      woordenboek = huidige;
      pasToe();
    }
  );
})();
