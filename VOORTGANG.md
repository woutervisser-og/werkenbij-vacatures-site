# Voortgang HR-portaal

Bijgehouden beslissingen en status. Voor het ontwerp zelf, zie
`ARCHITECTUUR-HR-PORTAAL.md`. Eenmalige uitvoerende stappenplannen (bv.
handmatige Azure-portal acties) staan niet in een bestand, maar worden in
de chat gedeeld op het moment dat ze nodig zijn.

## Afgerond

- Architectuurdocument (`ARCHITECTUUR-HR-PORTAAL.md`) vastgesteld: overstap
  van SharePoint naar een zelfgebouwd portaal op Azure (Static Web Apps,
  Entra ID, Functions, Table/Blob Storage).
- App Registration `Werkenbij-HR-Portaal` aangemaakt in Entra ID
  (tenant-restricted, los van `Werkenbij-Vacatures-API`). Client ID,
  tenant ID en client secret genoteerd door Wouter.
- Beveiligingsgroep `HR-Portaal-Toegang` aangemaakt (Iska als lid). Object
  ID genoteerd door Wouter.
- Rollen-Function (`api/GetRoles`) gebouwd: checkt via Microsoft Graph of
  de ingelogde gebruiker lid is van `HR-Portaal-Toegang`, kent zo ja de rol
  `hrbeheer` toe. **Nog niet actief gekoppeld** (zie beslissing hieronder).
- Route-restrictie `/beheer/*` ingesteld in `staticwebapp.config.json`, op
  dit moment op basis van "authenticated" (ingelogd met een account binnen
  de tenant), niet op de rol `hrbeheer`.
- Azure Functions CRUD voor vacatures gebouwd (`api/VacaturesList`,
  `VacatureGet`, `VacatureCreate`, `VacatureUpdate`, `VacatureDelete`),
  bovenop Azure Table Storage (`@azure/data-tables`). Route `/api/vacatures*`
  is net als `/beheer/*` beperkt tot "authenticated". Lokaal end-to-end
  getest tegen de Azurite-emulator (create/list/get/update/delete +
  validatie van titel, status en niet-bestaande id's).
- Automatisch publiceren/sluiten gebouwd als `api/VacaturesTick`: een
  HTTP-Function (geen Azure Timer-trigger, want Static Web Apps' managed
  Functions ondersteunen die niet), beveiligd met een gedeelde secret
  (`VACATURES_TICK_SECRET`), elk uur aangeroepen door de nieuwe workflow
  `.github/workflows/vacatures-tick.yml`. Zet "ingepland" om naar
  "gepubliceerd" zodra de publicatiedatum is bereikt, en "gepubliceerd"
  naar "gesloten" zodra de sluitingsdatum is verstreken. Lokaal
  end-to-end getest tegen Azurite (secret-check + statusovergangen).
- Mediabibliotheek gebouwd op Azure Blob Storage (`@azure/storage-blob`):
  `api/MediaUpload` (foto uploaden, alleen jpg/jpeg/png/webp/gif),
  `api/MediaList` (bestaande foto's tonen om te hergebruiken) en
  `api/MediaDelete`. Container `media` heeft publieke leestoegang op
  blob-niveau (nodig zodat headerafbeeldingen rechtstreeks op de site
  laden), maar de container-inhoud is niet op te sommen zonder de
  (beveiligde) `MediaList`-Function. Route `/api/media*` is net als
  `/api/vacatures*` beperkt tot "authenticated". Lokaal end-to-end getest
  tegen Azurite (upload/list/delete, bestandstype-validatie, en dat de
  geüploade inhoud publiek en ongewijzigd terug op te halen is).
- Eerste `/beheer`-interface gebouwd: `beheer/index.html` (overzicht met
  status, bewerken/verwijderen) en `beheer/vacature.html` (aanmaken/
  bewerken van de vaste velden: titel, afdeling, locatie, dienstverband,
  opleidingsniveau, salaris (of "in overleg"), publicatie-/sluitingsdatum,
  status, en de header: foto (uploaden of hergebruiken uit de
  mediabibliotheek) of video-URL). Bewust nog **zonder** de body-blokken-
  editor (14 bloktypes); dat is een aparte, latere stap. Echt getest in
  een browser (Playwright) tegen een lokale server die de Functions
  rechtstreeks aanroept op Azurite: aanmaken, bewerken, statuswijziging,
  mediabibliotheek hergebruiken, verwijderen. Daarbij een echte bug
  gevonden en gefixt: de "geen vacatures"-melding bleef verborgen na het
  verwijderen van de laatste vacature.
- Body-blokken-editor toegevoegd aan `beheer/vacature.html`: alle 14
  bloktypes uit `ARCHITECTUUR-HR-PORTAAL.md` (intro's, tekst(kolommen),
  quotes, afbeelding+tekst, bullet-lijst, arbeidsvoorwaarden-grid,
  video, team-voorstelling, sollicitatieproces, FAQ,
  sluitingsdatum-banner), met toevoegen/verwijderen/herordenen, en
  hergebruik van de mediabibliotheek voor de afbeelding-velden binnen
  blokken. Echt getest in een browser (Playwright): blokken toevoegen
  (tekst, een lijst-type met items toevoegen/verwijderen, een
  afbeelding-type met echte foto-upload), herordenen, opslaan, en
  daarna opnieuw openen om te bevestigen dat alles correct terugkomt.
- `GetVacatures` omgezet van SharePoint naar Table Storage: toont alleen
  vacatures met status "gepubliceerd". `scripts/generate-vacatures/generate.js`
  haalt nu op bij deze Function (de live site) in plaats van rechtstreeks
  bij SharePoint/Graph, en rendert de body-blokken naar HTML voor de
  gegenereerde detailpagina's (alle 14 types). `vacatures.html` gebruikt
  de nieuwe velden (`locatie` i.p.v. `land`, samenvatting uit het eerste
  tekstuele body-blok i.p.v. de oude platte `omschrijving`). JSON-LD/SEO-
  opzet qua structuur ongewijzigd, alleen de brondata en de
  locatie-/salarisvelden aangepast aan het nieuwe schema. De SharePoint-
  secrets (`SP_*`) zijn uit de build-stap van de GitHub Actions workflow
  gehaald, worden niet meer gebruikt.
  Echt getest: een testvacature met alle 14 bloktypes aangemaakt via de
  CRUD-API, `generate.js` er lokaal op losgelaten (tegen een lokale
  server i.p.v. de live site, via de nieuwe env var `VACATURES_API_URL`),
  en de gegenereerde pagina + `vacatures.html` in een browser bekeken:
  alle blokken renderen, FAQ klapt uit, sluitingsdatum-banner telt goed,
  meta-description en geldige JSON-LD aanwezig.
- CI faalde eerst met een 404: het live-URL van de Static Web App was een
  aanname (`victorious-sea-0b50b4303.azurestaticapps.net`), het echte
  adres bevat een extra label (`victorious-sea-0b50b4303.7.azurestaticapps.net`).
  Hersteld, en om herhaling te voorkomen bij het latere custom domain:
  `generate.js` en `vacatures-tick.yml` gebruiken nu allebei 1 centrale
  GitHub Actions repository variable `SITE_URL` (zie hieronder), in
  plaats van het adres los in 2 bestanden hard te coderen.

## Beslissing: SKU-upgrade uitgesteld

Custom rollen (de `rolesSource`-koppeling met `GetRoles`, dus de
groep-check op `HR-Portaal-Toegang`) vereist de **Standard SKU** van Azure
Static Web Apps; de huidige Free SKU ondersteunt dit niet. Bewust gekozen
om nu niet te upgraden (kosten). Tussenoplossing: `/beheer/*` is beperkt
tot ingelogde gebruikers binnen de tenant (laag 1+2 uit
`ARCHITECTUUR-HR-PORTAAL.md`), zonder de groep-check als harde poort.

## Volgende stap (zodra we wel upgraden naar Standard SKU)

- Static Web App upgraden naar Standard SKU.
- In `staticwebapp.config.json` weer `"auth": { "rolesSource":
  "/api/GetRoles" } toevoegen en `allowedRoles` terugzetten naar
  `["hrbeheer"]`.
- Application Settings voor de rollen-Function instellen: `HR_TENANT_ID`,
  `HR_CLIENT_ID`, `HR_CLIENT_SECRET` (van App Registration
  `Werkenbij-HR-Portaal`) en `HR_GROUP_ID` (Object ID van
  `HR-Portaal-Toegang`).
- Op de App Registration `Werkenbij-HR-Portaal` de Application-permission
  `GroupMember.Read.All` toevoegen en admin consent geven, anders kan de
  rollen-Function geen groepslidmaatschap opvragen.

## Afgerond: Azure Storage Account

De blocker bij IT (resource provider `Microsoft.Storage` niet
geregistreerd) is opgelost, Wouter heeft de Storage Account aangemaakt.
Nog te controleren/instellen: of `AZURE_STORAGE_CONNECTION_STRING` al als
Application Setting op de Static Web App staat, anders kunnen de
CRUD-Functions, `VacaturesTick`, de mediabibliotheek én de nu omgezette
`GetVacatures` niets opslaan of ophalen.

## Afgerond: SITE_URL repository variable

GitHub Actions repository variable `SITE_URL` staat
(`https://victorious-sea-0b50b4303.7.azurestaticapps.net`). `generate.js`
en `vacatures-tick.yml` bereiken de live site nu correct. Zodra het custom
domain live gaat: alleen deze ene variable aanpassen, geen code- of
workflow-wijziging nodig.

## Volgende stap (VacaturesTick secret)

- Een geheime waarde bedenken voor `VACATURES_TICK_SECRET` en op 2 plekken
  hetzelfde instellen: als Application Setting op de Static Web App, én
  als GitHub Actions repository secret (Settings → Secrets and variables
  → Actions). Zonder deze secret geeft `VacaturesTick` altijd 401 terug.

## Actie nodig: site staat nu leeg

Sinds de omzetting van `GetVacatures` naar Table Storage (en de merge
daarvan) toont de site **geen vacatures meer**: de oude SharePoint-
vacatures vervallen, en er staat nog niets als "gepubliceerd" in Table
Storage. Bevestigd door Wouter. Actie: de vacatures die eerder in
SharePoint stonden opnieuw aanmaken in `/beheer` en op status
"gepubliceerd" zetten, dan verschijnen ze bij de eerstvolgende build weer
op de site.

## Nog open

- CV-uploads (documenten, niet openbaar) nog te bouwen, samen met de
  sollicitatie-Functions; bewust niet meegenomen in de mediabibliotheek
  omdat die publiek leesbaar is en CV's dat niet mogen zijn.
- Statuswijzigingen triggeren nog geen nieuwe site-build via GitHub
  Actions (nu wél zinvol, `GetVacatures` leest inmiddels van Table
  Storage); nog niet gebouwd.
- Afdeling en locatie zijn nu vrije tekstvelden (geen vaste keuzelijst,
  zoals het architectuurdocument suggereert), omdat er nog geen
  goedgekeurde lijst met waarden is. Later eventueel om te zetten naar
  een select-veld.
- `vacature-detail.html` is een ongebruikt/verweesd bestand (niets linkt
  ernaar, `generate.js` genereert losse statische pagina's per vacature
  onder `/vacature/`). Gebruikt nog de oude veldnamen; niet aangepast in
  deze omzetting omdat het toch nergens aan hangt. Kandidaat om later op
  te ruimen.
- De `SP_*` GitHub Actions secrets (SharePoint) worden niet meer gebruikt
  door de workflow en kunnen op termijn verwijderd worden (Settings →
  Secrets and variables → Actions), zodra bevestigd is dat er verder
  nergens meer naar verwezen wordt.
