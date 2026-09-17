// Elementen met class "reveal" faden en glijden in zodra ze in beeld komen.
document.addEventListener("DOMContentLoaded", () => {
  const elementen = document.querySelectorAll(".reveal");

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  elementen.forEach(el => observer.observe(el));
});

// Sticky header: op pagina's met een hero (".pagina-met-hero" op <body>)
// start de header transparant met een wit logo, overlappend op de hero.
// Zodra je voorbij de hero scrolt wordt hij weer een gewone effen witte
// balk ("header-solide"). Op andere pagina's (geen hero) blijft de
// header altijd effen wit, dus daar hoeft niets te gebeuren.
document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector("header");
  if (!header || !document.body.classList.contains("pagina-met-hero")) return;

  const drempel = 80;
  const bijwerken = () => {
    header.classList.toggle("header-solide", window.scrollY > drempel);
  };
  bijwerken();
  window.addEventListener("scroll", bijwerken, { passive: true });
});

// Tijdlijn "onze geschiedenis" (over-ons.html): een vrachtwagen-icoon
// rijdt met de scroll mee langs de verticale lijn, van het eerste jaartal
// (boven) naar het laatste (onder). Voortgang wordt bepaald door hoe ver
// het midden van het beeldscherm al door de tijdlijn-track gezakt is,
// geklemd tussen 0 en 1 zodat de truck nooit boven/onder de lijn uitsteekt.
document.addEventListener("DOMContentLoaded", () => {
  const track = document.querySelector(".tijdlijn-track");
  const truck = document.querySelector(".tijdlijn-truck");
  if (!track || !truck) return;

  const bijwerken = () => {
    const rect = track.getBoundingClientRect();
    const viewportMidden = window.innerHeight * 0.5;
    const voortgang = Math.min(1, Math.max(0, (viewportMidden - rect.top) / rect.height));
    truck.style.top = (voortgang * rect.height) + "px";
  };
  bijwerken();
  window.addEventListener("scroll", bijwerken, { passive: true });
  window.addEventListener("resize", bijwerken);
});

// Taal-selector in de header: klik op de knop opent/sluit de dropdown met
// taalopties, een klik buiten de selector sluit 'm weer. Werkt voor elke
// ".taal-nav-selector" op de pagina (er hoort er maar 1 te zijn, maar dit
// blijft correct mocht dat ooit veranderen).
document.addEventListener("DOMContentLoaded", () => {
  const selectors = document.querySelectorAll(".taal-nav-selector");
  if (!selectors.length) return;

  selectors.forEach(selector => {
    const knop = selector.querySelector(".taal-nav-knop");
    if (!knop) return;
    knop.addEventListener("click", (event) => {
      event.stopPropagation();
      const wordtGeopend = !selector.classList.contains("open");
      selectors.forEach(s => s.classList.remove("open"));
      selector.classList.toggle("open", wordtGeopend);
      knop.setAttribute("aria-expanded", String(wordtGeopend));
    });
  });

  document.addEventListener("click", () => {
    selectors.forEach(s => {
      s.classList.remove("open");
      const knop = s.querySelector(".taal-nav-knop");
      if (knop) knop.setAttribute("aria-expanded", "false");
    });
  });
});

// Hamburgermenu op mobiel: klik op de knop klapt de nav + taal-selector
// uit/in (".mobiel-menu-open" op <header>, zie styles.css). Alleen
// zichtbaar/werkzaam onder 640px, maar de listener kan altijd gewoon
// staan (de knop is dan simpelweg niet zichtbaar/klikbaar).
document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector("header");
  const hamburger = document.getElementById("hamburger-knop");
  if (!header || !hamburger) return;

  hamburger.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = header.classList.toggle("mobiel-menu-open");
    hamburger.setAttribute("aria-expanded", String(open));
  });
});