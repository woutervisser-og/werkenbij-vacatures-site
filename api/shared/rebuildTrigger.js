const fetch = require("node-fetch");

const OWNER = "woutervisser-og";
const REPO = "werkenbij-vacatures-site";
const WORKFLOW_FILE = "azure-static-web-apps-victorious-sea-0b50b4303.yml";
const TOKEN = process.env.GITHUB_REBUILD_TOKEN;

// Vuurt een nieuwe site-build af via GitHub Actions (workflow_dispatch),
// zodat een statuswijziging niet hoeft te wachten op de dagelijkse
// schedule (9:00/14:00). Best-effort: een falende trigger blokkeert de
// eigenlijke CRUD-actie niet, alleen loggen.
async function triggerRebuild(context) {
  if (!TOKEN) {
    context.log.error("GITHUB_REBUILD_TOKEN ontbreekt, kan geen rebuild triggeren");
    return;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ref: "main" })
      }
    );

    if (!response.ok) {
      context.log.error("Kon rebuild niet triggeren", response.status, await response.text());
    }
  } catch (error) {
    context.log.error("Kon rebuild niet triggeren", error.message);
  }
}

// Een statuswijziging is alleen interessant voor de publieke site als
// "gepubliceerd" erbij betrokken is, ofwel erin (nieuw zichtbaar), ofwel
// eruit (niet meer zichtbaar).
function raaktPubliekeSite(vorigeStatus, nieuweStatus) {
  return vorigeStatus === "gepubliceerd" || nieuweStatus === "gepubliceerd";
}

module.exports = { triggerRebuild, raaktPubliekeSite };
