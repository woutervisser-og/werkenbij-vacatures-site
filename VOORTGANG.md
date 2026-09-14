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
