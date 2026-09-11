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
- Rebuild-trigger gebouwd: `api/shared/rebuildTrigger.js` roept GitHub's
  `workflow_dispatch` API aan om een nieuwe site-build te starten, zodra
  een statuswijziging de publieke zichtbaarheid raakt (een vacature wordt
  "gepubliceerd", of verlaat die status). Gekoppeld aan `VacatureCreate`
  (direct op "gepubliceerd" gezet), `VacatureUpdate` (elke wijziging waar
  "gepubliceerd" bij betrokken is, ook een content-wijziging aan een
  reeds live vacature), `VacatureDelete` (een live vacature verwijderen)
  en `VacaturesTick` (1 rebuild per hele tick-run, niet per gewijzigde
  vacature). Best-effort: een falende trigger blokkeert de CRUD-actie
  zelf niet, alleen loggen. Vereist een nieuwe Application Setting
  `GITHUB_REBUILD_TOKEN` (zie hieronder).
  Echt getest tegen Azurite (node-fetch gemockt om de echte GitHub API
  niet te raken): 9 scenario's, o.a. direct publiceren, content-wijziging
  aan een live vacature, sluiten, verwijderen van een live vs. een
  niet-live vacature, en dat een tick-run met meerdere statuswijzigingen
  precies 1 keer triggert, niet per vacature.
- Bug gevonden en gefixt: "+ Nieuwe vacature" in `/beheer` gaf een 404.
  Oorzaak: Azure Static Web Apps serveert `/beheer` (zonder trailing
  slash) server-side als `beheer/index.html`, zonder de URL-balk aan te
  passen naar `/beheer/`. De relatieve links in `beheer/index.html` en
  `beheer/vacature.html` (`vacature.html`, `index.html`, `../styles.css`)
  resolveerden daardoor tegen het verkeerde basispad. Opgelost door alle
  links en stylesheets in `beheer/` absoluut te maken. Lokaal getest met
  een Playwright-scenario dat dit exacte gedrag nabootst.

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
`AZURE_STORAGE_CONNECTION_STRING` staat als Application Setting op de
Static Web App.

## Afgerond: SITE_URL repository variable

GitHub Actions repository variable `SITE_URL` staat
(`https://victorious-sea-0b50b4303.7.azurestaticapps.net`). `generate.js`
en `vacatures-tick.yml` bereiken de live site nu correct. Zodra het custom
domain live gaat: alleen deze ene variable aanpassen, geen code- of
workflow-wijziging nodig.

## Afgerond: VacaturesTick secret

`VACATURES_TICK_SECRET` staat op beide plekken (Application Setting op de
Static Web App, en als GitHub Actions repository secret), met dezelfde
waarde. `VacaturesTick` en de cron-workflow werken nu.

## Afgerond: admin consent voor Werkenbij-HR-Portaal

Een tenant-beheerder heeft admin consent gegeven. Wouter kan nu inloggen
op `/beheer`.

## Afgerond: GITHUB_REBUILD_TOKEN

Personal access token aangemaakt en als Application Setting
`GITHUB_REBUILD_TOKEN` op de Static Web App gezet. Een statuswijziging in
`/beheer` triggert vanaf nu automatisch een nieuwe build, in plaats van te
wachten op de vaste 9:00/14:00-build.

## Bezig: site vullen met vacatures

Sinds de omzetting van `GetVacatures` naar Table Storage stond de site
leeg (oude SharePoint-vacatures vervallen). Wouter is deze aan het
opnieuw aanmaken in `/beheer`: 1 testvacature staat er al in.

Daarbij kwam een 404 op de gegenereerde detailpagina naar boven: die is
statisch (gegenereerd bij een build), en er was nog geen build geweest
sinds het aanmaken van die testvacature (`GITHUB_REBUILD_TOKEN` stond op
dat moment nog niet). Opgelost met een eenmalige handmatige
`workflow_dispatch`-trigger; met het token nu actief gebeurt dit
voortaan automatisch.

Nog te doen: 3 extra testvacatures. Wouter kan dit zelf in `/beheer`, of
Claude levert de content aan om te kopiëren/plakken (netwerktoegang tot
de live site ontbreekt vanuit de sandbox, dus zelf de API aanroepen kan
niet).

## Afgerond: sollicitatieproces

Kandidaten kunnen nu daadwerkelijk solliciteren op een vacature (het
sollicitatieformulier op elke vacature-detailpagina stond er al, maar
deed nog niets — `solliciteer.js` was een lege placeholder).

- Nieuwe Table Storage-tabel `Sollicitaties`, met de statussen uit
  `ARCHITECTUUR-HR-PORTAAL.md` (nieuw, in_behandeling, afgewezen,
  aangenomen, bewaard, gearchiveerd).
- Nieuwe private Blob-container `sollicitatie-bijlagen` voor CV's en
  motivatiebrieven (in tegenstelling tot de mediabibliotheek niet publiek
  leesbaar).
- `CvUpload` (POST `/api/cv`) en `SollicitatieCreate`
  (POST `/api/sollicitaties`), beide publiek/anoniem toegankelijk: een
  kandidaat is niet ingelogd. Valideert bestandstype (pdf/doc/docx, max
  5MB), verplichte velden, een geldig e-mailadres en dat de vacatureId
  bestaat.
- `SollicitatiesList`/`Update`/`Delete`/`Bijlage` onder
  `/api/sollicitatiebeheer/*` (beperkt tot "authenticated"): nieuwe
  beheerpagina `beheer/sollicitaties.html` toont alle sollicitaties,
  met statuswijziging, CV/motivatiebrief-download en verwijderen.
- Bewust **geen** automatische e-mailnotificatie bij een nieuwe
  sollicitatie (kan later toegevoegd worden).
  Echt getest tegen Azurite (volledige backend-flow + alle
  validatiefouten) en in een browser met Playwright (het publieke
  formulier, inclusief een clientside geweigerd bestandstype, en het
  beheeroverzicht).

## Afgerond: huisstijl conform Employer Branding Brandbook V2

De publieke site (`index.html`, `vacatures.html`, `over-ons.html`, de
gegenereerde vacature-detailpagina's) volgt nu het brandbook dat Wouter
heeft aangeleverd. Alleen de oranje-familie (#F18700/#F9B662/#C96100)
plus cream/wit, geen groen: dat zit in het officiële palet niet, alleen
in het logo-icoon zelf.

- Nieuwe `.titel-highlight`-utility: een deel van een kop in een gekleurd
  blokje, zoals "BOLD. EAGER. HUMAN." en "YOUNG PROFESSIONALS" in het
  brandbook.
- Nieuwe `.paneel-orange`/`-licht`/`-donker`-utilities: tekstblokken
  opbreken met een volle achtergrondkleur i.p.v. steeds dezelfde
  neutrale kaart, zoals de WHY/HOW/WHAT-kaarten in het brandbook.
  Toegepast op de Bold/Eager/Human-kaarten, met dezelfde volgorde en
  kleurtoewijzing op zowel `index.html` als `over-ons.html`.
- Koppen op een lichte achtergrond (`.section-head h2`) in oranje i.p.v.
  zwart: in het brandbook staan titels op cream/wit altijd in een tint
  uit de oranje-familie.
- De kleine eyebrow/tag-labeltjes (bv. "WAAROM OG CLEAN FUELS", "OVER
  ONS") zijn nu een dicht oranje kleurblok met witte tekst, zoals in het
  brandbook ("TYPOGRAPHY", "COLOR PALETTE") — voorheen zwart (`.eyebrow`)
  of alleen gekleurde tekst zonder blok (`.tag`).
- Grijze achtergronden in de arbeidsvoorwaarden-/collega-quote-
  body-blokken en het contact-/sollicitatieblok vervangen door het
  warmere `--og-cream`.
- Subtiele scale-in toegevoegd aan de bestaande scroll-reveal-animatie,
  en de label-/tag-chips krijgen een kleine, licht vertraagde "pop"
  zodra hun kaart in beeld komt.

Tot stand gekomen in een paar iteraties op basis van screenshot-feedback
van Wouter (kaarten op over-ons.html moesten gelijk aan index.html,
titels waren nog zwart, eyebrow/tag misten de kleurblok-achtergrond).

## Afgerond: vacature-detailpagina opgeschoond

- `uitgelichte_quote`-blok herontworpen: volle-breedte donker-oranje
  band met een grote decoratieve aanhalingsteken, i.p.v. een generiek
  gekleurd tekstvakje.
- `video_embed`-blok breekt nu ook uit naar volle schermbreedte.
- Foto-upload (headerfoto en afbeeldingen binnen body-blokken) stuurde
  het Content-Type van de browser mee i.p.v. `application/octet-stream`,
  inconsistent met hoe het sollicitatieformulier dat al deed. Gefixt,
  maar bleek niet de (enige) oorzaak van de falende headerfoto-upload.
- De 4 vaste stockfoto's onder de omschrijving (office-sfeer.webp e.a.)
  verwijderd: een leftover uit de oorspronkelijke SharePoint-build.
- De gemelde "omschrijving bij sollicitatieproces niet zichtbaar" bleek
  bij grondig testen (API, editor-rondgang, gegenereerde pagina) overal
  correct te werken; geen bug gevonden.

## Afgerond: headerfoto-upload gaf 500 ("Public access is not permitted")

Echte oorzaak van de falende headerfoto-upload: de Storage Account had
"Anonieme blobtoegang toestaan" uitgeschakeld (de huidige Azure-default
voor nieuw aangemaakte accounts). Onze mediabibliotheek heeft dit wél
nodig, headerafbeeldingen moeten rechtstreeks door bezoekers geladen
kunnen worden zonder in te loggen. Wouter heeft dit aangezet in Azure
Portal → Storage Account → Configuratie → "Anonieme blobtoegang
toestaan" → Ingeschakeld.

Dit loste het echter niet meteen op: de 500 bleef terugkomen met exact
dezelfde RequestId en timestamp als vóór de instelling was aangepast.
Oorzaak: `mediaContainer.js` (en dezelfde patroon in
`cvBijlagenContainer.js`, `vacaturesTable.js`, `sollicitatiesTable.js`)
cachte de container-/tabel-client als een lazy-promise, inclusief een
FALENDE poging — eenmaal gefaald, bleef de Function-instance die oude
fout voor altijd herhalen zonder ooit opnieuw te proberen. Gefixt: een
mislukte poging wordt niet meer gecached, de volgende aanroep probeert
het gewoon opnieuw.

## Afgerond: headerfoto sloeg op maar toonde niet, en beheer-overzicht opgeruimd

Derde en laatste laag van hetzelfde headerfoto-probleem: de upload lukte
nu wel, maar de afbeelding bleef onzichtbaar op de vacature-detailpagina.
Oorzaak: `createIfNotExists({ access: "blob" })` past de publieke
toegang alleen toe op het moment dat de container daadwerkelijk wordt
aangemaakt. De "media"-container bestond echter al (aangemaakt tijdens
de periode dat publieke blobtoegang nog uitstond), dus die optie had
geen effect meer en de container bleef feitelijk privé. Gefixt door na
`createIfNotExists` altijd expliciet `containerClient.setAccessPolicy
("blob")` aan te roepen, ongeacht of de container al bestond. Lokaal
end-to-end geverifieerd: upload → publieke GET zonder inlog → afbeelding
laadt echt op de gegenereerde pagina.

Daarnaast het vacature-overzicht in `/beheer` verbreed en de kolommen
opnieuw verdeeld (titelkolom breder, actieknoppen lopen niet meer vast)
op verzoek van Wouter.

## Afgerond: sticky header met logo-wissel + vacature-hero overlay

Wouter heeft de echte OG Clean Fuels-logobestanden aangeleverd (kleur en
wit, staand). Daarmee de header op index.html, over-ons.html en
vacature-detailpagina's (met headerfoto) omgebouwd naar hetzelfde gedrag
als de corporate website: transparant met wit logo bovenaan de hero,
wordt effen wit met het gekleurde logo zodra je voorbij de hero scrolt.
Huisstijl-oranje gebruikt in plaats van het groen uit het aangeleverde
logo. `vacatures.html` heeft geen hero en blijft daarom altijd gewoon
effen wit, geen wijziging daar.

Vacature-detailpagina's met een headerfoto/video tonen de titel,
meta-info en een "Solliciteer direct!"-knop nu rechtstreeks overlayd op
de headerafbeelding zelf (met een donkere schaduw-gradient voor
leesbaarheid), met een broodkruimelpad eronder. Vacatures zonder
headerfoto vallen terug op de oude platte titel-sectie.

De aangeleverde logo-bestanden staan onder `images/logo/`; daaruit ook
een icoon-only crop gesneden (kleur en wit) specifiek voor gebruik in de
compacte header, naast de originele staande lockup-bestanden.

## Afgerond: kop bij meer blokken, opsommingstekens i.p.v. iconen

De blokken "Tekst", "Tekst in kolommen", "Afbeelding + tekst" en
"Veelgestelde vragen" hebben nu net als de andere blokken een optioneel
kop-veld.

"Bullet-lijst" en "Arbeidsvoorwaarden-grid" gebruikten per punt een vrij
in te vullen emoji als icoon; dat is verwijderd (uit zowel de
beheer-editor als de weergave op de site). In plaats daarvan een vast
opsommingsteken uit de huisstijl (een klein oranje blokje) voor ieder
punt. Een eigen iconenset kan later eventueel alsnog toegevoegd worden,
maar dat is bewust nog niet gedaan.

De sluitingsdatum-banner ("Nog X dagen om te solliciteren") zag er al
uit als een knop, maar deed niets bij een klik. Is nu een link die naar
het sollicitatieformulier verderop op de pagina scrollt.

## Afgerond: header toont volledige logo-afbeelding

Correctie op de sticky header hierboven: Wouter gaf terecht aan dat de
header niet alleen het uitgesneden beeldmerkje moest tonen, maar de
volledige aangeleverde logo-afbeelding (beeldmerk + "og" + "clean
fuels"), net als op de corporate website. De uitgesneden icoon-only
crops zijn verwijderd; de header gebruikt nu rechtstreeks
`images/logo/og-logo-wit.png` en `og-logo-kleur.png`, geschaald op
hoogte. Wit/kleur-wissel bij het scrollen ongewijzigd.

## Afgerond: eigen huisstijl-lettertypes zelf gehost i.p.v. Anton/Google Fonts

Wouter merkte terecht op dat het lettertype niet overeenkwam met wat OG
normaal gebruikt. Root cause: het brandbook was destijds als screenshots
aangeleverd (kleuren/lay-out zichtbaar, geen los fontbestand of
merknaam), dus is toen 'Anton' (Google Fonts) gekozen als stijl-
benadering — niet het echte merklettertype. Wouter heeft nu de
daadwerkelijke fontbestanden aangeleverd.

- Koppen/knoppen/labels: 'Anton' → **'Komu'** (het echte merklettertype).
- Bodytekst: 'Open Sans' bleek al de juiste familie, nu zelf gehost
  i.p.v. via de Google Fonts CDN (geen externe afhankelijkheid meer).
- Aangeleverde .otf/.ttf-bestanden geconverteerd naar .woff2 (kleiner,
  bv. de Open Sans variable font van ~530KB naar ~280KB), opgeslagen
  onder `fonts/`. De losse statische Open Sans-gewichten die ook waren
  aangeleverd (Bold/ExtraBold/Medium/SemiBold) zijn niet apart
  meegenomen: de aangeleverde variabele font dekt dat hele
  gewicht-bereik al in 1 bestand.

## Afgerond: het juiste Komu-lettertype-bestand gevonden

Vervolg op de eigen-lettertypes-migratie hierboven: de eerder aangeleverde
bestanden ("KOMU B (2).otf" en een herupload via fonnts.com) bleken
byte-voor-byte identiek en een andere, lichtere snit ("Komu Book") dan wat
ogcleanfuels.com daadwerkelijk gebruikt — bevestigd via devtools
(font-family/font-weight klopten wel, de snit niet) en een glyph-
vergelijking. Wouter heeft het echte bestand rechtstreeks uit de
Network-tab van de live site gehaald: `Komu-Bold.woff2`. Dat is nu
verwerkt in `fonts/`, de foute bestanden zijn verwijderd.

Open puntje: mogelijk past de corporate site nog een `transform` of
`letter-spacing` toe op de grote hero-titel (768px+ media query) die niet
volledig zichtbaar was in de aangeleverde devtools-screenshot. Nog te
bevestigen door Wouter.

## Nog open

- Automatische e-mailnotificatie bij een nieuwe sollicitatie (bewust
  uitgesteld, zie hierboven).
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
