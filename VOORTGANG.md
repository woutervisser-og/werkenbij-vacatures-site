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

## Afgerond: vacature-overzicht gegroepeerd per status, sorteerbaar, doorklik naar sollicitaties

Eerste feature uit `FEATURES-BACKLOG.md` gebouwd, plus 2 extra wensen
van Wouter over de tabel-indeling:

- Doorklikken vanuit een vacature naar de bijbehorende sollicitaties:
  elke rij toont het aantal sollicitaties als link naar
  `/beheer/sollicitaties.html?vacatureId=...`, die pagina filtert dan
  automatisch en toont de vacaturenaam in een contextregel.
- Het overzicht toont niet langer 1 platte tabel met een status-kolom,
  maar 1 sectie (met eigen tabel) per status, in vaste volgorde
  (gepubliceerd, ingepland, concept, gesloten, gearchiveerd).
  Gearchiveerde vacatures staan zo niet meer tussen de actieve door.
- Kolomkoppen (Titel/Afdeling/Sluitingsdatum/Sollicitaties) zijn
  klikbaar en sorteren de hele lijst; standaard alfabetisch op titel.

## Afgerond: nieuwe pagina's Werken bij OG + Contact, nav-uitbreiding, 2 kleine fixes

- **Nieuwe pagina `werken-bij-og.html`**: cultuur, wat je kunt
  verwachten, arbeidsvoorwaarden. Content is een eerste creatieve
  invulling van Claude, gebaseerd op de bestaande huisstijl en de
  Bold/Eager/Human-waarden. Arbeidsvoorwaarden bewust generiek (geen
  concrete cijfers als vakantiedagen), want het echte HR-beleid is niet
  bekend.
- **Nieuwe pagina `contact.html`**: HR-contact (hergebruikt dezelfde
  gegevens als op de vacature-detailpagina's, telefoonnummer is nog
  hetzelfde voorbeeld-achtige nummer) plus een verwijzing naar de
  corporate website voor zakelijke vragen. Geen bedrijfsadres/KvK-
  nummer toegevoegd: niet betrouwbaar bekend, dus weggelaten i.p.v.
  verzonnen.
- Navigatie op alle pagina's uitgebreid met "Werken bij OG", "Contact"
  en een externe link naar de corporate site (ogcleanfuels.com, nieuw
  tabblad). "Home" is later weer verwijderd uit de navigatie (het logo
  linkt al naar de homepage).
- Bugfix: bijlagen-knoppen (CV/motivatiebrief) in het
  sollicitatie-overzicht stonden scheef door een inline
  `marginLeft`-hack; nu een echte flex-kolom.
- Bugfix: de oranje "highlight"-blokjes (titel-highlight, label-tag,
  eyebrow, section-head .tag) oogden scheef, met duidelijk meer ruimte
  onder de tekst dan erboven. Root cause (bevestigd via pixelmeting):
  Komu reserveert van nature veel meer onzichtbare ruimte onder de
  basislijn dan boven hoofdletters. Padding gecompenseerd (groter
  boven, kleiner onder, in em) op alle 4 varianten.
- `.recruiter-blok`-stijl verplaatst van de per-pagina `<style>` in
  `generate.js` naar de gedeelde `styles.css`, zodat ook `contact.html`
  'm kan gebruiken.

## Afgerond: hero-uitlijning, consistente kaarten, creatievere blokken

- Hero-tekst (h1/tekst/knoppen) lijnt nu links uit met de content-
  blokken eronder: `.hero-content` gebruikt dezelfde
  max-width:1100px + margin:auto-logica als `section.content`, i.p.v.
  de kale 6%-viewportrand (duidelijk verder naar links op brede
  schermen).
- "Zo werken wij"/"Wat we belangrijk vinden"-kaarten op
  werken-bij-og.html en over-ons.html gebruikten een ander component
  (value-block/icon-label) dan de homepage (teaser-card/label-tag); nu
  overal hetzelfde. Ongebruikte CSS opgeruimd.
- "90% minder CO2"-blok op werken-bij-og.html: het generieke
  cream-kaartje-met-gekleurde-rand (voelde als standaard AI-design)
  vervangen door een opvallend full-bleed statistiek-blok.
- Nieuw op werken-bij-og.html: een video-blok (nette "volgt
  binnenkort"-status, klaar om een echte video-URL in te plakken),
  creatievere "Naast je salaris"-kaarten, en een "Onze
  collega's"-sectie met quotes (illustratief, bewust zonder naam/foto).
- Over-ons.html fors uitgebreid: missie-sectie, full-bleed quote-blok,
  en een "Maatschappelijke betrokkenheid"-sectie (OG Heroes, Beatrix
  Kinderziekenhuis, OG Capitals — reële sponsoring, overgenomen uit een
  screenshot van de corporate over-ons-pagina), geïnspireerd op die
  pagina's structuur maar met eigen werkenbij-tekst.

## Afgerond: echte video verwerkt op werken-bij-og.html

Het video-blok op werken-bij-og.html toonde een placeholder ("volgt
binnenkort"); Wouter heeft de echte YouTube-video aangeleverd
(`https://www.youtube.com/watch?v=jOmrQxv9BQI`). Verwerkt als iframe-embed,
placeholder-CSS (`.blok-video-leeg`) verwijderd. Kon hier niet visueel
geverifieerd worden (deze sandbox heeft geen netwerktoegang tot
youtube.com), embed-markup zelf klopt en werkt zodra live.

## Afgerond: huisstijl op beheerportaal (echt logo + statuskleuren)

De topbar van `/beheer` gebruikte nog een tekst-benadering van het logo
("og clean fuels — beheer"); vervangen door de echte logo-afbeelding
(zelfde als op de publieke site), met een "Beheer"-badge ernaast
(hergebruikt `.label-tag`). Logo linkt naar het vacature-overzicht.

Vacature-statussecties in het overzicht krijgen nu elk een kleurstip +
ingekleurde aantal-pil: gepubliceerd groen, ingepland oranje, concept
lichtgrijs, gesloten roestbruin, gearchiveerd donkergrijs. Bewust geen
gekleurde linkerrand op de hele sectie (voelt als standaard AI-callout-
design, eerder al afgekeurd door Wouter). Lokaal getest met tijdelijke
testvacatures in alle 5 statussen.

## Afgerond: portaalnaam i.p.v. label, meer huisstijl-oranje, uitlijning vacature-hero gefixt

Vervolg op de huisstijl-update van het beheerportaal hierboven, op verzoek
van Wouter:

- Het "Beheer"-label in de topbar vervangen door de portaalnaam
  **"Working at OG portal"** (Komu, oranje-donker), plus een oranje
  accentlijn bovenaan de topbar.
- Meer huisstijl-oranje/creativiteit in het portaal: paginakoppen in
  oranje-donker, tabelkoppen/lijst-items/blok-headers van grijs naar het
  warmere cream, oranje focus-ring op formuliervelden, warmere hover op
  secundaire knoppen.
- **Bugfix, los gevonden tijdens het testen en apart gemeld door Wouter**:
  de header van de vacature-detailpagina's (headerfoto/video met titel
  erop) lijnde niet uit met de rest van de pagina op brede schermen.
  Oorzaak: `.vacature-hero-content` zit in een flex-container
  (`.vacature-hero`), waardoor `max-width:1100px; margin:0 auto` niet
  werkte zoals bij `section.content` (de box kromp mee met de
  tekstbreedte i.p.v. eerst de volle breedte te pakken). Opgelost met
  `width:100%`. Dezelfde onderliggende fout zat ook in `.broodkruimel`,
  ook gefixt.

## Afgerond: kop-formaten (H1/H2) 1-op-1 overgenomen van de corporate site

Wouter merkte op dat H1/H2 qua formaat niet overeenkwamen met de corporate
site. Exacte computed-waarden opgezocht via devtools op ogcleanfuels.com
(font-size, line-height, letter-spacing, font-weight):

- H1: 72px, line-height 0.9, weight 700, letter-spacing normal.
- H2: 40px, line-height 1, weight 700, letter-spacing normal.
- Beide identiek op mobiel: de corporate site verkleint koppen niet apart
  voor kleine schermen.

Toegepast op `.hero h1`, `.vacature-hero-content h1` (was 52px/44px) en
`.section-head h2` (was 34px, sitebreed via 1 regel). De mobiele
font-size-overrides (36px/30px) zijn verwijderd i.p.v. aangepast, want
corporate schaalt zelf ook niet af. Lokaal visueel gecontroleerd op
desktop en mobiel: blijft leesbaar bij de langere Nederlandse titels
(i.t.t. de korte Engelse corporate-teksten), valt gewoon terug op meer
regels.

## Afgerond: meertaligheid (EN basistaal, NL/FR/DE/IT/SE optioneel) — hele site

Alle 7 stappen van de meertaligheid-bouwspecificatie afgerond. Wat begon
als "vertaal de vacatures" is op verzoek van Wouter uitgebreid naar de
hele site: ook de 5 marketingpagina's (index, vacatures, werken-bij-og,
over-ons, contact) zijn nu volledig vertaalbaar, niet alleen de chrome
maar ook de marketingcopy zelf.

- **Datamodel**: vacature-entity uitgebreid met een genest
  `translations`-object per taal (`en`/`nl`/`fr`/`de`/`it`/`se` — `se`
  bewust i.p.v. ISO `sv`, voor consistentie met de corporate site). `en`
  is verplicht, de rest optioneel.
- Bij deze gelegenheid het hele datamodel omgezet naar het Engels
  (`title`, `department`, `location`, `employmentType`,
  `salaryMin`/`Max`/`Negotiable`, `educationLevel`, `closingDate`,
  `publicationDate`), met een **tijdelijke Nederlandse alias-laag** op de
  API-output zodat het beheerformulier en `generate.js` bleven werken
  tijdens de overgang. Die aliassen verdwijnen weer zodra het
  beheerformulier ook wordt omgezet (latere stap). Bewust buiten scope:
  status-waardes (blijven Nederlands) en het sollicitaties-datamodel.
- `VacatureCreate`/`VacatureUpdate` valideren dat `translations.en.title`
  niet leeg is. Een update via het (nog Nederlandse) beheerformulier
  merget talen per stuk i.p.v. het hele `translations`-object te
  vervangen, zodat andere talen niet verdwijnen.
- Backwards compatible zonder migratiescript: een bestaande vacature van
  vóór deze wijziging (platte NL-kolommen, geen `translationsJson`) valt
  bij het lezen automatisch terug op de oude kolommen.
- **`generate.js`**: genereert nu per vacature 1 pagina per taal die
  daadwerkelijk gevuld is in `translations`, i.p.v. altijd precies 1
  pagina, in een submap per taal (`en/vacature/...`, `nl/vacature/...`,
  ...). hreflang-tags toegevoegd (inclusief `x-default` naar EN).

Lokaal getest tegen Azurite: testvacature met EN+NL aangemaakt, 2
bestanden gegenereerd op de juiste plek met correcte `<html lang>` en
hreflang-tags, een vacature zonder NL-vertaling levert geen NL-bestand op.

- **Taalswitcher op de website**: elke gegenereerde vacaturepagina toont,
  direct onder de breadcrumb, alleen de talen die voor díe specifieke
  vacature daadwerkelijk gegenereerd zijn (dezelfde lijst als de
  hreflang-tags). Actieve taal is een niet-klikbare, oranje gemarkeerde
  span. Geen switcher zichtbaar bij een vacature met maar 1 taal.
- **Taal-tabs in het beheerformulier** (`beheer/vacature.html`): 6
  tabbladen (EN/NL/FR/DE/IT/SE), elk met hetzelfde titel-veld + de
  bestaande body-blokken-editor (die editor zelf ongewijzigd, alleen de
  interne "bodyBlokken"-variabele wijst nu naar de array van de actieve
  taal). Statusbolletje per tab (groen/grijs) toont live welke talen
  gevuld zijn. EN blijft verplicht: opslaan wordt clientside geblokkeerd
  als de EN-titel leeg is. Opslaan stuurt het volledige
  `translations`-object naar de bestaande CRUD-endpoint.

Lokaal getest via het echte formulier met Playwright: EN+NL+FR ingevuld
en opgeslagen, API bevestigt correcte data (DE/IT/SE blijven leeg),
generate.js genereert daarna precies 3 pagina's met een correcte
taalswitcher op elke pagina.

- **Hele site vertaalbaar** (`/i18n/`): alle 6 talen (`en`/`nl`/`fr`/`de`/
  `it`/`se`) volledig gevuld, 165 sleutels per taal, 1-op-1 gecontroleerd
  op ontbrekende sleutels en `{{variabele}}`-placeholders t.o.v. `en.json`.
  `fr`/`de`/`it`/`se` zijn buiten het CMS om vertaald (export, vertalen,
  checken, terugzetten in het bestand). Vaste merk-taglines ("We don't
  wait for change. We fuel it.", "Work hard. Laugh hard. Fuel good.") en
  de labels Bold/Eager/Human blijven bewust in het Engels in elke taal:
  dat zijn taal-onafhankelijke merkuitingen, geen te vertalen tekst.
  `i18n.js` is de vanilla-JS runtime voor de 5 marketingpagina's (die 1
  fysiek bestand per taal delen via routing, zie hieronder): leest de
  taal uit het URL-pad, vult `[data-i18n]`-elementen, valt terug op EN,
  maakt interne links taalbewust. `generate.js` heeft zijn eigen
  build-time vertaler (leest dezelfde JSON-bestanden rechtstreeks) voor
  de vacature-detailpagina's, die al 1 bestand per taal hebben.
- **URL-schema volledig symmetrisch**: ook EN kreeg alsnog een echt
  `/en/`-prefix (was eerst de kale root, zoals de spec voorstelde) voor
  volledige consistentie. Vacature-detailpagina's verhuisd van
  `/vacature/<slug>.html` naar `/en/vacature/<slug>.html` (en zo voor
  elke taal). `staticwebapp.config.json` regelt de rewrite/redirect-
  routing voor de 5 marketingpagina's; de kale root/paginanamen
  redirecten naar de `/en/`-versie.
- `vacatures.html` linkt per vacature naar de taal die daadwerkelijk
  bestaat (EN-fallback per vacature). Alle relatieve asset-paden
  (styles.css, animations.js, logo's) op de marketingpagina's omgezet
  naar absolute paden — braken anders zodra dezelfde pagina via een
  taalprefix wordt geserveerd. `solliciteer.js` gebruikt nu
  `window.OG_FORM_TEKSTEN` i.p.v. hardcoded Nederlandse teksten.

Lokaal getest: EN + NL op alle 5 marketingpagina's, en een
vacature-detailpagina met EN-only/EN+NL/EN+NL+FR, inclusief de complete
sollicitatieflow in het Nederlands op een taalpagina.

**Bekende beperking**: oude `/vacature/<slug>.html`-links (zonder
taalprefix) werken niet meer — Azure Static Web Apps' routing
ondersteunt geen wildcard-redirects die de slug behouden.

## Afgerond: menu in lijn met corporate huisstijl, taal-selector, hero op contact/vacatures

Op basis van een screenshot van de corporate website (ogcleanfuels.com)
is de header herzien:

- Menu-items staan nu echt gecentreerd (header is een 3-koloms grid:
  logo / nav / taal-selector, i.p.v. logo-links-nav-rechts). Logo is
  groter (54px → 64px) en staat met wat meer ruimte t.o.v. de linkerhoek.
- Nieuwe taal-selector in de header (globe-icoon + taalcode + dropdown),
  zoals de "NL ⌄"-knop op de corporate site. Op de 5 marketingpagina's
  altijd alle 6 talen (client-side ingevuld door `i18n.js`); op
  vacature-detailpagina's alleen de daadwerkelijk vertaalde talen
  (build-time door `generate.js`) — vervangt de losse switcher die eerst
  onder de breadcrumb stond.
- Contact- en vacature-overzichtspagina hadden na de meertaligheid-ronde
  geen hero-sectie, in tegenstelling tot de andere 3 marketingpagina's.
  Beide hebben nu dezelfde hero-behandeling (transparante header over het
  oranje kleurverloop, wit logo, effen bij scrollen), met hergebruik van
  bestaande, al vertaalde koptekst (geen dubbele koppen, geen nieuwe
  vertaalronde nodig behalve 1 nieuwe intro-regel voor vacatures).

Kleurgebruik ongewijzigd. Lokaal getest tegen Azurite + een testvacature
(EN+NL): alle 5 marketingpagina's + de vacature-detailpagina bekeken met
Playwright in EN en NL, taal-dropdown-interactie getest, mobiele weergave
gecontroleerd (nav + taal-selector verdwijnen zoals voorheen, geen
regressie).

## Nog open

- Collega-quotes op werken-bij-og.html zijn illustratief, geen echte
  namen/foto's/citaten. Te vervangen zodra er echte collega-input is.
- Contactpagina gebruikt nog het voorbeeld-achtige telefoonnummer van
  de vacature-detailpagina's, en er staat geen bedrijfsadres/KvK-nummer
  op (niet betrouwbaar bekend).
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
- Voorstel (nog niet gebouwd, wacht op een Anthropic API-key): een losse
  functie om de inhoud automatisch te laten voorvertalen via een LLM
  (concept, altijd met verplichte controle vóór opslaan/live zetten) —
  de structuur-kopieerknop hiervoor staat er inmiddels (zie hieronder).

## Afgerond: knop kopieert blokopzet naar alle talen in het beheerformulier

Eerste van de 2 voorgestelde vertaal-workflow-verbeteringen gebouwd, in 2
iteraties. Eerst een knop per niet-EN taaltab ("Kopieer opzet van EN"),
op verzoek van Wouter daarna vereenvoudigd naar **1 knop** op de
Vertalingen-sectie (altijd zichtbaar, niet aan een tabblad gebonden) die
de blokstructuur van EN in 1 keer naar alle 5 andere talen kopieert:
bloktype, volgorde, aantal lijst-items (bullet-punten, FAQ-vragen,
teamleden) en afbeeldingen (vaak taal-onafhankelijk). Tekst-/
tekstblok-velden blijven bewust leeg, want de inhoud moet toch handmatig
vertaald worden. Confirm-stap voorkomt per ongeluk overschrijven, alleen
als minstens 1 doeltaal al blokken heeft.

Lokaal getest tegen Azurite met een testvacature (2-3 bloktypes,
inclusief een lijst-veld en een afbeelding): structuur en lege
tekstvelden kloppen in alle 5 doeltalen, EN blijft ongewijzigd, confirm
verschijnt pas bij een herhaalde overschrijf-poging.

## Afgerond: knop "Verwijder alle blokken" in het beheerformulier

Naast "+ Blok toevoegen" staat nu ook "Verwijder alle blokken": leegt in
1 keer alle body-blokken van de actieve taaltab, met een confirm-stap
("Weet je het zeker?") die het aantal blokken en de taal noemt. Werkt
alleen op de actieve taal, niet op alle talen tegelijk. Geen dialoog als
er toch al 0 blokken zijn. Lokaal getest: annuleren laat de blokken
ongemoeid, bevestigen leegt ze, een herhaalde klik bij 0 blokken doet
niets.

## Afgerond: hamburgermenu op mobiel + taal-selector met vlaggen

Sloot een bestaand gat: onder 640px verdwenen `header nav` en de
taal-selector zonder enige vervanging. Nu een hamburger-knop die uitklapt
naar een volle-breedte paneel met de nav-links (verticaal, links
uitgelijnd).

- Nieuwe `.header-rechts`-wrapper om taal-selector + hamburger-knop
  samen, zodat de bestaande 3-koloms desktop-grid (logo/nav/rechts)
  ongewijzigd blijft. Op mobiel wordt deze wrapper `display:contents`
  (zijn eigen doos verdwijnt, kinderen worden losse flex-items van
  `<header>` zelf) — een eerste implementatiepoging met geneste flex-
  containers gaf centrerings-/uitlijningsbugs, dit loste het op.
- **Taal-selector blijft, op verzoek van Wouter, altijd zichtbaar naast
  de hamburger-knop** — niet verstopt in het uitklapmenu, werkt met zijn
  normale dropdown-gedrag (identiek aan desktop).
- **Vlag per taal toegevoegd aan de taalkeuzelijst** (EN/NL/FR/DE/IT/SE),
  zoals op de corporate website — als emoji, geen aparte afbeeldingen
  nodig.
- Header wordt bij openen van het hamburgermenu altijd effen wit, ook op
  hero-pagina's, zodat nav/taal-selector/hamburger-icoon leesbaar blijven
  ongeacht scrollpositie.
- Zelfde structuur toegepast in `generate.js` voor de
  vacature-detailpagina's.

Lokaal getest met Playwright op mobiele viewport (390px) en desktop:
openen/sluiten van het menu, taal-dropdown binnen en buiten het
uitgeklapte menu, header-achtergrond stabiliseert naar volledig effen wit
(via computed style geverifieerd, niet alleen visueel), desktop
ongewijzigd.

## Afgerond: hero-secties — eyebrow weg, titel dichter bij body, intro ingekort

Op verzoek, gebaseerd op de opzet van de corporate website, in 2 rondes:

- Eyebrow/tag-labeltje boven de H1 verwijderd op alle 5 marketing-hero's.
- Hero-padding omgedraaid (110px/130px → 170px/36px, na een tweede
  verzoek de bodem-padding nog verder verkleind van 70px): de H1/
  subtitel/knoppen zitten nu duidelijk dichter bij de content eronder
  dan bij het menu erboven.
- Introtekst onder de H1: eerst "max 2 zinnen" toegepast, bleek bij
  "Working at OG" (49 woorden) nog te letterlijk/lang. Op verzoek
  vervolgens expliciet op woordaantal ingekort (~15-20 woorden) in alle
  6 talen: home 23→19, werkenBijOg 49→18, contact 27→15 woorden.
  overOns (18) en vacaturesPagina.heroIntro (11) waren al kort genoeg.

Lokaal getest op alle 5 marketingpagina's, desktop en mobiel, na beide
rondes.

## Afgerond: footer uitgebouwd, oranje huisstijlkleur

Was een minimale, donkere balk met alleen logo-tekst + copyright. Nu:

- Achtergrond oranje (`--og-orange-dark`, de donkerste tint uit het
  palet voor voldoende contrast met witte tekst) i.p.v. effen
  donkergrijs.
- 3 kolommen, logische indeling: merk (logo + "Bold. Eager. Human.",
  hergebruikt de al bestaande, taal-onafhankelijke brand-pillar-labels),
  menu (dezelfde 4 navigatielinks als de header), contact (e-mail,
  telefoon, link naar de corporate site).
- Aparte, dunnere onderbalk met alleen de copyright-regel.
- Stapelt op mobiel (1 kolom) net als de rest van de site.

1 nieuwe i18n-key (`footer.menuKop`, "Menu"/"Menü"/"Meny") aangevuld in
alle 6 talen. Vacature-detailpagina's (`generate.js`) hergebruiken de al
bestaande `RECRUITER`-gegevens i.p.v. hardcoded contactinfo.

Lokaal getest: alle 5 marketingpagina's + een vacature-detailpagina, in
EN/NL/DE (umlaut-rendering gecontroleerd), desktop en mobiel, en dat
interne footer-links de taalprefix correct meekrijgen (`i18n.js`).

## Bezig: sollicitatie-fasetracking — datamodel + backend afgerond (stap 1+2)

Eerste stap van een uitbreiding van de sollicitatiepagina in `/beheer`:
een duidelijke fase-indeling per kandidaat (kanban-bord + tijdlijn), zodat
de flow van sollicitatie tot aanname/afwijzing zichtbaar wordt. Bewust
gesplitst: eerst datamodel + backend, het kanban-bord en de rest van de
frontend volgen pas na akkoord.

- **Nieuwe fases** (`ALLOWED_STATUSSEN` in `api/shared/sollicitatiesTable.js`):
  nieuw → screening → eerste_gesprek → tweede_gesprek → aanbod →
  aangenomen, plus 2 exit-statussen bereikbaar vanuit elke fase:
  afgewezen, ingetrokken. Vervangt het oude 6-statussenmodel (nieuw/
  in_behandeling/afgewezen/aangenomen/bewaard/gearchiveerd).
- **`statusHistory`** (audit trail): elke wijziging is 1 entry met
  from/to/timestamp/user, opgeslagen als `statusHistoryJson` (zelfde
  JSON-string-conventie als vacatures' `translationsJson`). De eerste
  entry ontstaat al bij het indienen (`from: null, to: "nieuw", user:
  "kandidaat"`). `SollicitatieUpdate` voegt alleen een entry toe bij een
  daadwerkelijke wijziging, niet bij het opnieuw opslaan van dezelfde
  status.
- Nieuwe gedeelde helper `api/shared/huidigeGebruiker.js`: leest de
  ingelogde gebruiker uit de `x-ms-client-principal`-header voor het
  "user"-veld.
- Bestaande statusdropdown in `beheer/sollicitaties.html` bijgewerkt naar
  de nieuwe 8 statussen (tussenoplossing tot het kanban-bord er is). Geen
  migratiescript: oude sollicitaties zonder `statusHistoryJson` vallen
  terug op een lege lijst.

**Open aandachtspunt**: als er al echte sollicitaties in de oude
statussen (`in_behandeling`, `bewaard`, `gearchiveerd`) staan, komen die
niet 1-op-1 overeen met de nieuwe fases — nog te bevestigen door Wouter
of dit relevant is.

Lokaal getest tegen Azurite: initiële history-entry bij aanmaken, meerdere
statuswijzigingen na elkaar (elke wijziging 1 nieuwe entry), dezelfde
status nogmaals opslaan (geen duplicaat), en een oude/ongeldige
statuswaarde (400).

**Nog te doen** (wacht op akkoord van Wouter): kanban-bord als
hoofdweergave (1 kolom per fase, drag-en-drop, aging-indicator per
kaartje), lijst/tabelweergave als alternatief, filters (vacature, fase,
"langer dan X dagen", zoekbalk), en het volledige kandidaatdossier
(notities, documenten, tijdlijn). Automatische notificaties bij
aging-drempels expliciet uitgesteld tot ná die stap.

## Afgerond: kanban-bord, kandidaatdossier en notities voor sollicitatiebeheer

Vervolg op de fase-tracking datamodel/backend (zie hierboven), na akkoord
("Ga nu voor die kanban e.d.!"). Volledige frontend voor het bord + het
kandidaatdossier gebouwd in `beheer/sollicitaties.html` (herschreven) en
het nieuwe `beheer/sollicitatie-dossier.html`.

- **Kanban-bord** als hoofdweergave: 6 kolommen (`BORD_FASES`: nieuw t/m
  aangenomen), native HTML5 drag-and-drop tussen kolommen (geen library).
  Elke kaart toont naam, vacaturetitel, een aging-indicator (groene stip
  < 3 dagen, oranje 3-7 dagen, rood > 7 dagen, berekend uit de laatste
  `statusHistory`-entry) en een archiveer-select om direct naar
  afgewezen/ingetrokken te verplaatsen.
- **Lijst-weergave**: sorteerbare tabel, zelfde click-op-kolomkop-patroon
  als `beheer/index.html`.
- **Archief-weergave**: losse eenvoudige tabel voor de 2 exit-statussen
  (afgewezen/ingetrokken), geen fase- of sleepbediening, alleen
  verwijderen.
- **Filters**: vacature, fase, "langer dan X dagen in huidige fase" en
  zoeken op naam. Vacature-opties worden client-side afgeleid uit de
  geladen sollicitaties (geen extra API-call). Bestaande `?vacatureId=`
  deep-link (vanuit het vacature-overzicht) blijft werken.
- **Kandidaatdossier** (nieuwe pagina, per kandidaat via `?id=`):
  statuswijziging (alle 8 statussen) en archiveren, notitieveld met eigen
  opslaanknop (los van status), volledige tijdlijn (van→naar, tijdstip,
  wie), contactgegevens, motivatie, documentdownloads (CV/motivatiebrief
  via de bestaande `SollicitatieBijlage`-Function) en een
  verwijderknop.
- **Backend**: `SollicitatieUpdate` accepteert nu `status` en/of
  `notities` onafhankelijk van elkaar (minstens 1 verplicht); een
  tijdlijn-entry komt er alleen bij als de status daadwerkelijk wijzigt.

Lokaal end-to-end getest tegen Azurite met testdata (5 sollicitaties, 2
vacatures, verschillende fases): bord/lijst/archief renderen correct,
sleep-en-neerzet tussen kolommen werkt en werkt door naar de backend,
alle filters getest, dossierpagina getest (laden, statuswijziging +
tijdlijn-update, notities opslaan, CV-downloadlink). Testdata na afloop
opgeruimd. Gemerged via [PR #41](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/41).

**Nog open** (zelfde punt als hierboven): of bestaande sollicitaties in
de oude statussen (`in_behandeling`, `bewaard`, `gearchiveerd`) nog
aandacht nodig hebben. Automatische notificaties bij aging-drempels nog
steeds niet gebouwd, blijft een losse vervolgstap.

## Afgerond: kanban-bord breder op grote schermen

Het bord voelde onnodig smal aan op een groot scherm. Nieuwe modifier
`.beheer-main-breed` (max-width 1760px i.p.v. de standaard 1320px van
`.beheer-main`), alleen toegepast op `beheer/sollicitaties.html` — andere
beheerpagina's blijven op de bestaande breedte. Kanban-kolombreedte van
260 naar 300px voor iets meer ademruimte per kaart.

Lokaal geverifieerd op 1920px breedte: 5 kolommen zichtbaar i.p.v. ~4
voorheen. Gemerged via [PR #42](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/42).

## Afgerond: kanban-bord zonder scroll, aparte afwijzen/archiveren-knoppen en lijsten

Vervolgverzoek: het bord mocht geen horizontaal scrollen meer nodig
hebben, en de archiveer-dropdown per kaart moest vervangen worden door 2
losse knoppen met elk een eigen lijst.

- **Bord**: `.kanban-bord` is nu een CSS grid met 6 gelijke kolommen
  (`repeat(6, minmax(0,1fr))`) i.p.v. vaste kolombreedte + horizontaal
  scrollen, dus het bord past altijd binnen de beschikbare breedte. Onder
  1100px valt het terug op de oude scrollende opzet (vaste kolombreedte),
  zodat het op kleinere schermen leesbaar blijft.
- **Acties**: de "Verplaats naar archief..."-dropdown op elke kaart/rij
  vervangen door 2 kleine knoppen naast elkaar: "Afgewezen" en
  "Archiveren" (koppelen respectievelijk aan de bestaande statussen
  `afgewezen` en `ingetrokken`).
- **Losse lijsten**: i.p.v. 1 gecombineerde archiefweergave nu 2 tabs:
  "Afgewezen" (status `afgewezen`) en "Archief" (status `ingetrokken`).
- **Bugfix** (gevonden tijdens het testen): het kanban-bord bleef
  zichtbaar doorschemeren achter de andere tabs, omdat de expliciete
  `display`-waarde op `.kanban-bord` het `hidden`-attribuut overschreef
  (normale author-CSS wint altijd van de UA-stijl voor `[hidden]`,
  ongeacht specificiteit). Opgelost met een `#kanban-bord[hidden]{display:
  none}`-regel. Dit was er waarschijnlijk al vóór deze wijziging.

Lokaal getest tegen Azurite: op 1920px geen scroll meer nodig, knoppen
wijzigen de status correct en de kandidaat verdwijnt uit bord/lijst, de
Afgewezen- en Archief-tab tonen elk de juiste, gescheiden set kandidaten.
Testdata na afloop opgeruimd. Gemerged via [PR #43](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/43).

## Afgerond: menu écht gecentreerd, Contact + corporate site naar rechts

De hoofdnav toonde 5 items (Vacatures/Werken bij OG/Over ons/Contact/
corporate site); Contact en de corporate-sitelink moesten eruit, zodat de
resterende 3 menu-items écht gecentreerd staan. Nieuwe indeling rechts:
taalkeuze → Contact → corporate site (helemaal rechts uitgelijnd).

- Nieuwe `.header-rechts-link` klasse (zelfde typografie, hover-
  onderstreping en actieve-paginakleur als de gewone nav-links, alleen
  zonder hun `margin-left` — `header-rechts` regelt de tussenruimte al
  via `gap`).
- Op mobiel blijven Contact en corporate site gewoon onderdeel van het
  uitklapbare hamburgermenu, in dezelfde volgorde als voorheen: een
  CSS-only truc (dezelfde flex-`order` als `<nav>`) laat ze in de mobiele
  flex-wrap-lijst erachteraan verschijnen, zonder de HTML te dupliceren.
- Toegepast op alle 5 marketingpagina's én het `generate.js`-sjabloon
  voor vacature-detailpagina's.

Lokaal geverifieerd: nav-midden = header-midden (0px verschil) op 1920px,
rechts-volgorde klopt, mobiel uitklapmenu toont nog steeds alle 5 items
in de oorspronkelijke volgorde, actieve-paginamarkering op contact.html
werkt nog. `generate.js` lokaal gedraaid tegen de dev-server om de
gegenereerde vacature-detailpagina te controleren; testdata en
gegenereerde bestanden na afloop opgeruimd. Gemerged via [PR #44](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/44).

## Afgerond: taal-selector visueel dichter bij de corporate site

Wouter deelde een screenshot van de taal-dropdown op de corporate site:
de uitwerking op werkenbij week daar nog te sterk vanaf.

- Emoji-vlaggen vervangen door zelf-gehoste SVG-vlagiconen (data-URI's
  in `styles.css`, geen externe dependency): emoji-vlaggen renderen niet
  overal consistent als vlag (Windows toont ze soms als platte
  2-letter-code), een SVG-achtergrond oogt overal identiek.
- Dropdown-lijst luchtiger en groter gemaakt: bredere kaart, grotere
  ronde hoeken, grotere flags, meer padding, grotere/vettere tekst —
  dichter bij de referentiescreenshot.
- Label voor Engels aangepast van "EN" naar "GB" (landcode i.p.v.
  taalcode, zoals op de corporate site). De onderliggende taalcode/
  URL-prefix (`en`) blijft ongewijzigd, alleen de zichtbare tekst.
- Toegepast op alle 5 marketingpagina's, `i18n.js` (weergavecode op de
  knop) en het `generate.js`-sjabloon voor vacature-detailpagina's.

Lokaal getest: dropdown op alle 6 talen gecontroleerd (scherpe vlaggen),
hero-pagina in gesloten staat (knop toont "GB" in wit), mobiel
uitklapmenu, en `generate.js` gedraaid met een test-vacature in 3 talen
om de gegenereerde variant te bevestigen. Testdata en gegenereerde
bestanden na afloop opgeruimd. Gemerged via [PR #45](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/45).

## Afgerond: video-embed op werken-bij-og.html onderzocht

Wouter meldde dat de video-embed nog niet werkt. Iframe-markup, CSS
(`.blok-video`) en de scroll-reveal-animatie lokaal gecontroleerd: alles
klopt (element wordt zichtbaar, juiste afmetingen, geen CSP die iframes
blokkeert). Wel een ontbrekend `allow`-attribuut gevonden en toegevoegd
op alle 3 plekken met een YouTube-iframe (het vaste video-blok hier, het
`video_embed`-blok en de video-header op vacature-detailpagina's, beide
in `generate.js`) — dit is standaard in YouTube's eigen embed-code en
ontbrak overal.

**Kon niet volledig getest worden**: deze sandbox heeft geen
netwerktoegang tot youtube.com (bevestigd via zowel curl als de
web-fetch tool, beide expliciet geblokkeerd door het egress-beleid). Het
is dus niet uit te sluiten dat de eigenlijke oorzaak bij de video zelf
ligt (verkeerde video-ID, embedding uitgeschakeld door de eigenaar, of
de video is privé/verwijderd) — dat kan alleen Wouter zelf checken op
youtube.com. Aan Wouter gevraagd wat hij precies ziet en of "insluiten
toestaan" aanstaat voor deze video. Gemerged via [PR #46](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/46)
(de allow-attribuut-fix); de eigenlijke video-beschikbaarheid blijft een
open vraag.

## Afgerond: video-embed error 153 opgelost (referrerpolicy)

Vervolg op het video-embed-onderzoek hierboven. Wouter bevestigde: video
is publiek, "insluiten toestaan" staat aan, en de fout ("Video player
configuration error, Error 153") trad consistent op in meerdere
browsers én in incognito/Safari — dus geen ad-blocker- of
extensie-oorzaak.

Uitgezocht via webonderzoek (geen directe toegang tot youtube.com vanuit
deze sandbox): YouTube is sinds eind 2025 strenger geworden over de
Referer-informatie die een embed moet meesturen; embeds zonder
expliciete `referrerpolicy` lopen hier tegenaan, precies met deze
foutmelding. `referrerpolicy="strict-origin-when-cross-origin"`
toegevoegd op alle 3 YouTube-iframes (het vaste video-blok op
werken-bij-og.html, het `video_embed`-blok en de video-header op
vacature-detailpagina's, beide in `generate.js`).

**Niet zelf te verifiëren** dat de video nu daadwerkelijk laadt (geen
netwerktoegang tot youtube.com in deze sandbox) — nog te bevestigen door
Wouter op de live site. Gemerged via [PR #47](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/47).

## Afgerond: achtergrondvideo in de hero van de 4 marketingpagina's

Wouter wilde de site "meer tot leven" laten komen voor een demo aan HR.
Eerst kort verkend om marketingpagina's zelf bewerkbaar te maken in
/beheer (een flinke architectuurwijziging), maar dat bewust geparkeerd
om nu snel iets zichtbaars te bouwen.

- Video vervangt de bewegende gradient-achtergrond in de hero van
  home, werken-bij-og, over-ons en contact (`vacatures.html`
  ongewijzigd).
- Zelf gehost als vast site-asset onder `/videos/` (net als de logo's),
  bewust niet via YouTube: geen branding/controls-overlay, geen
  autoplay-beperkingen zoals bij een iframe, en geen cross-origin gedoe
  zoals bij de net opgeloste YouTube-embed.
- Aangeleverde video (29MB, 1080p, 20 Mbit/s, met een overbodig
  geluidsspoor) gecomprimeerd naar een webm (VP9, ~2.1MB) + mp4
  (H.264, ~2.6MB) zonder geluid, plus een los posterbeeld (134KB).
  Beide formaten aangeboden (webm eerst, mp4 als fallback): H.264/mp4
  werkt overal inclusief Safari/iOS, VP9/webm is kleiner voor
  Chrome/Firefox/Edge.
- `muted autoplay loop playsinline`, puur decoratief. Bij
  `prefers-reduced-motion` valt de video weg, blijft een effen oranje
  achtergrond staan.
- Nieuwe oranje kleurwaas (`.hero-met-video::before`) overheen houdt de
  tekst leesbaar en de look consistent met hero's zonder video.

Lokaal getest op alle 4 pagina's en op mobiel (390px): video speelt af,
tekst blijft leesbaar. Terzijde ook het lokale testscript zelf verbeterd
(ontbrekende video-MIME-type en HTTP Range-support toegevoegd, nodig om
`<video>` lokaal te kunnen testen — Azure Static Web Apps ondersteunt dit
al standaard). Gemerged via [PR #48](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/48).

## Afgerond: achtergrondfoto in de hero van de vacatures-overzichtspagina

Wouter leverde een foto aan (kon niet als inline-plaktekst verwerkt
worden — deze sandbox krijgt zulke afbeeldingen niet als bestand op
schijf; wél gelukt via een upload direct naar de repo op github.com).

- Nieuwe `.hero-met-afbeelding` klasse voor `vacatures.html`: zelfde
  oranje kleurwaas-behandeling als de video-hero's (`.hero-met-video`)
  voor leesbare tekst, maar met een `background-image` i.p.v. een
  `<video>`-element.
- Foto komt binnen via een CSS custom property
  (`--hero-achtergrond-foto`) op het `.hero`-element zelf, zodat de
  klasse herbruikbaar blijft voor een andere pagina/foto later.
- Gebruikt `images/dsc00361.webp`, al gecomprimeerd aangeleverd, geen
  verdere bewerking nodig.

Lokaal getest: foto rendert met kleurwaas, tekst blijft leesbaar,
consistent met de video-hero's op de andere pagina's. Gemerged via
[PR #49](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/49).

## Afgerond: afdeling en locatie als vaste dropdown i.p.v. vrije tekst

Wouter wilde bij het aanmaken van een vacature Locatie en Afdeling als
dropdown i.p.v. vrij tekstveld, om te voorkomen dat bv. "Business
Development" op 5 manieren getypt wordt, en om er straks betrouwbaar op
te kunnen filteren.

- Vaste lijst `ALLOWED_AFDELINGEN` (17 afdelingen) en `ALLOWED_LOCATIES`
  in `api/shared/vacaturesTable.js`, aangeleverd door Wouter.
- Locatie is bewust niet alleen een kantorenlijst: sommige functies
  (bv. servicemonteur) zijn regiogebonden i.p.v. aan 1 kantoor vast.
  Daarom staan de 5 echte kantoren (Heerenveen, Rousset, Emstek, Parma,
  Göteborg) en 1 generieke "Nederland (reizend)"-optie naast elkaar in
  dezelfde lijst, i.p.v. een los "regio"-veld erbij te verzinnen. Nog
  te bevestigen door Wouter of "Nederland (reizend)" specifiek genoeg is
  of dat er meer regio's (bv. Noord/Zuid) bij moeten.
- Beheerformulier (`beheer/vacature.html`) gebruikt nu 2
  `<select>`-dropdowns i.p.v. tekstvelden.
- `VacatureCreate` en `VacatureUpdate` valideren tegen dezelfde lijsten
  (zelfde patroon als de bestaande `ALLOWED_STATUSSEN`-validatie).
- Eenmalige migratie voor bestaande vacatures: nieuwe
  `MigreerAfdelingLocatie`-Function (zelfde secret-beveiligde patroon
  als `VacaturesTick`) mapt bestaande vrije-tekstwaarden automatisch
  naar de nieuwe lijst waar dat zeker genoeg kan (ongeacht
  hoofdletters/spaties/accenten, of een duidelijke substring-match), en
  rapporteert per veld welke waarden niet zeker genoeg gemapt konden
  worden zodat die handmatig gecontroleerd kunnen worden. Aan te roepen
  via de nieuwe workflow `migreer-afdeling-locatie.yml`
  (workflow_dispatch, eenmalig).

  **Nog niet uitgevoerd tegen productie** — deze migratie-workflow moet
  nog 1x handmatig gestart worden (via workflow_dispatch) om de
  bestaande vacatures daadwerkelijk om te zetten naar de nieuwe vaste
  lijst.

Lokaal getest tegen Azurite met bewust rommelige testdata (kleine
letters, extra spaties, ontbrekend accent, "and" i.p.v. "&", een
onherkenbare waarde): correct gemapt waar mogelijk, onduidelijke
gevallen blijven ongewijzigd staan, en een herhaalde aanroep wijzigt
niets meer (idempotent). Beheerformulier getest: dropdown toont de
gemigreerde waarde correct, en staat leeg (i.p.v. een foutieve waarde)
bij een niet-gematchte vacature. Gemerged via
[PR #50](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/50).

## Afgerond: werkgebied als los, optioneel veld naast locatie

Wouter vond 1 generieke "Nederland (reizend)"-locatie voor regiogebonden
functies (bv. servicemonteur) niet specifiek genoeg, maar wilde ook geen
uitbreiding van de kantorenlijst zelf.

- Nieuw, optioneel veld **Werkgebied** (Noord/Oost/Zuid/West/Midden)
  naast Locatie i.p.v. erin verwerkt: een vacature kan zo zowel aan een
  kantoor (bv. Heerenveen) als aan een werkgebied (bv. Zuid) hangen.
- `ALLOWED_WERKGEBIEDEN` in `api/shared/vacaturesTable.js`, zelfde
  patroon als de bestaande vaste lijsten.
- Beheerformulier: dropdown "Werkgebied (optioneel)" met lege
  "Geen"-optie.
- Vacature-detailpagina's tonen het werkgebied als extra pil ("Regio
  {werkgebied}"), vertaald in alle 6 talen.

Lokaal getest: veld gaat correct rond (formulier → API → Table Storage
→ terug naar formulier), blijft leeg wanneer niet ingevuld. Gemerged via
[PR #51](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/51).

## Bugfix: onderhoudsworkflows deden stilletjes niets

Bij het klaarzetten van de afdeling/locatie-migratie (PR #50) bleek de
migratie-workflow te "slagen" zonder een zichtbaar resultaat. Onderzoek
van de job-logs wees uit dat de curl-aanroep naar de onderhouds-API's
(`vacaturesTick` én de nieuwe migratie) geen `https://` in de URL had.

- Zonder schema stuurt curl een kale HTTP-request. Azure Static Web
  Apps redirect dat vermoedelijk naar HTTPS (3xx), en `--fail` faalt
  alleen op 4xx/5xx: de workflow-stap meldde dus altijd "success"
  zonder de echte endpoint ooit te bereiken.
- Dit zat al in de **bestaande uurlijkse VacaturesTick-workflow**, dus
  vermoedelijk heeft automatisch publiceren/sluiten van vacatures op
  basis van publicatie-/sluitingsdatum nooit gewerkt via deze workflow.
- Fix: `https://` toegevoegd + `-L` om een eventuele redirect alsnog te
  volgen i.p.v. als succes te tellen.
- Na deze fix bleek er een 2e, apart probleem: de GitHub-secret
  `VACATURES_TICK_SECRET` bestaat niet als repository secret, dus komt
  er telkens een lege waarde binnen (401 Unauthorized). Moet nog door
  Wouter aangemaakt worden onder Settings → Secrets and variables →
  Actions (repository secret, dezelfde waarde als in de Azure Static
  Web App-configuratie). Zodra dat staat: migratie-workflow opnieuw
  draaien.

Gemerged via [PR #52](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/52).

## Afgerond: werkgebied-combinaties, locatie met land, en de laatste migratie-fixes

Wouter gaf aan dat werkgebied vaak gecombineerd voorkomt (bv. "Zuid/West"),
en wilde bij locatie ook het land erbij zodat direct duidelijk is om
welk kantoor het gaat.

- Werkgebied: beheerformulier gebruikt nu checkboxes i.p.v. 1 dropdown,
  opgeslagen als "/"-gescheiden canonieke string (altijd in vaste
  volgorde, dus "Zuid/West" i.p.v. soms "West/Zuid"). `isGeldigWerkgebied()`
  in `api/shared/vacaturesTable.js` valideert elke combinatie.
- Locatie toont nu stad + land (bv. "Rousset, France") i.p.v. alleen de
  stad. Nam meteen een bestaande bug mee in de JobPosting-structured-data:
  `addressCountry` stond altijd hardcoded op "NL", ook voor de kantoren
  in Frankrijk, Duitsland, Italië en Zweden.
- `MigreerAfdelingLocatie` kreeg alias-mappings voor bekende onduidelijke
  legacy-waarden ("Techniek" → Operations, "Utrecht" → Nederland
  (reizend)), en een expliciete, op ID gebaseerde `HANDMATIGE_CORRECTIES`
  voor de allerlaatste vacature die nergens automatisch op te lossen was
  (locatie "Manchester", geen kantoor en geen NL-regio): op verzoek van
  Wouter naar Nederland (reizend) + werkgebied Noord gezet.
- Migratie-workflow 2x opnieuw gedraaid na deze wijzigingen: alle
  bestaande vacatures hebben nu een geldige afdeling, locatie én
  werkgebied, niets staat meer op "onduidelijk".

Gemerged via [PR #53](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/53) en
[PR #54](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/54).

## Afgerond: land- en afdelingfilters op de vacature-overzichtspagina

Aanleiding: Wouter merkte op dat de SE-taalversie van de site gewoon
alle vacatures toont, ook vacatures die niets met Zweden te maken
hebben.

- Klikbare, multi-select filterchips voor Land (5 landen) en Afdeling
  (17 vaste afdelingen) boven de vacaturelijst op `vacatures.html`.
- Filterkeuze staat in de URL (`?land=...&afdeling=...`), dus een
  gefilterde link is deelbaar.
- Land wordt afgeleid uit de bestaande Locatie-waarde (alles na de
  komma; "Nederland (reizend)" telt als Netherlands) — geen nieuw
  databronveld nodig, en de portal-dropdown blijft ongewijzigd (toont
  bewust de precieze stad, dat is voor intern gebruik net zo belangrijk).
- Land-chip staat vooraf aangevinkt op basis van de taal van de pagina:
  fr → France, de → Germany, it → Italy, se → Sweden. nl en en blijven
  ongefilterd. De chip is altijd uit te vinken, dus niets wordt
  structureel verborgen — dit voorkomt ook een misleidend lege lijst
  als een land toevallig geen vacatures heeft.

Lokaal getest met Playwright tegen een minimale mock-server (puur
front-end, geen Azurite nodig voor dit stuk): voorselectie per taal,
combinatie van filtergroepen als AND, URL-synchronisatie, en het "geen
resultaten"-bericht in de juiste taal. Gemerged via
[PR #55](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/55).

## Afgerond: contactpagina met FAQ-accordion, en notitieveld als rich text

Wouter wilde de contactpagina meer vullen en het notitieveld in het
kandidaatdossier gebruiksvriendelijker maken.

**Contactpagina** (na een gedetailleerde spec van Wouter, die een
eerdere, uitgebreidere versie met sollicitatieproces- en
kantoren-secties verving):
- FAQ als vanilla-JS accordion (button + verborgen div, geen library,
  bewust geen native `<details>/<summary>`), direct onder de
  contactkaart van Iska, vóór het "zakelijk contact"-blok — vult de
  eerder lege ruimte tussen die 2 blokken.
- 5 vragen: reactietermijn, niet aan alle functie-eisen voldoen,
  sollicitatieproces, open solliciteren, gegevens na sollicitatie. 3
  antwoorden zijn bewust duidelijk gemarkeerde placeholders (cursief,
  cream achtergrond, tussen `[haken]`) voor onderwerpen die Wouter nog
  moet invullen (reactietermijn, het concrete proces, bewaartermijn +
  link naar de privacyverklaring).
- Telefoonnummer bijgewerkt naar +31 6 12 18 55 70.
- "Zakelijk contact"-tekst vereenvoudigd naar "Ga naar ogcleanfuels.com."
  met bijpassende korte knoptekst.
- Alle teksten vertaald naar alle 6 talen.

**Notitieveld kandidaatdossier**:
- Textarea vervangen door een contenteditable rich-text-veld met een
  kleine werkbalk (vet/cursief/onderstreept/opsomming/genummerde
  lijst) via `execCommand`.
- Groter: 220-480px (was ~130px), groeit mee met de inhoud.
- Notities worden nu als HTML opgeslagen. Server-side sanitization met
  de nieuwe `sanitize-html`-dependency (strikte allowlist, geen
  attributen) — dit is opgeslagen HTML die later met `innerHTML` wordt
  getoond, dus zonder whitelist zou dit een opslagplek voor XSS worden.

Lokaal getest met Playwright: FAQ-accordion opent/sluit onafhankelijk
per item, placeholder-styling is duidelijk onderscheidend, en een
geteste XSS-payload wordt door de sanitizer volledig weggefilterd
terwijl normale opmaak intact blijft. Gemerged via
[PR #56](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/56) en
[PR #57](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/57).

## Afgerond: volledige code-review + kleine UI-verfijningen

Op verzoek van Wouter alles wat deze sessie gebouwd is nagelopen op
correctheid, cleanheid en veiligheid.

**Gevonden en opgelost:**
- **Opgeslagen XSS in het kandidaatdossier**: het kandidaat-e-mailadres
  werd via `innerHTML` getoond zonder escaping, en `EMAIL_REGEX` in
  `SollicitatieCreate` liet `<>"'` toe — een kandidaat kon zo HTML/JS
  laten uitvoeren in het dossier van HR. Fix: e-mail (en, met lager
  risico maar zelfde patroon, de tijdlijn-gebruiker en de
  ingelogde-gebruiker-weergave) nu via DOM-methodes (`textContent`/
  `createElement`) i.p.v. `innerHTML`, en de regex uitgebreid om die
  tekens sowieso te weigeren. Geverifieerd met een Playwright-test die
  een `<img onerror>`- en `<script>`-payload probeerde: geen JS wordt
  meer uitgevoerd.
- **Werkgebied-validatie liet ongeldige waarden stilletjes door**:
  `canoniseerWerkgebied()` filterde onbekende waarden weg vóórdat de
  validatie ze kon afwijzen. Nu blijven onbekende waarden staan zodat
  ze alsnog een 400 opleveren, en ook een rechtstreeks aangeleverde
  string (i.p.v. array vanuit checkboxes) wordt canoniek geordend.
- **Verouderd telefoonnummer** stond nog op de footer van
  index/werken-bij-og/over-ons/vacatures.html en in
  `scripts/generate-vacatures/generate.js` (raakt elke gegenereerde
  vacaturepagina, alle 6 talen) — nu overal `+31612185570`.

Verder gecheckt en in orde bevonden: sanitize-html op notities (enige
schrijfpad), i18n-keys voor FAQ/filters (compleet, geen dode keys),
`LOCATIE_LANDCODE`-duplicatie tussen `vacaturesTable.js` en
`generate.js` (geen drift), `package.json`/lockfile, geen
debug-restjes.

**Kleine UI-verfijningen op de vacature-overzichtspagina**, ook op
verzoek van Wouter:
- "Lees meer & solliciteer" → "Lees meer" (alle 6 talen), met een
  nieuwe subtiele lichtgrijze knop-variant (`.btn-subtiel`) i.p.v. de
  zware zwarte standaardknop — alleen voor deze kaart-knop, de gedeelde
  `.btn`-class zelf is ongewijzigd.
- Filterkoppen ("Land", "Afdeling") zijn nu `<h3>` i.p.v. `<span>`.
- Afdeling-filter toont alleen afdelingen waar ook echt een vacature
  voor openstaat; land-filter toont bewust altijd alle 5 landen.

Gemerged via [PR #58](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/58) en
[PR #59](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/59).

## Afgerond: vacatures-overzicht laadt sneller

Wouter gaf aan dat het laden van de vacature-overzichtspagina lang
duurt. Onderzoek wees op 2 oorzaken:

- **Azure Functions cold start** (Consumption-plan): de dominante
  oorzaak, geen codeprobleem maar een eigenschap van dit hostingmodel.
  Oplossing hiervoor kost geld (Premium-plan) of is een gedeeltelijke
  gratis lapmiddel (keep-warm ping-workflow) — Wouter moet hier nog
  over beslissen.
- **Serieel ophalen i.p.v. parallel**: `vacatures.html` wachtte tot de
  i18n-vertalingen volledig opgehaald waren vóórdat de
  vacatures-aanroep (`/api/GetVacatures`) zelfs maar begon, terwijl die
  twee niets van elkaar afhangen. Gratis te fixen, dus meteen gedaan:
  de vacatures-fetch start nu bij het laden van het script, parallel
  aan de i18n-fetch. Alleen het renderen zelf wacht nog op de
  i18n-vertalingen.

Lokaal geverifieerd met request-timing: `/api/GetVacatures` en de
i18n-bestanden starten nu op hetzelfde moment i.p.v. na elkaar.
Gemerged via [PR #60](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/60).

**Nog openstaand**: keuze cold-start-aanpak (niks doen / keep-warm
ping / Premium-plan) staat nog open bij Wouter.

## Afgerond: MigreerAfdelingLocatie opgeruimd

De eenmalige migratie-Function `api/MigreerAfdelingLocatie` en de
bijbehorende workflow `migreer-afdeling-locatie.yml` zijn verwijderd,
nu Wouter akkoord gaf. De migratie zelf was al succesvol gedraaid; er
stond verder nergens in de codebase nog een verwijzing naar deze
Function.

## Afgerond: huisstijl-update (spark-beeldmerk, knoppen, kaart, formulier)

Wouter leverde een bijgewerkte `og-design-system.css` aan plus 3
kleurvarianten van het echte Spark-beeldmerk. De kleurtokens en
componenten in dat bestand kwamen al 1-op-1 overeen met wat
`styles.css` implementeerde (alleen andere class-namen), dat is dus
bewust niet blind overgenomen — wel alles wat daadwerkelijk nieuw of
afwijkend was:

- **Spark-beeldmerk**: het generieke wereldbol-icoon in de
  taal-selector (alle 5 marketingpagina's + de `generate.js`-template
  voor vacature-detailpagina's) vervangen door de spark, als CSS-mask
  zodat de kleur de tekstkleur van de knop blijft volgen. Bestaande
  decoratieve cirkels (`.hero::after`, `.stat-uitgelicht::after`) ook
  omgezet naar de spark-vorm, plus een nieuw spark-watermerk op de 3
  kernwaarden-kaarten (Bold/Eager/Human).
- **Knoppen-systeem**: `.btn` is nu alleen nog de neutrale basis;
  kleur komt van een modifier (`.btn-primary` oranje hoofdactie op wit/
  crème, `.btn-secondary` wit/ondersteunend of op foto (verving
  `.btn-outline`), `.btn-dark` hoofdactie bovenop een foto/video zoals
  de hero's, `.btn-text` laagste nadruk). Toegepast op alle bestaande
  knoppen op basis van context. Afmetingen zijn achteraf gecorrigeerd
  op basis van een devtools-meting die Wouter zelf deed op een knop op
  ogcleanfuels.com: padding 13px 20px (niet 15px 30px), radius 5px
  (niet 12px, ondanks dat het aangeleverde bestand zelf 12px als
  "exact de corporate site" beweerde), en geen box-shadow/hover-lift —
  alleen een kleurovergang.
- **Vacaturekaart**: ronder (18px), een rustende schaduw, en de oranje
  accentstreep aan de linkerkant uit het og-job-card-patroon.
  Functietitel nu in het lopende-tekst-lettertype i.p.v. de uppercase
  Komu-stijl, voor een sneller te scannen lijst.
- **Sollicitatieformulier**: velden groter/ruimer, zachtere rand, en
  een crème-tint achtergrond (nieuwe token `--og-cream-2`, iets dieper
  dan de pagina-achtergrond zodat de velden zichtbaar blijven i.p.v.
  erin te verdwijnen).

Lokaal geverifieerd met Playwright-screenshots op elk onderdeel, en de
knop-afmetingen definitief bevestigd via de computed style in de
browser. Gemerged via [PR #62](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/62).
