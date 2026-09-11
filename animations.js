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