// Zelfde patroon als /beheer/beheer-auth.js, maar voor de rol
// "afdelingshoofd" i.p.v. "hrbeheer". De echte beveiliging zit op de
// API's (allowedRoles: ["afdelingshoofd"] in staticwebapp.config.json):
// dit is alleen de gebruiksvriendelijke laag.
(function () {
  fetch("/.auth/me")
    .then((r) => r.json())
    .then((data) => {
      const principal = data.clientPrincipal;
      if (!principal) return;

      const gebruikerInfoEl = document.getElementById("gebruiker-info");
      if (gebruikerInfoEl) {
        gebruikerInfoEl.textContent = `Ingelogd als ${principal.userDetails} `;
        const uitlogLink = document.createElement("a");
        uitlogLink.href = "/.auth/logout?post_logout_redirect_uri=/";
        uitlogLink.innerHTML = (typeof icoonSvg === "function" ? icoonSvg("uitloggen", 14) : "") + "Uitloggen";
        gebruikerInfoEl.appendChild(uitlogLink);
      }

      const heeftToegang =
        Array.isArray(principal.userRoles) &&
        principal.userRoles.includes("afdelingshoofd");
      if (!heeftToegang) {
        document.body.classList.add("geen-toegang");
      }
    })
    .catch(() => {});
})();
