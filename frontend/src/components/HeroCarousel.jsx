import React, { useEffect, useRef, useState } from "react";
import promoDelMes2 from "../assets/hero/promo-del-mes-2.mp4";
import armaTuPaquete2 from "../assets/hero/arma-tu-paquete-2.mp4";
import promo20Off7 from "../assets/hero/20-off-7.mp4";
import promo20OffFallback from "../assets/hero/20-off.mp4";
import promoDelMesFallback from "../assets/hero/promo-del-mes.mp4";
import blanqueriaYBazarVideo from "../assets/hero/blanqueria_y_bazar.mp4";
import disenoSinTituloVideo from "../assets/hero/diseno_sin_titulo.mp4";
import renovaTuCamaVideo from "../assets/hero/renova_tu_cama.mp4";
import renovaTuCamaMobileVideo from "../assets/hero/renova_tu_cama_mobile.mp4";
import blanqueriaYBazarMobile from "../assets/hero/blanqueria_y_bazar_mobile.mp4";
import armaTuPaquete2Mobile from "../assets/hero/arma_tu_paquete_2_mobile.mp4";
import promoDelMes2Mobile from "../assets/hero/promo_del_mes_2_mobile.mp4";
import "../styles/HeroCarousel.css";

const AUTOPLAY_MS = 6000;
const INTERACTION_PAUSE_MS = 8000;

function HeroCarousel() {
  const slides = [
    { type: "video", src: blanqueriaYBazarVideo, mobileSrc: blanqueriaYBazarMobile, alt: "Blanqueria y bazar", durationMs: 5000 },
    { type: "video", src: disenoSinTituloVideo, alt: "Diseño sin título", durationMs: 5000 },
    { type: "video", src: renovaTuCamaVideo, mobileSrc: renovaTuCamaMobileVideo, alt: "Renova tu cama", durationMs: 5000 },
    { type: "video", src: promoDelMes2, mobileSrc: promoDelMes2Mobile, fallbackSrc: promoDelMesFallback, alt: "Promo del mes 2", durationMs: AUTOPLAY_MS },
    { type: "video", src: armaTuPaquete2, mobileSrc: armaTuPaquete2Mobile, alt: "Arma tu paquete 2", durationMs: 8000 },
    { type: "video", src: promo20Off7, fallbackSrc: promo20OffFallback, alt: "Promo 20 por ciento off 7", durationMs: 8000 },
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const [pauseUntil, setPauseUntil] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const resumeTimeoutRef = useRef(null);
  const slideRefs = useRef([]);

  const isPaused = pauseUntil > Date.now();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 920);
    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isPaused) return undefined;
    const durationMs = slides[activeIndex]?.durationMs || AUTOPLAY_MS;
    const timer = setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, durationMs);
    return () => clearTimeout(timer);
  }, [activeIndex, isPaused, slides]);

  useEffect(
    () => () => {
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    },
    []
  );

  useEffect(() => {
    slideRefs.current.forEach((slideDiv, index) => {
      if (!slideDiv) return;
      const videos = slideDiv.querySelectorAll('video');
      if (index === activeIndex) {
        videos.forEach(v => {
          v.currentTime = 0;
          const playPromise = v.play();
          if (playPromise?.catch) playPromise.catch(() => { });
        });
      } else {
        videos.forEach(v => {
          v.pause();
          v.currentTime = 0;
        });
      }
    });
  }, [activeIndex]);

  const pauseAfterInteraction = () => {
    const until = Date.now() + INTERACTION_PAUSE_MS;
    setPauseUntil(until);
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => setPauseUntil(0), INTERACTION_PAUSE_MS);
  };

  const goPrev = () => {
    pauseAfterInteraction();
    setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goNext = () => {
    pauseAfterInteraction();
    setActiveIndex((prev) => (prev + 1) % slides.length);
  };

  const goTo = (index) => {
    pauseAfterInteraction();
    setActiveIndex(index);
  };

  return (
    <section className="hero-carousel" aria-label="Promociones">
      <div className="hero-carousel-track">
        {slides.map((slide, index) => {
          // Si estamos en mobile y existe el video de mobile, usamos ese. Si no, usamos el por defecto.
          const actualVideoSrc = (isMobile && slide.mobileSrc) ? slide.mobileSrc : slide.src;

          return (
            <div
              key={`${slide.type}-${slide.src}`}
              className={`hero-carousel-slide ${activeIndex === index ? "active" : ""}`}
              aria-hidden={activeIndex !== index}
              ref={(el) => {
                slideRefs.current[index] = el;
              }}
            >
              {slide.type === "video" ? (
                <video
                  key={isMobile ? "mobile" : "desktop"} // Force re-render to completely unload previous video buffer from memory if viewport changes
                  className="hero-carousel-media"
                  src={actualVideoSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  onError={(event) => {
                    if (isMobile) return; // Si es mobile, no hay fallback registrado por defecto en el array, solo fallbacks para desktop right now
                    if (!slide.fallbackSrc) return;
                    const video = event.currentTarget;
                    if (video.src?.includes(slide.fallbackSrc)) return;
                    video.src = slide.fallbackSrc;
                    video.load();
                    const playPromise = video.play();
                    if (playPromise?.catch) playPromise.catch(() => { });
                  }}
                />
              ) : (
                <img className="hero-carousel-media" src={slide.src} alt={slide.alt} />
              )}
            </div>
          );
        })}
      </div>

      <button className="hero-carousel-arrow left" type="button" aria-label="Anterior" onClick={goPrev}>
        ‹
      </button>
      <button className="hero-carousel-arrow right" type="button" aria-label="Siguiente" onClick={goNext}>
        ›
      </button>

      <div className="hero-carousel-dots" role="tablist" aria-label="Seleccionar slide">
        {slides.map((_, index) => (
          <button
            key={index}
            type="button"
            className={`hero-carousel-dot ${activeIndex === index ? "active" : ""}`}
            onClick={() => goTo(index)}
            aria-label={`Ir a slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}

export default HeroCarousel;
