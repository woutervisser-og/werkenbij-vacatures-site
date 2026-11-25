// Toont wie is ingelogd, en blokkeert de pagina-inhoud met een
// "geen toegang"-melding als de gebruiker niet in de hrbeheer-rol zit.
//
// De echte beveiliging zit op de API's (allowedRoles: ["hrbeheer"] in
// staticwebapp.config.json): die blijven data weigeren, ook als iemand
// deze check zou omzeilen. Dit is alleen de gebruiksvriendelijke laag,
// zodat iemand zonder rol een duidelijke melding ziet in plaats van een
// kale 404 of een half-geladen pagina.
(function () {
  fetch("/.auth/me")
    .then((r) => r.json())
    .then((data) => {
      const principal = data.clientPrincipal;
      if (!principal) return;

      const gebruikerInfoEl = document.getElementById("gebruiker-info");
      if (gebruikerInfoEl) {
        gebruikerInfoEl.textContent = `Ingelogd als ${principal.userDetails} `;

        // Iemand met beide rollen (bv. om de leidinggevende-kant zelf te
        // testen) kan zo wisselen zonder een URL te moeten onthouden.
        if (Array.isArray(principal.userRoles) && principal.userRoles.includes("afdelingshoofd")) {
          const wisselLink = document.createElement("a");
          wisselLink.href = "/afdelingshoofd/sollicitaties.html";
          wisselLink.textContent = "Naar leidinggevende-weergave";
          gebruikerInfoEl.appendChild(wisselLink);
        }

        const uitlogLink = document.createElement("a");
        uitlogLink.href = "/.auth/logout?post_logout_redirect_uri=/";
        uitlogLink.innerHTML = (typeof icoonSvg === "function" ? icoonSvg("uitloggen", 14) : "") + "Uitloggen";
        gebruikerInfoEl.appendChild(uitlogLink);
      }

      const heeftToegang =
        Array.isArray(principal.userRoles) &&
        principal.userRoles.includes("hrbeheer");
      if (!heeftToegang) {
        document.body.classList.add("geen-toegang");
      }
    })
    .catch(() => {});
})();
