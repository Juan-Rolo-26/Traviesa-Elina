import React, { useEffect, useRef, useState } from "react";
import promoDelMes2 from "../assets/hero/promo-del-mes-2.mp4";
import armaTuPaquete2 from "../assets/hero/arma-tu-paquete-2.mp4";
import elDiaEsHoyVideo from "../assets/hero/el-dia-es-hoy.mp4";
import promo20Off7 from "../assets/hero/20-off-7.mp4";
import promo20OffFallback from "../assets/hero/20-off.mp4";
import promoDelMesFallback from "../assets/hero/promo-del-mes.mp4";
import blanqueriaYBazarVideo from "../assets/hero/blanqueria_y_bazar.mp4";
import disenoSinTituloVideo from "../assets/hero/diseno_sin_titulo.mp4";
import renovaTuCamaVideo from "../assets/hero/renova_tu_cama.mp4";
import "../styles/HeroCarousel.css";

const AUTOPLAY_MS = 6000;
const INTERACTION_PAUSE_MS = 8000;

function HeroCarousel() {
  const slides = [
    { type: "video", src: blanqueriaYBazarVideo, alt: "Blanqueria y bazar", durationMs: 5000 },
    { type: "video", src: disenoSinTituloVideo, alt: "Diseño sin título", durationMs: 5000 },
    { type: "video", src: renovaTuCamaVideo, alt: "Renova tu cama", durationMs: 5000 },
    { type: "video", src: promoDelMes2, fallbackSrc: promoDelMesFallback, alt: "Promo del mes 2", durationMs: AUTOPLAY_MS },
    { type: "video", src: armaTuPaquete2, alt: "Arma tu paquete 2", durationMs: 8000 },
    { type: "video", src: elDiaEsHoyVideo, fallbackSrc: promoDelMesFallback, alt: "El dia es hoy", durationMs: AUTOPLAY_MS },
    { type: "video", src: promo20Off7, fallbackSrc: promo20OffFallback, alt: "Promo 20 por ciento off 7", durationMs: 8000 },
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const [pauseUntil, setPauseUntil] = useState(0);
  const resumeTimeoutRef = useRef(null);
  const videoRefs = useRef([]);

  const isPaused = pauseUntil > Date.now();

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
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      if (index === activeIndex) {
        video.currentTime = 0;
        const playPromise = video.play();
        if (playPromise?.catch) playPromise.catch(() => {});
      } else {
        video.pause();
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
        {slides.map((slide, index) => (
          <div
            key={`${slide.type}-${slide.src}`}
            className={`hero-carousel-slide ${activeIndex === index ? "active" : ""}`}
            aria-hidden={activeIndex !== index}
          >
            {slide.type === "video" ? (
              <video
                className="hero-carousel-media"
                src={slide.src}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                onError={(event) => {
                  if (!slide.fallbackSrc) return;
                  const video = event.currentTarget;
                  if (video.src?.includes(slide.fallbackSrc)) return;
                  video.src = slide.fallbackSrc;
                  video.load();
                  const playPromise = video.play();
                  if (playPromise?.catch) playPromise.catch(() => {});
                }}
                ref={(el) => {
                  videoRefs.current[index] = el;
                }}
              />
            ) : (
              <img className="hero-carousel-media" src={slide.src} alt={slide.alt} />
            )}
          </div>
        ))}
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
