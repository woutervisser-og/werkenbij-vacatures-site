// Logica achter het sollicitatieformulier op elke vacature-detailpagina
// (zie scripts/generate-vacatures/generate.js voor de HTML). Uploadt het
// CV (en eventuele motivatiebrief) los via /api/cv, en dient daarna de
// sollicitatie zelf in bij /api/sollicitaties.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("sollicitatie-form");
  if (!form) return;

  const veldenset = document.getElementById("sollicitatie-velden");
  const submitKnop = document.getElementById("submit-btn");
  const statusEl = document.getElementById("form-status");

  const TOEGESTANE_EXTENSIES = [".pdf", ".doc", ".docx"];
  const MAX_BESTANDSGROOTTE = 5 * 1024 * 1024; // 5MB

  function toonStatus(tekst, type) {
    statusEl.textContent = tekst;
    statusEl.className = type ? "form-status-" + type : "";
  }

  function valideerBestand(file, veldLabel) {
    if (!file) return null;
    const naam = file.name.toLowerCase();
    const geldigeExtensie = TOEGESTANE_EXTENSIES.some(ext => naam.endsWith(ext));
    if (!geldigeExtensie) return `${veldLabel}: alleen PDF of Word-bestanden zijn toegestaan.`;
    if (file.size > MAX_BESTANDSGROOTTE) return `${veldLabel}: bestand is groter dan 5MB.`;
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

    const cvBestand = document.getElementById("cv").files[0];
    const motivatiebriefBestand = document.getElementById("motivation_letter").files[0];

    const cvFout = valideerBestand(cvBestand, "CV") || (!cvBestand ? "Upload je CV." : null);
    if (cvFout) {
      toonStatus(cvFout, "fout");
      return;
    }
    const motivatiebriefFout = valideerBestand(motivatiebriefBestand, "Motivatiebrief");
    if (motivatiebriefFout) {
      toonStatus(motivatiebriefFout, "fout");
      return;
    }

    veldenset.disabled = true;
    submitKnop.textContent = "Bezig met versturen...";
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
        toonStatus("Bedankt voor je sollicitatie! We nemen zo snel mogelijk contact met je op.", "ok");
      })
      .catch(error => {
        veldenset.disabled = false;
        submitKnop.textContent = "Versturen";
        toonStatus("Er ging iets mis bij het versturen. Probeer het nogmaals of neem contact op.", "fout");
        console.error(error);
      });
  });
});
