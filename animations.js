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