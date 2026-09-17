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

// Tijdlijn "onze geschiedenis" (over-ons.html): horizontale, beeldvullende
// foto-slider met een vaste hoogte (geen scroll-jacking: de sectie neemt
// gewoon 1 vast blok in de paginaflow in, verticaal scrollen gaat er
// gewoon doorheen). Navigeren tussen jaren gaat horizontaal: klik op een
// jaartal of pijlknop, swipe/sleep, of de pijltjestoetsen. De actieve
// foto schuift in vanaf links/rechts (afhankelijk van de richting, zie
// .instapt-links/.instapt-rechts in styles.css), tekst en jaartal-knop
// kruisfaden via .is-actief.
document.addEventListener("DOMContentLoaded", () => {
  const wrapper = document.getElementById("tijdlijn-slider");
  if (!wrapper) return;

  const jaren = wrapper.dataset.jaren.split(",");
  const achtergronden = Array.from(wrapper.querySelectorAll(".tijdlijn-slider-achtergrond"));
  const teksten = Array.from(wrapper.querySelectorAll(".tijdlijn-slider-inhoud p"));
  const jaarLabel = document.getElementById("tijdlijn-slider-jaar");
  const navKnoppen = Array.from(wrapper.querySelectorAll(".tijdlijn-slider-nav-knop"));
  const vorigeKnop = wrapper.querySelector(".tijdlijn-slider-pijl-vorige");
  const volgendeKnop = wrapper.querySelector(".tijdlijn-slider-pijl-volgende");

  let huidigeIndex = 0;

  // Zet een achtergrond direct (zonder transitie) op een startpositie,
  // zodat de daaropvolgende overgang naar .is-actief altijd vanaf de
  // juiste kant instapt, ook als deze foto nog nooit actief is geweest.
  const zetPositieDirect = (el, kant) => {
    el.classList.add("geen-transitie");
    el.classList.remove("is-actief", "instapt-links", "instapt-rechts");
    el.classList.add(kant);
    void el.offsetWidth; // forceer reflow, anders wordt "geen-transitie" te laat verwijderd
    el.classList.remove("geen-transitie");
  };

  // Initiële opstelling: alle jaren op 1 na geparkeerd rechts (die komen
  // pas "van rechts" in beeld bij vooruit-navigatie).
  achtergronden.forEach((el, i) => {
    if (i === 0) return;
    zetPositieDirect(el, "instapt-rechts");
  });

  const werkKnoppenBij = () => {
    if (vorigeKnop) vorigeKnop.disabled = huidigeIndex === 0;
    if (volgendeKnop) volgendeKnop.disabled = huidigeIndex === jaren.length - 1;
  };
  werkKnoppenBij();

  const gaNaar = (nieuweIndex) => {
    nieuweIndex = Math.max(0, Math.min(jaren.length - 1, nieuweIndex));
    if (nieuweIndex === huidigeIndex) return;
    const vooruit = nieuweIndex > huidigeIndex;

    achtergronden[huidigeIndex].classList.remove("is-actief");
    achtergronden[huidigeIndex].classList.add(vooruit ? "instapt-links" : "instapt-rechts");

    zetPositieDirect(achtergronden[nieuweIndex], vooruit ? "instapt-rechts" : "instapt-links");
    requestAnimationFrame(() => {
      achtergronden[nieuweIndex].classList.remove("instapt-links", "instapt-rechts");
      achtergronden[nieuweIndex].classList.add("is-actief");
    });

    teksten.forEach((el, i) => el.classList.toggle("is-actief", i === nieuweIndex));
    navKnoppen.forEach((el, i) => el.classList.toggle("is-actief", i === nieuweIndex));
    if (jaarLabel) jaarLabel.textContent = jaren[nieuweIndex];

    huidigeIndex = nieuweIndex;
    werkKnoppenBij();
  };

  navKnoppen.forEach((knop, i) => knop.addEventListener("click", () => gaNaar(i)));
  if (vorigeKnop) vorigeKnop.addEventListener("click", () => gaNaar(huidigeIndex - 1));
  if (volgendeKnop) volgendeKnop.addEventListener("click", () => gaNaar(huidigeIndex + 1));

  wrapper.setAttribute("tabindex", "0");
  wrapper.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") gaNaar(huidigeIndex + 1);
    if (event.key === "ArrowLeft") gaNaar(huidigeIndex - 1);
  });

  // Swipe/sleep (touch + muis): alleen een overwegend horizontale
  // uitslag telt als jaar-wissel. touch-action:pan-y (styles.css) laat
  // een overwegend verticale sleep gewoon de pagina scrollen.
  let startX = null;
  let startY = null;
  let sleept = false;

  const sleepStart = (x, y) => {
    startX = x;
    startY = y;
    sleept = true;
  };
  const sleepEind = (x, y) => {
    if (!sleept) return;
    sleept = false;
    const dx = x - startX;
    const dy = y - startY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      gaNaar(huidigeIndex + (dx < 0 ? 1 : -1));
    }
  };

  wrapper.addEventListener("touchstart", (event) => {
    const t = event.touches[0];
    sleepStart(t.clientX, t.clientY);
  }, { passive: true });
  wrapper.addEventListener("touchend", (event) => {
    const t = event.changedTouches[0];
    sleepEind(t.clientX, t.clientY);
  }, { passive: true });

  wrapper.addEventListener("mousedown", (event) => {
    sleepStart(event.clientX, event.clientY);
  });
  window.addEventListener("mouseup", (event) => {
    if (sleept) sleepEind(event.clientX, event.clientY);
  });
});

// Maatschappelijke-betrokkenheid galerij (over-ons.html): een ECHTE
// (native) horizontale scroll-container, in tegenstelling tot de
// tijdlijn-slider hierboven. Met maar 3 frames is er geen eigen
// slide-logica nodig: overflow-x + scroll-snap doen het werk, dit
// script voegt alleen de pijlknoppen en de dot-indicator toe als extra
// (niet als vereiste) navigatiehulp bovenop swipen/slepen/scrollen.
document.addEventListener("DOMContentLoaded", () => {
  const galerij = document.getElementById("betrokkenheid-galerij");
  if (!galerij) return;
  // De pijlknoppen en dots staan bewust buiten #betrokkenheid-galerij (de
  // scrollcontainer zelf) in .betrokkenheid-galerij-wrap: position:absolute
  // binnen een scrollende ouder scrollt gewoon mee met de inhoud, dus
  // alleen als sibling van de scrollcontainer blijven ze op vaste plek
  // staan (zie styles.css).
  const wrap = galerij.parentElement;

  const frames = Array.from(galerij.querySelectorAll(".betrokkenheid-frame"));
  const vorigeKnop = wrap.querySelector(".betrokkenheid-galerij-pijl-vorige");
  const volgendeKnop = wrap.querySelector(".betrokkenheid-galerij-pijl-volgende");
  const dots = Array.from(wrap.querySelectorAll(".betrokkenheid-galerij-dot"));

  const huidigeIndex = () => Math.round(galerij.scrollLeft / galerij.clientWidth);

  const werkBij = () => {
    const index = Math.max(0, Math.min(frames.length - 1, huidigeIndex()));
    if (vorigeKnop) vorigeKnop.disabled = index === 0;
    if (volgendeKnop) volgendeKnop.disabled = index === frames.length - 1;
    dots.forEach((dot, i) => dot.classList.toggle("is-actief", i === index));
  };
  werkBij();

  const gaNaar = (index) => {
    const doel = Math.max(0, Math.min(frames.length - 1, index));
    galerij.scrollTo({ left: doel * galerij.clientWidth, behavior: "smooth" });
  };

  if (vorigeKnop) vorigeKnop.addEventListener("click", () => gaNaar(huidigeIndex() - 1));
  if (volgendeKnop) volgendeKnop.addEventListener("click", () => gaNaar(huidigeIndex() + 1));
  dots.forEach((dot, i) => dot.addEventListener("click", () => gaNaar(i)));

  let bijwerkGepland = false;
  galerij.addEventListener("scroll", () => {
    if (bijwerkGepland) return;
    bijwerkGepland = true;
    requestAnimationFrame(() => {
      werkBij();
      bijwerkGepland = false;
    });
  }, { passive: true });
  window.addEventListener("resize", werkBij);
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