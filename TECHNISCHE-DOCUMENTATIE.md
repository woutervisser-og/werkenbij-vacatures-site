# Technische documentatie — recent gebouwde features

Uitleg van hoe 3 recent gebouwde features werken en hoe je ze onderhoudt.
Voor de chronologie van beslissingen en welke PR wat deed, zie
`VOORTGANG.md`. Dit document beschrijft de eindsituatie: wat er staat,
waar, en waar je moet zijn als je iets wilt aanpassen.

## 1. Europa-vacaturekaart (homepage)

Interactieve kaart op `index.html` die per land toont hoeveel vacatures
er openstaan. Klik op een land met vacatures → springt naar
`vacatures.html?land=<Land>` (bestaand filtermechanisme).

**Bestanden:**
- `europa-kaart.js` — de hele widget (D3-rendering, tooltip, klik,
  toetsenbord, mobiele lijstweergave, GSAP-animatie bij eerste keer in
  beeld).
- `data/europa-landen.geo.json` — zelf gehoste, gefilterde GeoJSON
  (46 Europese landen, overzeese gebieden verwijderd om de
  Europa-projectie niet te verstoren). Bron: npm-package `world-atlas`
  (Natural Earth-data, publiek domein).
- `api/GetVacaturesPerLand/index.js` — publieke, anonieme Function die
  per land telt hoeveel vacatures de status `"gepubliceerd"` hebben.

**Hoe de koppeling Locatie → land werkt:**
1. Eerst de vaste `LOCATIE_LANDCODE`-tabel in
   `api/shared/vacaturesTable.js` (dekt de huidige kantoren + "Nederland
   (reizend)").
2. Anders: het land uit `"Stad, Land"` knippen en opzoeken in
   `NAAM_NAAR_ALPHA2` in `api/GetVacaturesPerLand/index.js`.
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

## 2. Vacature-tegel thumbnails + verkleinde afbeeldingen

De vacature-tegels op `vacatures.html` tonen de headerfoto van de
vacature (dezelfde foto als op de detailpagina) als thumbnail bovenaan
de tegel.

**Probleem dat dit oploste:** headerfoto's zijn vaak ongewijzigde
camera-originelen van 1,7-2,1 MB op ~4600px breedte. Rechtstreeks als
thumbnail laden maakte het vacature-overzicht merkbaar traag.

**Oplossing — `api/Thumbnail`:** publieke, anonieme Function die een
bestand uit de mediabibliotheek opvraagt, verkleint met `sharp` naar
400/800/1200px breedte (standaard 800) en comprimeert als WebP
(kwaliteit 75). Cache-Control staat op een jaar + immutable: elke
geüploade bestandsnaam is een unieke UUID (zie `api/MediaUpload`), dus
dezelfde naam levert altijd dezelfde inhoud.

`vacatures.html` bouwt de thumbnail-URL zelf op
(`maakThumbnailUrl()`): pakt de bestandsnaam uit
`vacature.header.bron` en vraagt die op via
`/api/Thumbnail?bestand=<naam>&breedte=800`. Werkt automatisch voor
**elke** vacature met een foto-header, ook oudere — geen migratie of
herupload nodig.

**Vacatures zonder bruikbare thumbnail:** een video-header (de bron is
een embed-URL, geen afbeelding) of helemaal geen header krijgt een
oranje verloop-placeholder (`.vacature-card-thumb-fallback` in
`styles.css`) i.p.v. een kapotte afbeelding.

**Onderhoud:** niets — dit werkt vanzelf voor nieuwe uploads. Wil je de
thumbnail-breedte of compressie-kwaliteit aanpassen, dat zit in
`api/Thumbnail/index.js` (`TOEGESTANE_BREEDTES`, `.webp({ quality: 75 })`).

## 3. Meertaligheid (i18n)

De site ondersteunt 6 talen: EN (basistaal), NL, FR, DE, IT, SE.

**Bestanden:**
- `i18n/i18n.js` — het systeem zelf: leest de taal uit de URL
  (`/fr/...`), haalt `/i18n/<taal>.json` op, vult elk element met een
  `data-i18n`-attribuut in.
- `i18n/en.json`, `nl.json`, `fr.json`, `de.json`, `it.json`, `se.json`
  — de vertalingen zelf, 1 bestand per taal, geneste JSON-structuur
  (bv. `overOns.tijdlijn2008`).

**Fallback-gedrag:** ontbreekt een sleutel in de gekozen taal, dan valt
`i18n.js` terug op de EN-waarde (nooit een lege tekst). Dat voorkomt
crashes, maar betekent ook dat een vergeten vertaling **onopgemerkt**
Engelse tekst toont — precies wat er gebeurde tot [PR #93](https://github.com/woutervisser-og/werkenbij-vacatures-site/pull/93):
fr/de/it/se.json waren 78 sleutels achterop geraakt sinds de tijdlijn,
de "17 afdelingen"-sectie en de Europa-kaart waren toegevoegd.

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
