// GSAP/ScrollTrigger-animaties, alleen voor over-ons.html (vandaar een
// los bestand i.p.v. toevoegen aan het generieke animations.js, dat op
// elke pagina wordt geladen). Progressive enhancement: als de CDN-scripts
// om wat voor reden dan ook niet laden, doet dit bestand simpelweg niets
// en blijft de pagina volledig leesbaar/functioneel zonder animaties.
document.addEventListener("DOMContentLoaded", () => {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);

  // 1. Subtiele parallax op de hero-video: de achtergrond schuift een
  // fractie van de scrollafstand mee (~0.3x), niet de volledige afstand
  // van de content erboven, voor een lichte dieptesuggestie bij het
  // binnenkomen van de pagina. .hero-video heeft in CSS bewust extra
  // hoogte (130%) zodat dit schuiven nooit een lege rand laat zien.
  const heroVideo = document.querySelector(".hero-video");
  const hero = document.querySelector(".hero");
  if (heroVideo && hero) {
    gsap.set(heroVideo, { willChange: "transform" });
    gsap.fromTo(
      heroVideo,
      { yPercent: -10 },
      {
        yPercent: 10,
        ease: "none",
        scrollTrigger: {
          trigger: hero,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      }
    );
  }

  // 2. De 3 "wat we belangrijk vinden"-kaarten komen na elkaar in beeld
  // (150ms stagger) i.p.v. gelijktijdig: alleen fade, geen y-verschuiving.
  // Een y-schuif in combinatie met een stagger laat de kaarten tijdens de
  // overgang tijdelijk op ongelijke hoogte staan ("scheef"); ze moeten
  // altijd gewoon netjes naast elkaar staan, alleen de zichtbaarheid komt
  // na elkaar in beeld.
  const kaarten = gsap.utils.toArray(".card-grid-3 .teaser-card");
  if (kaarten.length) {
    gsap.set(kaarten, { willChange: "opacity" });
    gsap.from(kaarten, {
      opacity: 0,
      duration: 0.6,
      ease: "power2.out",
      stagger: 0.15,
      clearProps: "willChange",
      scrollTrigger: {
        trigger: ".card-grid-3",
        start: "top 85%",
      },
    });
  }

  // 3. De quote-tekst verschijnt woord voor woord i.p.v. in 1 keer.
  // Wacht op i18n.js (window.OG_I18N_KLAAR): de tekst zelf staat pas vast
  // zodra de juiste taal is ingeladen, pas daarna heeft het zin om 'm in
  // losse woord-spans te knippen.
  const quoteParagraaf = document.querySelector(".blok-quote p");
  if (quoteParagraaf && window.OG_I18N_KLAAR) {
    window.OG_I18N_KLAAR.then(() => {
      const woorden = quoteParagraaf.textContent.trim().split(/\s+/);
      const fragment = document.createDocumentFragment();
      woorden.forEach((woord, i) => {
        const span = document.createElement("span");
        span.className = "quote-woord";
        span.textContent = woord;
        fragment.appendChild(span);
        if (i < woorden.length - 1) fragment.appendChild(document.createTextNode(" "));
      });
      quoteParagraaf.innerHTML = "";
      quoteParagraaf.appendChild(fragment);

      const woordSpans = quoteParagraaf.querySelectorAll(".quote-woord");
      gsap.set(woordSpans, { opacity: 0, y: 12, willChange: "transform, opacity" });
      gsap.to(woordSpans, {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: "power2.out",
        stagger: 0.04,
        clearProps: "willChange",
        scrollTrigger: {
          trigger: ".blok-quote",
          start: "top 80%",
        },
      });
    });
  }
});
