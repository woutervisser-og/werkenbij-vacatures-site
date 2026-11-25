// Logica achter het sollicitatieformulier op elke vacature-detailpagina
// (zie scripts/generate-vacatures/generate.js voor de HTML). Uploadt het
// CV (en eventuele motivatiebrief) los via /api/cv, en dient daarna de
// sollicitatie zelf in bij /api/sollicitaties.
//
// Alle getoonde tekst komt uit window.OG_FORM_TEKSTEN, dat generate.js
// per taal invult (zie /i18n/<taal>.json) — dit script zelf kent geen
// taal, het toont gewoon wat er is meegegeven.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("sollicitatie-form");
  if (!form) return;

  const teksten = window.OG_FORM_TEKSTEN || {};

  const veldenset = document.getElementById("sollicitatie-velden");
  const submitKnop = document.getElementById("submit-btn");
  const statusEl = document.getElementById("form-status");

  const TOEGESTANE_EXTENSIES = [".pdf", ".doc", ".docx"];
  const MAX_BESTANDSGROOTTE = 5 * 1024 * 1024; // 5MB

  // Zelfde patronen als de server (api/SollicitatieCreate): internationaal
  // bedoeld, dus geen land-specifiek formaat. Telefoon is optioneel, wordt
  // alleen gecheckt als er iets is ingevuld.
  const EMAIL_REGEX = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
  const TELEFOON_REGEX = /^\+?[0-9]{7,15}$/;

  function isGeldigeEmail(waarde) {
    return EMAIL_REGEX.test(waarde);
  }

  function isGeldigTelefoonnummer(waarde) {
    const opgeschoond = waarde.replace(/[\s\-().]/g, "");
    return TELEFOON_REGEX.test(opgeschoond);
  }

  function vulIn(sjabloon, veld) {
    return (sjabloon || "").replace(/\{\{veld\}\}/g, veld);
  }

  function toonStatus(tekst, type) {
    statusEl.textContent = tekst;
    statusEl.className = type ? "form-status-" + type : "";
  }

  function valideerBestand(file, veldLabel) {
    if (!file) return null;
    const naam = file.name.toLowerCase();
    const geldigeExtensie = TOEGESTANE_EXTENSIES.some(ext => naam.endsWith(ext));
    if (!geldigeExtensie) return vulIn(teksten.bestandTypeFout, veldLabel);
    if (file.size > MAX_BESTANDSGROOTTE) return vulIn(teksten.bestandGrootteFout, veldLabel);
    return null;
  }

  function uploadBestand(file) {
    return fetch("/api/cv?bestandsnaam=" + encodeURIComponent(file.name), {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: file
    }).then(response => {
      if (!response.ok) throw new Error("Uploaden is mislukt (status " + response.status + ")");
      return response.json();
    });
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    toonStatus("", null);

    // Honeypot: onzichtbaar veld voor mensen (CSS), maar een simpele
    // spambot vult vaak elk veld in dat hij tegenkomt. Niet leeg = spam:
    // doe alsof het gelukt is (de bot leert er niets van), maar verstuur
    // niets echt.
    if (form.website.value.trim()) {
      form.reset();
      veldenset.hidden = true;
      toonStatus(teksten.succes, "ok");
      return;
    }

    if (!isGeldigeEmail(form.email.value)) {
      toonStatus(teksten.emailOngeldig, "fout");
      return;
    }
    if (form.tel.value.trim() && !isGeldigTelefoonnummer(form.tel.value)) {
      toonStatus(teksten.telefoonOngeldig, "fout");
      return;
    }

    const cvBestand = document.getElementById("cv").files[0];
    const motivatiebriefBestand = document.getElementById("motivation_letter").files[0];

    const cvFout = valideerBestand(cvBestand, teksten.cvVeldnaam) || (!cvBestand ? teksten.cvVerplicht : null);
    if (cvFout) {
      toonStatus(cvFout, "fout");
      return;
    }
    const motivatiebriefFout = valideerBestand(motivatiebriefBestand, teksten.motivatiebriefVeldnaam);
    if (motivatiebriefFout) {
      toonStatus(motivatiebriefFout, "fout");
      return;
    }

    veldenset.disabled = true;
    submitKnop.textContent = teksten.bezigMetVersturen;
    toonStatus("", null);

    Promise.all([
      uploadBestand(cvBestand),
      motivatiebriefBestand ? uploadBestand(motivatiebriefBestand) : Promise.resolve(null)
    ])
      .then(([cv, motivatiebrief]) => {
        return fetch("/api/sollicitaties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vacatureId: form.vacatureId.value,
            voornaam: form.first_name.value,
            achternaam: form.last_name.value,
            email: form.email.value,
            telefoon: form.tel.value,
            motivatie: form.motivation.value,
            cv,
            motivatiebrief
          })
        });
      })
      .then(response => {
        if (!response.ok) throw new Error("Versturen is mislukt (status " + response.status + ")");
        return response.json();
      })
      .then(() => {
        form.reset();
        veldenset.hidden = true;
        toonStatus(teksten.succes, "ok");
      })
      .catch(error => {
        veldenset.disabled = false;
        submitKnop.textContent = teksten.versturen;
        toonStatus(teksten.fout, "fout");
        console.error(error);
      });
  });
});
