# Features-backlog — HR-portaal

Feature-audit van het huidige portaal (vacatures aanmaken met body-blokken,
publiceren, solliciteren, sollicitaties beheren), vanuit het perspectief van
een ervaren HR operations manager (het dagelijkse recruitmentproces) en een
recruitment marketeer (kandidaatervaring, conversie, inzicht). Dit document
somt op wat er **nog ontbreekt**, niets hiervan is al gebouwd. Er wordt in
deze ronde niets geïmplementeerd, alleen geïnventariseerd en geprioriteerd.

## Uitgangspunten

- Gebaseerd op de daadwerkelijke huidige staat van de code (API's,
  beheerportaal, publieke site), niet op aannames.
- MoSCoW-prioriteit: **Must** (mist nu echt, blokkeert dagelijks gebruik),
  **Should** (belangrijk, op afzienbare termijn), **Could** (waardevol,
  geen haast), **Won't (nu)** (bewust uitgesteld, wel genoemd voor later).
- Inschatting: **S** (paar uur), **M** (dagdeel tot een dag), **L** (meerdere
  dagen, vaak met een architectuur- of infrastructuurkeuze).
- Bekende, al eerder benoemde openstaande punten (zie `VOORTGANG.md` en
  `ARCHITECTUUR-HR-PORTAAL.md`) zijn hier opnieuw meegenomen en scherper
  geprioriteerd, in plaats van dubbel bijgehouden.

## 1. Sollicitatiebeheer (kandidatenstroom)

Het huidige overzicht (`/beheer/sollicitaties.html`) is 1 platte tabel:
naam, vacature, contact, datum, status-dropdown, bijlage-links. Geen
filter, geen zoekfunctie, geen paginering, en de motivatietekst is nergens
te lezen zonder los in de data te duiken.

| Feature | Wat ontbreekt nu | Prioriteit | Inschatting |
|---|---|---|---|
| ~~Doorklikken vanuit vacature naar bijbehorende sollicitaties~~ ✅ | Afgerond: aantal sollicitaties als link, filtert door naar `/beheer/sollicitaties.html?vacatureId=...` | Must | S |
| Filteren/zoeken in sollicitatie-overzicht (op vacature, status, naam, periode) | Geen enkel filter of zoekveld aanwezig, alles staat in 1 lange tabel | Must | S |
| Bulk-export van sollicitaties (CSV/Excel) | Geen exportfunctie; data is alleen rij-voor-rij in de UI te bekijken | Must | S |
| Sollicitatie-detailweergave (motivatietekst, CV-voorbeeld, contactgegevens in 1 overzicht) | De motivatietekst wordt nergens getoond in de UI, alleen opgeslagen; CV/motivatiebrief zijn alleen als download-link te openen | Must | M |
| Interne notities per sollicitatie (bv. interviewaantekeningen, indruk collega) | Geen notitieveld in het datamodel of de UI | Should | S |
| Bulk-acties (meerdere sollicitaties tegelijk van status wijzigen of verwijderen) | Status wijzigen/verwijderen kan nu alleen 1-voor-1 | Should | M |
| Paginering in het sollicitatie-overzicht | Alle sollicitaties worden in 1 keer geladen en getoond; wordt onwerkbaar bij groei | Should | S |
| Dubbele-sollicitatie-detectie (zelfde e-mailadres, zelfde/andere vacature) | Geen controle; een kandidaat kan ongemerkt meerdere keren solliciteren | Should | M |
| Labels/tags voor sollicitaties (bv. "referral", "intern doorverwezen", "senior") | Alleen de vaste statusreeks bestaat, geen vrije categorisering | Could | M |
| Beoordeling/score per sollicitant (bv. 1-5 sterren) | Geen scoreveld | Could | S |
| Kanban/pipeline-weergave (slepen tussen statussen) i.p.v. alleen een tabel | Status wijzigen kan alleen via een dropdown per rij | Could | L |
| Zelf-configureerbare kolommen in het sollicitatie-overzicht (beheren + toevoegen) | Alleen de vaste, hardcoded kolommen bestaan nu; "toevoegen" betekent in de praktijk een uitbreidbaar datamodel, niet alleen een ander UI-laagje. Genoemd door Iska | Should | L |
| Handmatig een sollicitatie toevoegen (knop in het beheerportaal) | Kan nu alleen via het publieke formulier; nodig zodra kandidaten ook via Indeed/LinkedIn/telefoon binnenkomen zonder automatische koppeling. Genoemd door Iska, als expliciete terugvaloptie als de kanaalkoppelingen (zie categorie 8) niet lukken. Kleine, op zichzelf staande winst, los van of de grotere koppelingen er ooit komen | **Must** | S |

## 2. Vacaturebeheer

| Feature | Wat ontbreekt nu | Prioriteit | Inschatting |
|---|---|---|---|
| ~~Vacature dupliceren als snelkoppeling~~ ✅ | Afgerond: "Dupliceren"-knop in het overzicht, opent een vooringevulde, nog niet opgeslagen kopie (status altijd concept, titel met " (kopie)") | Must | S |
| Vaste keuzelijst voor afdeling/locatie i.p.v. vrije tekst | Nu vrije tekstvelden (bewust, zie `VOORTGANG.md`); risico op typo's/duplicaten ("Sales" vs. "sales") die filtering en rapportage bemoeilijken | Should | S |
| Zoekbalk in het vacature-overzicht (beheer) | Alleen een platte tabel, geen zoekfunctie; wordt onwerkbaar bij veel vacatures | Should | S |
| Preview van een vacature vóór publiceren | Er is een "concept"-status, maar geen rechtstreekse voorvertoning vanuit het beheerscherm zelf | Should | S |
| Bulk-acties op vacatures (meerdere tegelijk archiveren/publiceren) | Kan nu alleen 1-voor-1 | Could | S |
| Sluitingsdatum-herinnering (melding X dagen van tevoren aan HR) | De publieke sluitingsdatum-banner bestaat al voor kandidaten, maar HR krijgt zelf geen signaal | Could | S |
| Vacature-versiegeschiedenis (wie wijzigde wat, wanneer) | Geen audit-trail op vacatureniveau | Could | M |
| "Uitgelicht" vacature vastzetten bovenaan het overzicht | Volgorde is nu niet stuurbaar | Could | S |
| Interne vacatures (alleen zichtbaar voor ingelogde medewerkers, bv. interne doorstroom) | Bestaat niet; alle gepubliceerde vacatures zijn altijd publiek | Won't (nu) | M |

## 3. Publieke site / kandidaatervaring

| Feature | Wat ontbreekt nu | Prioriteit | Inschatting |
|---|---|---|---|
| Bevestigingsmail naar kandidaat na solliciteren | Kandidaat krijgt nu geen enkele bevestiging dat de sollicitatie is aangekomen | Must | S |
| Filteren/zoeken op de vacatures-pagina (afdeling, locatie, dienstverband) | `vacatures.html` toont alle vacatures onder elkaar, geen filter | Should | M |
| Toestemmingsvinkje bij het sollicitatieformulier (AVG) | Geen consent-checkbox, terwijl er wel persoonsgegevens en CV/motivatiebrief worden verwerkt | Must | S |
| Vacature delen (kopieer-link/social-knop) | Geen deelknop op de detailpagina | Could | S |
| ~~E-mail- en telefoonnummer-validatie in het sollicitatieformulier~~ ✅ | Afgerond: internationaal telefoonformaat (optionele landcode + 7-15 cijfers), client- én server-side, in alle 6 talen | Must | S |
| "Vergelijkbare vacatures" onderaan een detailpagina | Geen suggesties, kandidaat moet zelf terug naar het overzicht | Could | M |
| Job-alert (e-mail bij nieuwe vacature in gekozen categorie) | Bestaat niet | Could | L |

## 4. Rapportage & inzicht

| Feature | Wat ontbreekt nu | Prioriteit | Inschatting |
|---|---|---|---|
| Dashboard: aantal sollicitaties per vacature, doorlooptijd per status | Geen enkel overzicht/rapportage-scherm, alleen de ruwe tabellen | Should | M |
| Bron-tracking (UTM-parameters vastleggen bij sollicitatie) | Sollicitatiedata bevat geen herkomst; sluit niet aan op de manier waarop bronnen elders al gemeten worden (GA4/Looker Studio) | Should | M |
| Exportformaat afgestemd op Looker Studio/Data Studio (vaste, brede CSV met alle kolommen) | De eventuele bulk-export (zie categorie 1) is nu nog niet ontworpen met een BI-tool als afnemer in gedachten | Could | S |
| Conversieoverzicht: paginabezoek vacature → sollicitatie | Geen koppeling tussen sitebezoek en sollicitatie-uitkomst | Could | M |
| LinkedIn-kliks naar een vacature meten | Genoemd door Iska. Dit is vermoedelijk al op te lossen met UTM-parameters op de LinkedIn-links + GA4, zonder sitewijziging, zodra bron-tracking (hierboven) staat. Geen apart bouwpunt, eerder een procesafspraak | Should | — |

## 5. Rollen & rechten

| Feature | Wat ontbreekt nu | Prioriteit | Inschatting |
|---|---|---|---|
| Onderscheid tussen rollen (bv. recruiter volledig vs. hiring manager alleen inzien/reageren op eigen afdeling) | Bewust 1 vlak rechtenniveau voor nu (zie architectuurdocument): iedereen met portaaltoegang mag alles. De Standard-SKU-afhankelijkheid is inmiddels weggenomen (zie hieronder, rolgebaseerde toegang staat al live). Iska noemt expliciet: een leidinggevende moet een sollicitant kunnen bekijken én erop kunnen reageren binnen het portaal ("iets wezenlijks") | **Must** | L |
| Audit-log (wie wijzigde welke vacature/sollicitatie, wanneer) | Geen enkele wijzigingshistorie | Could | M |
| Eigenaar/recruiter toewijzen aan een vacature | Geen "verantwoordelijke"-veld | Could | S |

## 6. Communicatie & notificaties

| Feature | Wat ontbreekt nu | Prioriteit | Inschatting |
|---|---|---|---|
| Interne e-mailnotificatie bij nieuwe sollicitatie | Al eerder bewust uitgesteld (zie `VOORTGANG.md`); HR moet nu zelf het portaal in de gaten houden | Must | S |
| Sjabloon-mail direct vanuit het portaal versturen bij statuswijziging (bv. afwijzing, uitnodiging) | Contact met kandidaten verloopt nu volledig los van het portaal (eigen mailbox) | Should | M |
| Teams-notificatie bij nieuwe sollicitatie | Bestaat niet | Could | S |
| Eigen, eenvoudiger reply-adres voor kandidaatcommunicatie | Genoemd door Iska, exacte wens nog onduidelijk: gaat dit om een vast antwoordadres i.p.v. een persoonlijke mailbox, of om iets anders? **Even uitvragen voor dit scherp genoeg is om in te schatten** | ? | ? |

## 7. Compliance (AVG/privacy)

| Feature | Wat ontbreekt nu | Prioriteit | Inschatting |
|---|---|---|---|
| Bewaartermijn + automatische verwijdering van oude sollicitaties/CV's | Sollicitaties en bijlagen blijven onbeperkt bewaard, geen retentiebeleid | Must | M |
| Toestemmingsvinkje bij solliciteren | Zie ook categorie 3; hier expliciet als AVG-vereiste genoemd, niet alleen UX | Must | S |
| Kandidaat kan zelf verzoek indienen tot verwijdering ("recht op vergetelheid") | Geen self-service mogelijkheid; nu alleen mogelijk als HR handmatig verwijdert na een verzoek per mail | Should | M |

## 8. Externe kanaal-integraties

Allemaal genoemd door Iska. Dit zijn qua aard andere trajecten dan de rest
van deze backlog: afhankelijk van wat externe partijen (LinkedIn, Indeed,
PowerUs) aan hun kant toestaan, niet alleen van onze eigen bouwtijd.

| Feature | Wat ontbreekt nu | Prioriteit | Inschatting |
|---|---|---|---|
| LinkedIn-koppeling: sollicitanten automatisch in dit systeem krijgen | Bestaat niet. **Let op**: LinkedIn's publieke API's ondersteunen dit niet zomaar; het soort koppeling dat Iska bedoelt (binnenkomende sollicitaties) loopt normaliter via LinkedIn's Talent Solutions/"Apply Connect"-programma, wat een los commercieel partnerschap met LinkedIn is, geen kwestie van een API-key aanvragen. Eerst uitzoeken of OG daar toegang toe heeft/kan krijgen, vóór dit als bouwwerk wordt ingepland | Could | L (en mogelijk niet puur een bouwkwestie) |
| Indeed- en PowerUs-koppeling: vacature daarheen, reacties terug | Bestaat niet. Zelfde soort afhankelijkheid als LinkedIn: moet uitgezocht worden of deze partijen een geschikte API/feed aanbieden (vaak wel haalbaarder dan LinkedIn, Indeed heeft een bekende XML-feed-aanpak voor vacatures) | Could | L |
| Terugvaloptie als een koppeling niet lukt: zelf sollicitaties toevoegen | Zie categorie 1, "Handmatig een sollicitatie toevoegen" — dat ene punt is de concrete, direct bouwbare eerste stap, ongeacht of de koppelingen hierboven er ooit komen | **Must** | S |

## Kort overzicht: wat is al goed geregeld

Om scope-verwarring te voorkomen: content-beheer (body-blokken, media-
bibliotheek, header foto/video), publiceren/plannen/sluiten op datum,
sollicitatiestatussen, en de basis-authenticatie (Entra ID, tenant- en
groep-restrictie) zijn al gebouwd en werken. Deze backlog gaat uitsluitend
over wat daar nog naast zou moeten komen.
