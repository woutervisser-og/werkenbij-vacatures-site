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
| Doorklikken vanuit vacature naar bijbehorende sollicitaties | Vacature-overzicht toont geen aantal sollicitaties en linkt niet gefilterd door; je moet nu handmatig op naam zoeken in de losse, ongefilterde sollicitatietabel | Must | S |
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

## 2. Vacaturebeheer

| Feature | Wat ontbreekt nu | Prioriteit | Inschatting |
|---|---|---|---|
| Vacature dupliceren als snelkoppeling | Staat al als bewust uitgesteld genoemd in het architectuurdocument; elke vacature moet nu vanaf nul opgebouwd worden, ook als 90% overeenkomt met een bestaande | Should | S |
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
| "Vergelijkbare vacatures" onderaan een detailpagina | Geen suggesties, kandidaat moet zelf terug naar het overzicht | Could | M |
| Job-alert (e-mail bij nieuwe vacature in gekozen categorie) | Bestaat niet | Could | L |

## 4. Rapportage & inzicht

| Feature | Wat ontbreekt nu | Prioriteit | Inschatting |
|---|---|---|---|
| Dashboard: aantal sollicitaties per vacature, doorlooptijd per status | Geen enkel overzicht/rapportage-scherm, alleen de ruwe tabellen | Should | M |
| Bron-tracking (UTM-parameters vastleggen bij sollicitatie) | Sollicitatiedata bevat geen herkomst; sluit niet aan op de manier waarop bronnen elders al gemeten worden (GA4/Looker Studio) | Should | M |
| Exportformaat afgestemd op Looker Studio/Data Studio (vaste, brede CSV met alle kolommen) | De eventuele bulk-export (zie categorie 1) is nu nog niet ontworpen met een BI-tool als afnemer in gedachten | Could | S |
| Conversieoverzicht: paginabezoek vacature → sollicitatie | Geen koppeling tussen sitebezoek en sollicitatie-uitkomst | Could | M |

## 5. Rollen & rechten

| Feature | Wat ontbreekt nu | Prioriteit | Inschatting |
|---|---|---|---|
| Onderscheid tussen rollen (bv. recruiter volledig vs. hiring manager alleen inzien/reageren op eigen afdeling) | Bewust 1 vlak rechtenniveau voor nu (zie architectuurdocument): iedereen met portaaltoegang mag alles | Should | L (hangt af van de al uitgestelde Standard SKU-upgrade) |
| Audit-log (wie wijzigde welke vacature/sollicitatie, wanneer) | Geen enkele wijzigingshistorie | Could | M |
| Eigenaar/recruiter toewijzen aan een vacature | Geen "verantwoordelijke"-veld | Could | S |

## 6. Communicatie & notificaties

| Feature | Wat ontbreekt nu | Prioriteit | Inschatting |
|---|---|---|---|
| Interne e-mailnotificatie bij nieuwe sollicitatie | Al eerder bewust uitgesteld (zie `VOORTGANG.md`); HR moet nu zelf het portaal in de gaten houden | Must | S |
| Sjabloon-mail direct vanuit het portaal versturen bij statuswijziging (bv. afwijzing, uitnodiging) | Contact met kandidaten verloopt nu volledig los van het portaal (eigen mailbox) | Should | M |
| Teams-notificatie bij nieuwe sollicitatie | Bestaat niet | Could | S |

## 7. Compliance (AVG/privacy)

| Feature | Wat ontbreekt nu | Prioriteit | Inschatting |
|---|---|---|---|
| Bewaartermijn + automatische verwijdering van oude sollicitaties/CV's | Sollicitaties en bijlagen blijven onbeperkt bewaard, geen retentiebeleid | Must | M |
| Toestemmingsvinkje bij solliciteren | Zie ook categorie 3; hier expliciet als AVG-vereiste genoemd, niet alleen UX | Must | S |
| Kandidaat kan zelf verzoek indienen tot verwijdering ("recht op vergetelheid") | Geen self-service mogelijkheid; nu alleen mogelijk als HR handmatig verwijdert na een verzoek per mail | Should | M |

## Kort overzicht: wat is al goed geregeld

Om scope-verwarring te voorkomen: content-beheer (body-blokken, media-
bibliotheek, header foto/video), publiceren/plannen/sluiten op datum,
sollicitatiestatussen, en de basis-authenticatie (Entra ID, tenant- en
groep-restrictie) zijn al gebouwd en werken. Deze backlog gaat uitsluitend
over wat daar nog naast zou moeten komen.
