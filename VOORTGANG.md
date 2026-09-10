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
- Timer-Function (`api/VacaturesTimer`) gebouwd: draait elk uur, zet
  "ingepland" automatisch om naar "gepubliceerd" zodra de publicatiedatum
  is bereikt, en "gepubliceerd" naar "gesloten" zodra de sluitingsdatum is
  verstreken. Lokaal end-to-end getest tegen Azurite (verleden/toekomst
  datums per status, en dat concept-vacatures ongemoeid blijven).

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

## Geblokkeerd: Azure Storage Account

Storage Account aanmaken kan nog niet: de resource provider
`Microsoft.Storage` is niet geregistreerd voor het Azure-abonnement, en
Wouter heeft geen rechten om die zelf te registreren. Moet via IT geregeld
worden. Zodra dat kan: Storage Account aanmaken en de
verbindingsstring als Application Setting `AZURE_STORAGE_CONNECTION_STRING`
instellen op de Static Web App, anders kunnen de CRUD-Functions niets
opslaan of ophalen (de code staat al klaar op main).

## Nog open

- `GetVacatures` (publieke site, gebruikt door `scripts/generate-vacatures`)
  gebruikt nog SharePoint, niet de nieuwe Table Storage. Omzetten is bewust
  een latere, aparte stap, pas zodra vacatures ook echt via de nieuwe CRUD
  in Table Storage staan.
- Azure Blob Storage (foto's, video-links, CV's) nog te bouwen.
- Statuswijzigingen triggeren nog geen nieuwe site-build via GitHub
  Actions; dat heeft pas zin zodra `GetVacatures` van Table Storage
  leest (zie punt hierboven), bewust nog niet gebouwd.
- Een daadwerkelijke `/beheer`-pagina/interface bestaat nog niet.
