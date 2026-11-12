# Technische documentatie — werkenbij-vacatures-site

Volledig technisch overzicht van de site zoals die nu in GitHub staat:
architectuur, alle Azure Functions, het datamodel, het beheerportaal,
meertaligheid en de deploy-pipeline. Bedoeld als naslagwerk voor wie met
de code aan de slag moet (ook een toekomstige ontwikkelaar die de
geschiedenis niet kent).

Voor de chronologie van beslissingen en welke PR wat deed, zie
`VOORTGANG.md`. Voor het oorspronkelijke ontwerp van het HR-portaal
(inclusief de argumentatie voor de gekozen bouwstenen), zie
`ARCHITECTUUR-HR-PORTAAL.md`. Voor wat er nog ontbreekt, zie
`FEATURES-BACKLOG.md`. Dit document beschrijft de **eindsituatie**: wat
er staat, waar, en waar je moet zijn om iets aan te passen.

## Inhoud

1. [Architectuur in vogelvlucht](#1-architectuur-in-vogelvlucht)
2. [Publieke site: pagina's en gedeelde JS](#2-publieke-site-paginas-en-gedeelde-js)
3. [Meertaligheid (i18n)](#3-meertaligheid-i18n)
4. [Europa-vacaturekaart (homepage)](#4-europa-vacaturekaart-homepage)
5. [Vacature-tegel thumbnails](#5-vacature-tegel-thumbnails)
6. [Datamodel: Vacatures](#6-datamodel-vacatures)
7. [Datamodel: Sollicitaties](#7-datamodel-sollicitaties)
8. [Media- en bestandsopslag (Blob Storage)](#8-media--en-bestandsopslag-blob-storage)
9. [Volledig overzicht Azure Functions](#9-volledig-overzicht-azure-functions)
10. [Authenticatie en autorisatie](#10-authenticatie-en-autorisatie)
11. [Beheerportaal (/beheer/\*)](#11-beheerportaal-beheer)
12. [Build & deploy (CI/CD)](#12-build--deploy-cicd)
13. [Bekende aandachtspunten](#13-bekende-aandachtspunten)

---

## 1. Architectuur in vogelvlucht

Azure Static Web Apps, met 6 bouwstenen (zie ook `ARCHITECTUUR-HR-PORTAAL.md`):

1. **GitHub** — code + versiebeheer.
2. **Azure Static Web Apps** — hosting van de statische site, routing/auth
   (`staticwebapp.config.json`), en host voor de Azure Functions.
3. **Microsoft Entra ID** — login voor `/beheer/*` (zelfde account als
   Outlook/Teams), via Static Web Apps' ingebouwde `aad`-provider.
4. **Azure Functions** (map `api/`) — alle server-side logica: CRUD voor
   vacatures/sollicitaties, mediabibliotheek, publieke read-only
   endpoints, onderhoudstaken.
5. **Azure Table Storage** — 2 tabellen, `Vacatures` en `Sollicitaties`
   (zie secties 6 en 7).
6. **Azure Blob Storage** — 2 containers: `media` (publiek, foto's voor
   vacature-headers/afbeeldingblokken) en `sollicitatie-bijlagen`
   (privé, CV's/motivatiebrieven).

**Geen frontend-build-stap.** De publieke site is platte HTML/CSS/
vanilla-JS, geen bundler, geen framework, geen root-`package.json`. Wat
er wél gegenereerd wordt: de losse detailpagina per vacature per taal
(zie hieronder), via een eigen Node-script dat in CI draait vóór elke
deploy.

**`scripts/generate-vacatures/generate.js`** — haalt bij build-tijd alle
vacatures op bij `GetVacatures` (via env var `VACATURES_API_URL`,
standaard de live site) en schrijft voor elke vacature, voor elke
ondersteunde taal, een eigen statische HTML-pagina:
`<taalcode>/vacature/<slug>.html` (dus bv. zowel `en/vacature/finance-controller.html`
als `nl/vacature/finance-controller.html` — symmetrisch, geen taal
zonder prefix, ook niet EN). Genereert ook de JobPosting-structured-data,
meta tags, hreflang-tags en het sollicitatieformulier per pagina (zie
sectie 2). Dit script draait **in de GitHub Actions-workflow**, niet
live op de server — de gegenereerde HTML-bestanden zelf worden niet
gecommit, ze ontstaan bij elke build opnieuw.

## 2. Publieke site: pagina's en gedeelde JS

**Vaste pagina's** (root van de repo): `index.html`, `vacatures.html`,
`werken-bij-og.html`, `over-ons.html`, `contact.html`. Elk bestaat maar
1 keer op schijf; de taalvarianten (`/en/index.html`, `/nl/index.html`, ...)
zijn `rewrite`-regels in `staticwebapp.config.json` die naar hetzelfde
bestand wijzen — de content wordt dus pas **client-side** vertaald (zie
sectie 3). Bare URL's zonder taalprefix (`/index.html`, `/vacatures.html`, ...)
redirecten (302) naar de `/en/...`-variant.

**Gedeelde JavaScript-bestanden** (root, geladen op meerdere/alle pagina's):

| Bestand | Op welke pagina's | Doet |
|---|---|---|
| `i18n/i18n.js` | alle | vertaalsysteem, zie sectie 3 |
| `animations.js` | alle | reveal-on-scroll (IntersectionObserver), sticky header bij hero-pagina's, tijdlijn-foto-slider (over-ons), betrokkenheid-galerij pijlen/dots (over-ons), taal-selector dropdown, hamburgermenu op mobiel |
| `over-ons-animaties.js` | alleen over-ons.html | GSAP/ScrollTrigger-parallax en stagger-animaties; progressive enhancement — doet niets als de GSAP-CDN niet laadt |
| `europa-kaart.js` | alleen index.html | de Europa-vacaturekaart, zie sectie 4 |
| `solliciteer.js` | alleen gegenereerde vacature-detailpagina's | sollicitatieformulier: valideert bestanden, uploadt CV/motivatiebrief naar `/api/cv`, dient daarna de sollicitatie in bij `/api/sollicitaties` |

**Styling**: `styles.css` (~1850 regels) voor de hele publieke site +
huisstijl-tokens (`--og-orange`, `--og-dark`, ...). `beheer/beheer.css`
(~590 regels) is een **los**, bewust niet-herbruikt stijlblad voor het
beheerportaal (functioneel dashboard, geen marketing-uitstraling).

## 3. Meertaligheid (i18n)

6 talen: **EN** (basistaal/verplicht), NL, FR, DE, IT, SE.

**Bestanden:**
- `i18n/i18n.js` — het systeem zelf: leest de taal uit het eerste
  URL-pad-segment (`/fr/...` → `fr`, anders EN), haalt `/i18n/<taal>.json`
  op, vult elk element met een `data-i18n`-attribuut in
  (`data-i18n-attr` voor attributen, `data-i18n-html` voor HTML-inhoud),
  zet `document.documentElement.lang`, en herschrijft interne links naar
  de huidige taalprefix.
- `i18n/en.json`, `nl.json`, `fr.json`, `de.json`, `it.json`, `se.json`
  — 1 bestand per taal, geneste JSON (bv. `overOns.tijdlijn2008`), elk
  op dit moment **261 sleutels**, exact gelijk aan elkaar qua structuur.

**Fallback-gedrag:** ontbreekt een sleutel in de gekozen taal, dan valt
`i18n.js` terug op de EN-waarde (nooit een lege tekst). Dat voorkomt
crashes, maar betekent ook dat een vergeten vertaling **onopgemerkt**
Engelse tekst toont — precies wat er gebeurde tot
[PR #93](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/93):
fr/de/it/se.json waren 78 sleutels achterop geraakt sinds de tijdlijn-
sectie, de "17 afdelingen"-sectie en de Europa-kaart waren toegevoegd
aan over-ons.html/werken-bij-og.html/index.html.

**Belangrijkste onderhoudsregel:** voeg je een nieuwe `data-i18n`-key
toe aan een pagina, zet die dan **in alle 6 taalbestanden**, niet
alleen in `en.json`/`nl.json`. Twijfel je of alles compleet is, check
dat zo (Node, vanuit de repo-root):

```js
node -e "
const fs = require('fs');
function flatten(obj, prefix = '') {
  let keys = [];
  for (const k in obj) {
    const p = prefix ? prefix + '.' + k : k;
    if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) keys = keys.concat(flatten(obj[k], p));
    else keys.push(p);
  }
  return keys;
}
const en = new Set(flatten(JSON.parse(fs.readFileSync('i18n/en.json'))));
for (const lang of ['nl','fr','de','it','se']) {
  const keys = new Set(flatten(JSON.parse(fs.readFileSync('i18n/' + lang + '.json'))));
  const missing = [...en].filter(k => !keys.has(k));
  console.log(lang, missing.length ? 'MIST: ' + missing.join(', ') : 'compleet');
}
"
```

**Bewuste uitzonderingen (blijven Engels, in elke taal):**
- Merk-taglines: "We don't wait for change.", "Work hard. Laugh hard.
  Fuel good.", "Bold. Eager. Human."
- Functienamen in `werkenBijOg.afdelingNNaam` (bv. "Business
  Development", "QHSE") — zelfde namen als de vaste
  `ALLOWED_AFDELINGEN`-lijst in `api/shared/vacaturesTable.js`.

**Let op, apart van dit i18n-systeem:** de vacature-detailpagina's zelf
(`<taal>/vacature/<slug>.html`) worden **niet** door `i18n.js` vertaald —
die worden al vertaald gegenereerd door `scripts/generate-vacatures/generate.js`,
op basis van de `translations`-structuur per vacature (zie sectie 6).

## 4. Europa-vacaturekaart (homepage)

Interactieve kaart op `index.html` die per land toont hoeveel vacatures
er openstaan (choropleth). Klik op een land met vacatures → springt naar
`vacatures.html?land=<Land>` (bestaand querystring-filtermechanisme van
`vacatures.html`).

**Bestanden:**
- `europa-kaart.js` — de hele widget (D3-rendering, tooltip, klik,
  toetsenbord, mobiele lijstweergave als alternatief voor heel kleine
  landen, GSAP-fade-in bij eerste keer in beeld, respecteert
  `prefers-reduced-motion`). D3 en GSAP worden via CDN geladen
  (`cdnjs.cloudflare.com`, met `defer`).
- `data/europa-landen.geo.json` — zelf gehoste, gefilterde GeoJSON
  (46 Europese landen, overzeese gebieden verwijderd om de
  Europa-projectie niet te verstoren). Bron: npm-package `world-atlas`
  (Natural Earth-data, publiek domein, eenmalig lokaal verwerkt, niet
  een runtime-dependency).
- `api/GetVacaturesPerLand` — publieke, anonieme Function die per land
  telt hoeveel vacatures de status `"gepubliceerd"` hebben.

**Hoe de koppeling Locatie → land werkt:**
1. Eerst de vaste `LOCATIE_LANDCODE`-tabel in
   `api/shared/vacaturesTable.js` (dekt de huidige kantoren + "Nederland
   (reizend)").
2. Anders: het land uit `"Stad, Land"` knippen en opzoeken in
   `NAAM_NAAR_ALPHA2` in `api/GetVacaturesPerLand/index.js` (bredere
   landnaam-lijst + wat alternatieve schrijfwijzen).
3. Matcht nog steeds niets? De vacature komt in de `niet_gematcht`-lijst
   in de API-response, met titel + de ruwe Locatie-waarde.

**Onderhoud:** krijgt een vacature een Locatie-waarde die niet matcht
(nieuw kantoor, tikfout, ander land), voeg die landnaam dan toe aan
`NAAM_NAAR_ALPHA2` in `api/GetVacaturesPerLand/index.js`. Check dit af
en toe door `/api/GetVacaturesPerLand` te openen en de
`niet_gematcht`-lijst te bekijken.

**Bekende beperking:** heel kleine landen (Vaticaanstad, Monaco, San
Marino, ...) zijn op de kaart zelf lastig precies aan te klikken. Vandaar
de mobiele lijstweergave onder de kaart: die toont elk land met
vacatures als gewone tekstlink, ongeacht hoe klein het op de kaart is.

## 5. Vacature-tegel thumbnails

De vacature-tegels op `vacatures.html` tonen de headerfoto van de
vacature (dezelfde foto als op de detailpagina) als thumbnail bovenaan
de tegel (volle-breedte banner).

**Probleem dat dit oploste:** headerfoto's zijn vaak ongewijzigde
camera-originelen van 1,7-2,1 MB op ~4600px breedte. Rechtstreeks als
thumbnail laden maakte het vacature-overzicht merkbaar traag.

**Oplossing — `api/Thumbnail`:** publieke, anonieme Function die een
bestand uit de mediabibliotheek opvraagt, verkleint met `sharp` naar
een vaste breedte (400/800/1200px, standaard 800) en comprimeert als
WebP (kwaliteit 75). `Cache-Control` staat op een jaar + immutable:
elke geüploade bestandsnaam is een unieke UUID (zie `api/MediaUpload`),
dus dezelfde naam levert altijd dezelfde inhoud.

`vacatures.html` bouwt de thumbnail-URL zelf op (`maakThumbnailUrl()`):
pakt de bestandsnaam uit `vacature.header.bron` en vraagt die op via
`/api/Thumbnail?bestand=<naam>&breedte=800`. Werkt automatisch voor
**elke** vacature met een foto-header, ook oudere — geen migratie of
herupload nodig. De `<img>` krijgt `loading="lazy"` + `decoding="async"`.

**Vacatures zonder bruikbare thumbnail:** een video-header (de bron is
een embed-URL, geen afbeelding) of helemaal geen header krijgt een
oranje verloop-placeholder (`.vacature-card-thumb-fallback` in
`styles.css`) i.p.v. een kapotte afbeelding.

**Onderhoud:** niets — dit werkt vanzelf voor nieuwe uploads. Wil je de
thumbnail-breedte of compressie-kwaliteit aanpassen, dat zit in
`api/Thumbnail/index.js` (`TOEGESTANE_BREEDTES`, `.webp({ quality: 75 })`).

## 6. Datamodel: Vacatures

Azure Table Storage, tabel **`Vacatures`**. Eén vaste `PartitionKey`
(`"vacature"`) voor alle rijen — het aantal vacatures is klein genoeg om
in 1 partitie te passen, `RowKey` = vacature-`id` (UUID).

**Alle logica zit in `api/shared/vacaturesTable.js`** (niet gedupliceerd
per Function). Twee dingen zijn daar bewust zo gebouwd:

**1. Engels is het canonieke datamodel, Nederlands is een tijdelijke alias.**
Het beheerformulier en `generate.js` sturen/verwachten nog deels de oude
Nederlandse veldnamen; `VELD_ALIASSEN` koppelt elk Engels veld aan zijn
Nederlandse tegenhanger zodat beide kanten blijven werken tijdens de
overgang:

| Engels (canoniek) | Nederlands (alias) |
|---|---|
| `department` | `afdeling` |
| `location` | `locatie` |
| `workArea` | `werkgebied` |
| `employmentType` | `dienstverband` |
| `salaryMin` / `salaryMax` | `salarisMin` / `salarisMax` |
| `salaryNegotiable` | `salarisInOverleg` |
| `educationLevel` | `opleidingsniveau` |
| `closingDate` | `sluitingsdatum` |
| `publicationDate` | `publicatiedatum` |

`toVacatureDto()` geeft **beide** veldnamen terug in elke API-response
(Engels + Nederlandse alias), zodat zowel oudere als nieuwere
client-code blijft werken.

**2. Vaste, gevalideerde waardelijsten** (voorkomt vrije-tekst-varianten
van dezelfde waarde):

- `ALLOWED_STATUSSEN`: `concept → ingepland → gepubliceerd → gesloten → gearchiveerd`
- `ALLOWED_AFDELINGEN` (17): Business Development, Cybersecurity,
  Directory, Energy & Wholesale, Facility, Finance, HR, Legal,
  Management, Marketing, Office Management, Operations, Project
  Management, Public Affairs, QHSE, Sales, Sustainability Advisory
- `ALLOWED_LOCATIES` (5 kantoren + 1 generiek): Heerenveen/Netherlands,
  Rousset/France, Emstek/Germany, Parma/Italy, Göteborg/Sweden,
  "Nederland (reizend)" — met `LOCATIE_LANDCODE` ernaast voor de
  JobPosting-structured-data (`addressCountry`).
- `ALLOWED_WERKGEBIEDEN` (los, optioneel veld naast Locatie, voor
  regiogebonden functies zoals servicemonteurs): Noord, Oost, Zuid,
  West, Midden — kunnen gecombineerd worden (`"Zuid/West"`), altijd in
  vaste volgorde opgeslagen (`canoniseerWerkgebied`) zodat "Zuid/West"
  en "West/Zuid" niet als 2 verschillende filterwaarden tellen.
- `ONDERSTEUNDE_TALEN`: `en, nl, fr, de, it, se` ("se", niet ISO "sv",
  voor consistentie met de corporate site).

**Meertalige inhoud**: `translations` is een object per taalcode
(`{ en: { title, bodyBlocks }, nl: {...}, ... }`), opgeslagen als
JSON-tekst in de kolom `translationsJson` (Table Storage ondersteunt
geen geneste structuren). `title` is verplicht voor EN; andere talen
zijn optioneel per vacature. `header` (`{ type: "foto"|"video", bron }`)
wordt op dezelfde manier als `headerJson` opgeslagen.

**Body-blokken** (14 vaste types waarmee HR een vacature-pagina
samenstelt, incl. volgorde — zie `ARCHITECTUUR-HR-PORTAAL.md` voor de
volledige lijst en `beheer/vacature.html`/`scripts/generate-vacatures/generate.js`
voor resp. de editor en de renderer): `intro_gecentreerd`,
`intro_split`, `tekst`, `tekst_kolommen`, `uitgelichte_quote`,
`afbeelding_tekst`, `bullet_lijst`, `arbeidsvoorwaarden_grid`,
`collega_quote`, `video_embed`, `team_voorstelling`,
`sollicitatieproces`, `veelgestelde_vragen`, `sluitingsdatum_banner`.

**Publiceren/sluiten**: statuswijzigingen die de "publiek zichtbaar"-grens
raken (`raaktPubliekeSite()` in `api/shared/rebuildTrigger.js` — true
zodra de oude óf de nieuwe status `"gepubliceerd"` is) triggeren direct
een site-rebuild via de GitHub Actions `workflow_dispatch`-API, zodat een
wijziging niet hoeft te wachten op de volgende geplande build (zie
sectie 12). Dit gebeurt vanuit `VacatureCreate`, `VacatureUpdate`,
`VacatureDelete` én `VacaturesTick` (de geplande publicatie/sluiting).

## 7. Datamodel: Sollicitaties

Azure Table Storage, tabel **`Sollicitaties`**. Zelfde opzet als
Vacatures: 1 vaste `PartitionKey` (`"sollicitatie"`), `RowKey` = het
sollicitatie-`id` (UUID). Logica in `api/shared/sollicitatiesTable.js`.

**Statusmodel** (`ALLOWED_STATUSSEN`, 8 waarden — let op: dit wijkt af
van het oorspronkelijke ontwerp in `ARCHITECTUUR-HR-PORTAAL.md`, zie
sectie 13):

- **6 pipeline-fases** (`BORD_FASES`, de kanban-kolommen in
  `beheer/sollicitaties.html`, in deze vaste volgorde): `nieuw` →
  `screening` → `eerste_gesprek` → `tweede_gesprek` → `aanbod` →
  `aangenomen`.
- **2 exit-statussen** (`EXIT_STATUSSEN`, vanuit elke fase bereikbaar,
  geen eigen kanban-kolom maar een losse lijstweergave): `afgewezen`,
  `ingetrokken` ("ingetrokken door kandidaat" — fungeert als het
  "archief").

**Velden** (via `toEntity`/`toSollicitatieDto`): `vacatureId` +
gedenormaliseerde `vacatureTitel` (vastgelegd bij het indienen, overleeft
dus het later verwijderen/hernoemen van de vacature), `voornaam`,
`achternaam`, `email`, `telefoon`, `motivatie` (vrije tekst uit het
formulier), `cvNaam`/`cvOorspronkelijkeNaam`, optioneel
`motivatiebriefNaam`/`motivatiebriefOorspronkelijkeNaam`, `status`,
`notities` (HR-interne notities, sanitized HTML, zie hieronder),
`ingediendOp` (ISO-timestamp, nooit gewijzigd na aanmaak).

**Audittrail**: `statusHistoryJson` (JSON-array, kolom-workaround net als
`translationsJson`) met per wijziging `{ from, to, timestamp, user }`.
Bij het indienen wordt automatisch 1 entry gezet
(`{ from: null, to: "nieuw", timestamp, user: "kandidaat" }`);
`metNieuweStatusHistory()` voegt er bij elke echte statuswijziging één
toe, met de ingelogde gebruiker uit `api/shared/huidigeGebruiker.js`
(leest de `x-ms-client-principal`-header die Static Web Apps automatisch
meestuurt bij een ingelogde sessie, valt terug op `"onbekend"`).

**Notities-sanitization**: `notities` komt binnen als HTML vanuit een
`contenteditable`-rich-text-veld in `beheer/sollicitatie-dossier.html`
en wordt later weer via `innerHTML` getoond — zonder whitelist zou dit
een stored-XSS-vector zijn. `SollicitatieUpdate` filtert daarom door
`sanitize-html` met een strikte allowlist: alleen
`b, strong, i, em, u, ul, ol, li, br, div, p`, **geen** attributen
toegestaan.

**Indienen (publieke kant)**: `SollicitatieCreate` (`POST /api/sollicitaties`,
bewust **publiek/anoniem**, een kandidaat is niet ingelogd) valideert
verplichte velden + een e-mail-regex die ook HTML-brekende tekens
(`< > " '`) weigert (comment: deze waarde wordt later in `/beheer`
getoond, dus geen enkel HTML-brekend teken is geldig, ongeacht hoe de
weergave zelf escaped). Het CV/de motivatiebrief moeten al via
`CvUpload` geüpload zijn vóór dit aangeroepen wordt (2-staps-flow, zie
`solliciteer.js`).

## 8. Media- en bestandsopslag (Blob Storage)

Twee containers, bewust gescheiden naar zichtbaarheid:

| Container | Zichtbaarheid | Voor | Beheerd door |
|---|---|---|---|
| `media` | **Publiek** (`access: "blob"`) | Headerfoto's, afbeeldingen in body-blokken | `api/shared/mediaContainer.js` |
| `sollicitatie-bijlagen` | **Privé** | CV's, motivatiebrieven | `api/shared/cvBijlagenContainer.js` |

Beide containers volgen hetzelfde patroon: bestandsnaam = `randomUUID() + extensie`
(nooit de originele bestandsnaam als blob-naam — voorkomt padproblemen/
overschrijven), en een memoized `BlobServiceClient`-promise die zichzelf
reset bij een fout (zodat 1 mislukte poging niet de hele levensduur van
de Function-instance "vastzet").

- **`media`**: toegestane extensies jpg/jpeg/png/webp/gif. Publiek
  leesbaar (een headerfoto moet zonder token laden), maar de
  *inhoudsopgave* van de container is alleen op te vragen via de
  beveiligde `MediaList`-Function, niet direct.
- **`sollicitatie-bijlagen`**: toegestane extensies pdf/doc/docx, max
  5MB. **Niet** publiek leesbaar — de enige manier om een CV/
  motivatiebrief terug te krijgen is via `SollicitatieBijlage`, die zelf
  weer achter de `/api/sollicitatiebeheer/*`-routebeveiliging zit. Dat is
  de daadwerkelijke toegangscontrole, niet een check in de Function zelf.

## 9. Volledig overzicht Azure Functions

Alle Functions gebruiken `"authLevel": "anonymous"` in hun `function.json`
— geen enkele doet een eigen auth-check in code. Toegangscontrole voor de
schrijf-/beheer-endpoints loopt volledig via de route-restricties in
`staticwebapp.config.json` (sectie 10). Endpoints die daar bewust
**niet** onder vallen zijn echt publiek bedoeld (bezoekers/kandidaten
zijn niet ingelogd).

| Function | Route | Toegang | Doet |
|---|---|---|---|
| `GetVacatures` | `GET /api/GetVacatures` | Publiek | Alle vacatures met status `gepubliceerd`. Gebruikt door `vacatures.html` én door `generate.js` bij build-tijd. |
| `GetVacaturesPerLand` | `GET /api/GetVacaturesPerLand` | Publiek | Telt gepubliceerde vacatures per land t.b.v. de Europa-kaart (sectie 4). Route bewust niet gestart met "vacatures". |
| `Thumbnail` | `GET /api/Thumbnail` | Publiek | Verkleint/comprimeert een mediabibliotheek-bestand on-the-fly (sectie 5). Route bewust niet gestart met "media". |
| `MediaUpload` | `POST /api/media` | Authenticated | Uploadt een afbeelding naar de publieke mediabibliotheek. |
| `MediaList` | `GET /api/media` | Authenticated | Lijst van alle bestanden in de mediabibliotheek (voor hergebruik in het beheerformulier). |
| `MediaDelete` | `DELETE /api/media/{naam}` | Authenticated | Verwijdert 1 bestand uit de mediabibliotheek. |
| `VacaturesList` | `GET /api/vacatures` | Authenticated | **Alle** vacatures, ongeacht status (admin-overzicht — anders dan `GetVacatures`). |
| `VacatureGet` | `GET /api/vacatures/{id}` | Authenticated | 1 vacature ophalen voor het beheerformulier. |
| `VacatureCreate` | `POST /api/vacatures` | Authenticated | Nieuwe vacature; valideert alle vaste waardelijsten; triggert rebuild indien meteen gepubliceerd. |
| `VacatureUpdate` | `PUT /api/vacatures/{id}` | Authenticated | Wijzigt vacature. Merget `translations` per taal i.p.v. te overschrijven (zodat opslaan vanuit het nog-niet-meertalige formulier andere talen niet wist). Triggert rebuild bij elke publiceer/depubliceer-overgang. |
| `VacatureDelete` | `DELETE /api/vacatures/{id}` | Authenticated | Definitief verwijderen (niet hetzelfde als "intrekken" = status `gearchiveerd` zetten). Triggert rebuild als de verwijderde vacature gepubliceerd was. |
| `VacaturesTick` | `POST /api/onderhoud/vacaturesTick` | **Gedeeld secret** (header `x-tick-secret`, env var `VACATURES_TICK_SECRET`) | Geplande overgangen: `ingepland→gepubliceerd` zodra de publicatiedatum is bereikt, `gepubliceerd→gesloten` zodra de sluitingsdatum voorbij is. Aangeroepen door de uurlijkse cron in `.github/workflows/vacatures-tick.yml` (geen timer-trigger mogelijk op Static Web Apps' managed Functions). |
| `SollicitatiesList` | `GET /api/sollicitatiebeheer` | Authenticated | Alle sollicitaties, voor het kanban-/lijstoverzicht. |
| `SollicitatieUpdate` | `PUT /api/sollicitatiebeheer/{id}` | Authenticated | Wijzigt `status` en/of `notities` (los van elkaar instuurbaar). Sanitized notities, bouwt de audittrail op. |
| `SollicitatieDelete` | `DELETE /api/sollicitatiebeheer/{id}` | Authenticated | Verwijdert de sollicitatie + bijbehorende blob(s) in `sollicitatie-bijlagen`. |
| `SollicitatieBijlage` | `GET /api/sollicitatiebeheer/{id}/bijlage?veld=cv\|motivatiebrief` | Authenticated | Enige manier om een CV/motivatiebrief terug te downloaden (container is privé). |
| `CvUpload` | `POST /api/cv` | **Publiek** (kandidaat is niet ingelogd) | Upload van CV/motivatiebrief vóór het indienen van een sollicitatie. Max 5MB, alleen pdf/doc/docx. |
| `SollicitatieCreate` | `POST /api/sollicitaties` | **Publiek** | Dient de sollicitatie zelf in (ná `CvUpload`). Valideert verplichte velden + e-mailformaat, koppelt aan een bestaande vacature. |
| `GetRoles` | `POST /api/GetRoles` | Platform-intern | Static Web Apps' "roles"-callback. **Nog niet actief gekoppeld**, zie sectie 10. |

**Gedeelde modules** (`api/shared/`): `vacaturesTable.js` (sectie 6),
`sollicitatiesTable.js` (sectie 7), `mediaContainer.js` /
`cvBijlagenContainer.js` (sectie 8), `huidigeGebruiker.js` (leest de
ingelogde gebruiker uit de `x-ms-client-principal`-header),
`rebuildTrigger.js` (`triggerRebuild()` + `raaktPubliekeSite()`, zie
sectie 6/12 — faalt altijd "stil", een mislukte rebuild-trigger mag nooit
de onderliggende CRUD-operatie laten falen).

## 10. Authenticatie en autorisatie

**Routebeveiliging** (`staticwebapp.config.json`, exacte regels):

```json
{ "route": "/beheer/*", "allowedRoles": ["authenticated"] },
{ "route": "/api/vacatures*", "allowedRoles": ["authenticated"] },
{ "route": "/api/media*", "allowedRoles": ["authenticated"] },
{ "route": "/api/sollicitatiebeheer/*", "allowedRoles": ["authenticated"] }
```

Een niet-ingelogde bezoeker op een beveiligde route krijgt een 401, die
via `responseOverrides` doorstuurt naar de Microsoft/Entra-inlogpagina.

**Belangrijk, nog openstaand gat tussen ontwerp en werkelijkheid:**
`ARCHITECTUUR-HR-PORTAAL.md` beschrijft 4 beveiligingslagen, waarvan de
laatste 2 **nog niet actief** zijn:

1. ✅ Entra ID-inlogpoort (ingebouwd in Static Web Apps).
2. ✅ Tenant-restrictie (alleen accounts binnen de OG Clean Fuels tenant
   kunnen inloggen — hoort bij de App Registration-configuratie).
3. ⏳ **Groep-restrictie** (beveiligingsgroep "HR-Portaal-Toegang",
   alleen echte HR-gebruikers) — bedoeld als dé echte grens van wie bij
   het portaal mag, maar wordt nergens afgedwongen.
4. ⏳ **Rolgebaseerde routebeveiliging**: `api/GetRoles` is volledig
   geschreven (checkt via Microsoft Graph `checkMemberGroups` of de
   ingelogde gebruiker in de groep zit, kent dan rol `hrbeheer` toe) —
   maar is **niet gekoppeld**. `staticwebapp.config.json` mist de
   `"auth": { "rolesSource": "/api/GetRoles" }`-instelling, en
   `allowedRoles` staat nog op het generieke `["authenticated"]` i.p.v.
   `["hrbeheer"]`. Reden (letterlijk uit de code-comment in
   `api/GetRoles/index.js`, bevestigd in `VOORTGANG.md`): `rolesSource`
   vereist de **Standard SKU** van Azure Static Web Apps, en die
   upgrade is bewust uitgesteld (kosten).

**Praktisch gevolg, nu:** elk account binnen de OG Clean Fuels Entra-
tenant kan bij `/beheer/*` en alle beheer-API's — niet alleen leden van
de groep "HR-Portaal-Toegang". Dit is een bewuste, bekende, tijdelijke
situatie (geen bug), maar wel iets om in de gaten te houden zolang de
SKU-upgrade niet is doorgevoerd.

**Wat nodig is om dit alsnog te activeren** (uit `VOORTGANG.md`):
Standard-SKU-upgrade → `"auth": {"rolesSource": "/api/GetRoles"}`
toevoegen → `allowedRoles` naar `["hrbeheer"]` → 4 Application Settings
instellen (`HR_TENANT_ID`, `HR_CLIENT_ID`, `HR_CLIENT_SECRET`,
`HR_GROUP_ID`) → de App Registration de Graph-permissie
`GroupMember.Read.All` geven (admin consent).

**`VacaturesTick`** is de uitzondering: die wordt aangeroepen door een
GitHub Actions-workflow, niet door een ingelogde browsersessie, en is
dus beveiligd met een eigen gedeeld secret (`x-tick-secret`-header)
i.p.v. de Entra ID/rollen-mechaniek.

## 11. Beheerportaal (`/beheer/*`)

4 pagina's, allemaal losstaande HTML-bestanden met eigen inline
`<script>` (geen gedeelde JS-module, elke pagina duplicere o.a. zijn
eigen `/.auth/me`-aanroep voor de "Ingelogd als ..." weergave). Geen
framework, vanilla DOM-manipulatie (`textContent`, niet `innerHTML`,
voor door gebruikers ingevoerde data — XSS-veilig). Elke paginawissel is
een volledige nieuwe page load + verse data-fetch, geen gedeelde
client-side store.

**`beheer/index.html` — vacature-overzicht.** Vacatures gegroepeerd in
secties per status (vaste volgorde: gepubliceerd, ingepland, concept,
gesloten, gearchiveerd; een lege sectie wordt overgeslagen). Kolommen
sorteerbaar (titel, afdeling, sluitingsdatum, aantal sollicitaties — dat
laatste live berekend uit een aparte `GET /api/sollicitatiebeheer`-call).
Verwijderen vraagt een `confirm()`.

**`beheer/vacature.html` — vacature aanmaken/bewerken.** De meest
complexe pagina. Alle vaste velden (afdeling, locatie, werkgebied,
dienstverband, opleidingsniveau, salaris, data, status), headerkeuze
(foto-upload/bestaande foto/video-URL), en een volledige **meertalige
body-blok-editor**: 6 taaltabbladen (EN verplicht, kleurdot per taal
toont of de titel al is ingevuld), blokken toevoegen/herordenen/
verwijderen per taal, een knop "kopieer blokstructuur naar alle talen"
(kopieert alleen de structuur, niet de tekst — voorkomt per-ongeluk
leeglaten, dwingt niet tot hertypen van lay-out). Mediabibliotheek-
kiezer is een herbruikbare factory-functie, ook bruikbaar binnen
herhaalbare lijst-items (bv. teamfoto's). Client-side wordt alleen
gecontroleerd dat de EN-titel is ingevuld — **geen** check op geldige
status-overgangen (elke status is vanuit elke andere direct kiesbaar in
de dropdown, de lineaire flow uit het architectuurdocument wordt in de
UI niet afgedwongen).

**`beheer/sollicitaties.html` — sollicitatiepijplijn.** 4 weergaves:
Bord (kanban, 6 kolommen = `BORD_FASES`, HTML5 drag-and-drop),
Lijst (sorteerbare tabel), Afgewezen, Archief (= status `ingetrokken`).
Alle filtering/sortering gebeurt client-side op 1 keer geladen dataset
(vacature, fase, "langer dan N dagen in huidige fase", naam-zoekveld).
"Veroudering"-indicator (groen `<3` dagen, oranje `3-7`, rood `>7`
sinds de laatste statuswijziging) wordt ook hergebruikt op de
dossierpagina. Net als bij vacatures: **geen** afdwinging van toegestane
status-overgangen — elke kolom/status is vanuit elke andere bereikbaar.

**`beheer/sollicitatie-dossier.html` — kandidaatdossier.** Contactgegevens,
motivatietekst, CV/motivatiebrief-downloadlinks
(`/api/sollicitatiebeheer/{id}/bijlage?veld=...`), volledige statushistorie
(tijdlijn, met wie de wijziging deed), en een notitieveld
(`contenteditable` met een minimale rich-text-toolbar via
`document.execCommand`, expliciet gekozen als lichtgewicht alternatief
voor een externe editor-library). Status wijzigen en notities opslaan
zijn 2 losse acties/API-calls.

## 12. Build & deploy (CI/CD)

**`.github/workflows/azure-static-web-apps-victorious-sea-0b50b4303.yml`** —
de hoofdworkflow. Draait bij: push naar `main`, elke PR (open/sync/reopen/
close), 2x per dag (09:00 en 14:00 UTC), en handmatig. Stappen:
1. `cd scripts/generate-vacatures && npm install && node generate.js` —
   genereert alle vacature-detailpagina's (zie sectie 1), met
   `VACATURES_API_URL` wijzend naar de live `GetVacatures`-Function.
2. `Azure/static-web-apps-deploy@v1` — bouwt en deployt de hele repo
   (`app_location: "/"`, `api_location: "api"`, `output_location: "."`).

Een losse job sluit de preview-deployment weer af zodra een PR dicht
gaat.

**`.github/workflows/vacatures-tick.yml`** — losse workflow, uurlijkse
cron (`0 * * * *`), roept alleen `POST /api/onderhoud/vacaturesTick` aan
met het gedeelde secret (sectie 9/10). Dit vervangt een Timer-triggered
Function, die Static Web Apps' managed Functions niet ondersteunen.

**On-demand rebuild**: buiten de 2x-daags/elke-push schema's om, triggert
elke publiceer/depubliceer-actie in de beheer-API's zelf ook een
`workflow_dispatch` van de hoofdworkflow (`api/shared/rebuildTrigger.js`),
zodat een nieuw gepubliceerde vacature niet tot 5 uur hoeft te wachten
om live te komen.

## 13. Bekende aandachtspunten

- **Rolgebaseerde toegang nog niet actief** — zie sectie 10. Op dit
  moment kan elk tenant-account bij het hele beheerportaal, niet alleen
  HR.
- **Sollicitatie-statusmodel wijkt af van het architectuurdocument.**
  `ARCHITECTUUR-HR-PORTAAL.md` beschrijft
  `Nieuw → In behandeling → Afgewezen/Aangenomen → Bewaard → Gearchiveerd`;
  de werkelijke implementatie (`api/shared/sollicitatiesTable.js`) is
  `nieuw → screening → eerste_gesprek → tweede_gesprek → aanbod → aangenomen`
  plus de 2 losse exit-statussen `afgewezen`/`ingetrokken`. Geen
  "Bewaard"-status. Het architectuurdocument is op dit punt verouderd
  t.o.v. de code; dit document (en de code) is leidend.
- **Geen afgedwongen status-overgangen** in de UI, voor zowel vacatures
  als sollicitaties — elke status is vanuit elke andere direct te
  kiezen. Werkt in de praktijk prima zolang HR zich aan de bedoelde
  volgorde houdt, maar is geen harde garantie.
- **`/api/sollicitatiebeheer/*`-route**: de glob in
  `staticwebapp.config.json` heeft een `/` vóór de `*`
  (`"/api/sollicitatiebeheer/*"`), terwijl `/api/vacatures*` en
  `/api/media*` géén `/` vóór de `*` hebben. Voor zover getest dekt dit
  ook de kale `GET /api/sollicitatiebeheer` (geen pad erachter), maar dit
  is het enige inconsistente patroon van de 3 restricties — de moeite
  waard om bij een volgende wijziging aan deze routes expliciet te
  verifiëren (bv. door uitgelogd `/api/sollicitatiebeheer` te proberen op
  de live site) in plaats van op aan te nemen dat het blijft werken.
- **SEO** — zie het losse gesprek/de scan die eerder is gedaan (geen
  apart document, bevindingen staan in de chatgeschiedenis/`VOORTGANG.md`):
  geen sitemap.xml/robots.txt, duplicate content tussen taalprefixen op
  de marketingpagina's (zelfde onderliggende oorzaak als de i18n-
  fallback: vertaling is client-side), 302 i.p.v. 301 op de
  taalprefix-redirects, missende meta descriptions op een aantal
  pagina's. Nog niet opgelost.
