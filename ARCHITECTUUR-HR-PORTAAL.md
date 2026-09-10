# Architectuur eigen HR-portaal, OG Clean Fuels werkenbij site

Dit document legt de volledig uitgewerkte richting vast, na een uitgebreide
brainstorm. Bedoeld om als instructie aan Claude Code te geven, of als
CLAUDE.md-aanvulling.

## Waarom deze overstap

We stappen over van SharePoint (als vacature-databron) naar een volledig
zelfgebouwd HR-portaal, om 2 concrete problemen op te lossen:
1. SharePoint staat geen extern delen van afbeeldingen toe, HR kon dus geen
   headerafbeeldingen zelfstandig instellen.
2. De Graph API / App Registration / admin consent flow is omslachtig en
   kwetsbaar voor fouten (meermaals ondervonden tijdens de SharePoint-fase).

## De 6 technische bouwstenen

1. **GitHub**: code-opslag en versiebeheer (ongewijzigd).
2. **Azure Static Web Apps**: hosting + inlogpoort (Microsoft-login voor
   `/beheer/*`, via ingebouwde Entra ID authenticatie, geen eigen App
   Registration nodig).
3. **Microsoft Entra ID**: identiteitscheck, hetzelfde account als
   Outlook/Teams.
4. **Azure Functions**: de logica-laag, CRUD voor vacatures en sollicitaties,
   plus een Timer-triggered Function voor automatisch publiceren/sluiten.
5. **Azure Table Storage**: vacatures en sollicitaties als data (vervangt de
   SharePoint Lijst volledig).
6. **Azure Blob Storage**: foto's, video-links en CV's (vervangt SharePoint
   documentbibliotheken).

Het bestaande `scripts/generate-vacatures` build-script blijft bestaan, maar
haalt data straks op bij de eigen `GetVacatures` Function in plaats van bij
SharePoint/Graph API. De JSON-LD/SEO-opzet blijft ongewijzigd.

## Content-status per vacature

```
Concept → Ingepland → Gepubliceerd → Gesloten → Gearchiveerd
```
- Concept: HR is bezig, niet zichtbaar.
- Ingepland: klaar, met toekomstige publicatiedatum.
- Gepubliceerd: live.
- Gesloten: sluitingsdatum verstreken, automatisch (zie Timer Function).
- Gearchiveerd: HR heeft hem bewust ingetrokken.

Statuswijzigingen (automatisch of handmatig) triggeren een nieuwe site-build
(via de bestaande GitHub Actions workflow, aangeroepen vanuit de Function).

## Preview

Aparte, niet-geïndexeerde URL per vacature (`/preview/{id}`, met een
niet-raadbare token), toont de vacature exact zoals hij straks live komt te
staan, ook in Concept-status.

## Vaste tag-velden per vacature

| Veld | Type |
|---|---|
| Titel | Tekst |
| Afdeling | Keuze |
| Locatie (Standplaats) | Tekst/Keuze |
| Uren/Dienstverband | Keuze (Fulltime, Parttime, Stage, etc.) |
| Salaris | Range (min/max) of "In overleg" |
| Opleidingsniveau | Keuze (MBO, HBO, WO, Geen vereiste) |
| Sluitingsdatum | Datum |
| Publicatiedatum | Datum (voor inplannen) |

## Header

Keuze tussen foto óf video:
```json
{ "type": "foto", "bron": "..." }
{ "type": "video", "bron": "https://youtube.com/embed/..." }
```

## Body-blokken (14 types, HR stelt vacature hiermee samen, incl. volgorde)

1. `intro_gecentreerd` — eyebrow + kop + korte tekst, gecentreerd
2. `intro_split` — tekst + uitgelichte quote/stat naast elkaar
3. `tekst` — gewone alinea
4. `tekst_kolommen` — 2 tekstblokken naast elkaar
5. `uitgelichte_quote` — grote uitspraak, gekleurde achtergrond
6. `afbeelding_tekst` — foto + tekst, richting instelbaar (links/rechts)
7. `bullet_lijst` — icoon + korte punten
8. `arbeidsvoorwaarden_grid` — iconen-grid i.p.v. lijst
9. `collega_quote` — uitspraak van een collega, met foto en naam
10. `video_embed` — video ergens middenin de pagina
11. `team_voorstelling` — rij met foto's/voornamen van het team
12. `sollicitatieproces` — stappenoverzicht van het traject
13. `veelgestelde_vragen` — uitklapbare FAQ
14. `sluitingsdatum_banner` — opvallende regel met resterende tijd

Bewust weggelaten (voor nu): gerelateerde vacatures, locatiekaart, groeipad,
deelknoppen.

## Sollicitatie-statussen

```
Nieuw → In behandeling → Afgewezen / Aangenomen → Bewaard → Gearchiveerd
```

## Rechten

1 niveau: iedereen met portaaltoegang (via Entra ID groep) mag alles,
vacatures en sollicitaties volledig beheren. Geen onderscheid tussen rollen
voor nu.

## Mediabibliotheek

HR mag eerder geüploade foto's hergebruiken bij een nieuwe vacature, in
plaats van steeds opnieuw te moeten uploaden. Het portaal toont bij het
kiezen van een header of afbeelding-blok een overzicht van reeds
geüploade bestanden in Blob Storage, naast de optie om iets nieuws te
uploaden.

## Toegang en rechten (authenticatie)

Toegang tot `/beheer/*` verloopt in 4 lagen, zodat alleen HR erbij kan, en
toevoegen/verwijderen van toegang later geen code-wijziging vraagt:

1. **Inlogpoort**: Azure Static Web Apps' ingebouwde login-flow, stuurt
   bezoekers van `/beheer` naar het Microsoft-inlogscherm.
2. **Tenant-restrictie**: een eigen App Registration in Entra ID (nieuw,
   specifiek voor dit portaal, los van `Werkenbij-Vacatures-API`), ingesteld
   op "alleen accounts binnen de OG Clean Fuels tenant". Voorkomt dat elk
   willekeurig Microsoft-account (privé of ander bedrijf) kan inloggen.
3. **Groep-restrictie**: een Entra ID-beveiligingsgroep "HR-Portaal-Toegang".
   Alleen HR (Iska, eventueel later uit te breiden) zit hierin. Niet iedereen
   bij OG Clean Fuels mag bij het portaal, alleen deze groep.
4. **Rollentoekenning + routebeveiliging**: een eigen "rollen-Function" checkt
   na inloggen of de gebruiker in die groep zit, en kent dan de rol
   `hrbeheer` toe. De Static Web App configuratie staat `/beheer/*` alleen toe
   voor gebruikers met die rol.

**Beheer van toegang, na oplevering**: iemand toevoegen of verwijderen
gebeurt volledig via de Entra-groep "HR-Portaal-Toegang" (normaal Microsoft
365-beheer, geen code- of Azure-wijziging nodig).

**Nog te bouwen voor dit onderdeel**:
- Nieuwe App Registration aanmaken (tenant-restricted).
- Beveiligingsgroep "HR-Portaal-Toegang" aanmaken, Iska toevoegen.
- De rollen-Function schrijven (nieuwe code, controleert groepslidmaatschap).
- Route-restrictie instellen in de Static Web App configuratie.

## Nog open, bewust niet vastgezet

- Vacature dupliceren als snelkoppeling: nice-to-have, geen vereiste voor
  een eerste versie.

## Wat ongewijzigd blijft

De publieke website (homepage, over-ons, huisstijl, animaties, JSON-LD/SEO)
verandert niet qua uitstraling, alleen de databron erachter verandert.
