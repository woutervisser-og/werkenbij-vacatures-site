# Voortgang HR-portaal

Bijgehouden beslissingen en status. Voor het ontwerp zelf, zie
`ARCHITECTUUR-HR-PORTAAL.md`. Eenmalige uitvoerende stappenplannen (bv.
handmatige Azure-portal acties) staan niet in een bestand, maar worden in
de chat gedeeld op het moment dat ze nodig zijn.

## Afgerond

- Architectuurdocument (`ARCHITECTUUR-HR-PORTAAL.md`) vastgesteld: overstap
  van SharePoint naar een zelfgebouwd portaal op Azure (Static Web Apps,
  Entra ID, Functions, Table/Blob Storage).

## Volgende stap

- Azure-kant handmatig opzetten in de portal:
  - Nieuwe App Registration `Werkenbij-HR-Portaal` (tenant-restricted,
    los van `Werkenbij-Vacatures-API`).
  - Beveiligingsgroep `HR-Portaal-Toegang` (Iska als lid).

## Nog open

- Rollen-Function schrijven (checkt groepslidmaatschap, kent rol
  `hrbeheer` toe).
- Route-restrictie `/beheer/*` instellen in de Static Web App configuratie.
- Overige bouwstenen (Azure Functions CRUD, Table Storage, Blob Storage)
  nog te bouwen.
