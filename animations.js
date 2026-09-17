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

// Tijdlijn "onze geschiedenis" (over-ons.html): full-screen sticky
// foto-slider. Terwijl je de hoge #tijdlijn-slider-wrapper doorscrolt
// blijft .tijdlijn-slider-sticky op zijn plek staan; hier berekenen we
// aan de hand van de scrollpositie welk jaar daarbij hoort en kruisfaden
// we de achtergrondfoto, tekst en actieve jaartal-knop. Klikken op een
// jaartal in de nav scrollt (smooth) naar het bijbehorende punt in de
// wrapper, wat via dezelfde logica de kruisfade triggert.
document.addEventListener("DOMContentLoaded", () => {
  const wrapper = document.getElementById("tijdlijn-slider");
  if (!wrapper) return;

  const jaren = wrapper.dataset.jaren.split(",");
  const achtergronden = wrapper.querySelectorAll(".tijdlijn-slider-achtergrond");
  const teksten = wrapper.querySelectorAll(".tijdlijn-slider-inhoud p");
  const jaarLabel = document.getElementById("tijdlijn-slider-jaar");
  const navKnoppen = wrapper.querySelectorAll(".tijdlijn-slider-nav-knop");

  let huidigeIndex = -1;

  const zetActief = (index) => {
    if (index === huidigeIndex) return;
    huidigeIndex = index;
    achtergronden.forEach((el, i) => el.classList.toggle("is-actief", i === index));
    teksten.forEach((el, i) => el.classList.toggle("is-actief", i === index));
    navKnoppen.forEach((el, i) => el.classList.toggle("is-actief", i === index));
    if (jaarLabel) jaarLabel.textContent = jaren[index];
  };

  const totaalScrollbaar = () => wrapper.offsetHeight - window.innerHeight;

  const bijwerken = () => {
    const scrollbaar = totaalScrollbaar();
    const voortgang = scrollbaar > 0 ? Math.min(1, Math.max(0, -wrapper.getBoundingClientRect().top / scrollbaar)) : 0;
    zetActief(Math.round(voortgang * (jaren.length - 1)));
  };
  bijwerken();
  window.addEventListener("scroll", bijwerken, { passive: true });
  window.addEventListener("resize", bijwerken);

  navKnoppen.forEach((knop, i) => {
    knop.addEventListener("click", () => {
      const scrollbaar = totaalScrollbaar();
      const doel = wrapper.offsetTop + (scrollbaar > 0 ? (i / (jaren.length - 1)) * scrollbaar : 0);
      window.scrollTo({ top: doel, behavior: "smooth" });
    });
  });
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