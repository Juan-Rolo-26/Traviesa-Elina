import React, { useEffect, useRef, useState, useCallback } from "react";
import { fetchHeroSlides, uploadHeroSlide, deleteHeroSlide } from "../api";
import "../styles/HeroCarousel.css";

const AUTOPLAY_MS = 6000;
const INTERACTION_PAUSE_MS = 8000;

/* ── Hardcoded legacy slides (used as fallback when DB is empty) ── */
import promoDelMes2 from "../assets/hero/promo-del-mes-2.mp4";
import armaTuPaquete2 from "../assets/hero/arma-tu-paquete-2.mp4";
import promoDelMesFallback from "../assets/hero/promo-del-mes.mp4";
import blanqueriaYBazarVideo from "../assets/hero/blanqueria_y_bazar.mp4";
import disenoSinTituloVideo from "../assets/hero/diseno_sin_titulo.mp4";
import renovaTuCamaVideo from "../assets/hero/renova_tu_cama.mp4";
import renovaTuCamaMobileVideo from "../assets/hero/renova_tu_cama_mobile.mp4";
import blanqueriaYBazarMobile from "../assets/hero/blanqueria_y_bazar_mobile.mp4";
import armaTuPaquete2Mobile from "../assets/hero/arma_tu_paquete_2_mobile.mp4";
import promoDelMes2Mobile from "../assets/hero/promo_del_mes_2_mobile.mp4";

const STATIC_SLIDES = [
  { type: "video", src: blanqueriaYBazarVideo, mobileSrc: blanqueriaYBazarMobile, alt: "Blanqueria y bazar", durationMs: 5000 },
  { type: "video", src: disenoSinTituloVideo, alt: "Diseño sin título", durationMs: 5000 },
  { type: "video", src: renovaTuCamaVideo, mobileSrc: renovaTuCamaMobileVideo, alt: "Renova tu cama", durationMs: 5000 },
  { type: "video", src: promoDelMes2, mobileSrc: promoDelMes2Mobile, fallbackSrc: promoDelMesFallback, alt: "Promo del mes 2", durationMs: AUTOPLAY_MS },
  { type: "video", src: armaTuPaquete2, mobileSrc: armaTuPaquete2Mobile, alt: "Arma tu paquete 2", durationMs: 8000 },
];

function HeroCarousel({ isAdmin, mabelToken }) {
  const [dbSlides, setDbSlides] = useState(null); // null = loading
  const [activeIndex, setActiveIndex] = useState(0);
  const [pauseUntil, setPauseUntil] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const resumeTimeoutRef = useRef(null);
  const slideRefs = useRef([]);
  const fileInputRef = useRef(null);

  const isPaused = pauseUntil > Date.now();

  // Load slides from API
  const loadSlides = useCallback(() => {
    fetchHeroSlides()
      .then((data) => setDbSlides(data))
      .catch(() => setDbSlides([]));
  }, []);

  useEffect(() => {
    loadSlides();
  }, [loadSlides]);

  // Determine which slides to show
  const slides = React.useMemo(() => {
    if (dbSlides === null) return STATIC_SLIDES; // loading, show static
    if (dbSlides.length === 0) return STATIC_SLIDES; // empty DB, show static
    return dbSlides.map((s) => ({
      id: s.id,
      type: s.type || "video",
      src: s.url,
      mobileSrc: s.mobileSrc || null,
      alt: `Hero slide`,
      durationMs: s.durationMs || AUTOPLAY_MS,
    }));
  }, [dbSlides]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 920);
    handleResize();
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
      const videos = slideDiv.querySelectorAll("video");
      if (index === activeIndex) {
        videos.forEach((v) => {
          v.currentTime = 0;
          const playPromise = v.play();
          if (playPromise?.catch) playPromise.catch(() => { });
        });
      } else {
        videos.forEach((v) => {
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

  /* ── Admin handlers ── */
  const handleAddSlide = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !mabelToken) return;
    setUploading(true);
    try {
      await uploadHeroSlide(file, mabelToken);
      loadSlides();
    } catch (err) {
      alert("Error al subir: " + (err.message || err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteSlide = async () => {
    const current = slides[activeIndex];
    if (!current?.id || !mabelToken) return;
    if (!window.confirm("¿Eliminar este slide del carrusel?")) return;
    try {
      await deleteHeroSlide(current.id, mabelToken);
      setActiveIndex(0);
      loadSlides();
    } catch (err) {
      alert("Error al eliminar: " + (err.message || err));
    }
  };

  const isDbSlide = Boolean(slides[activeIndex]?.id);

  return (
    <section className="hero-carousel" aria-label="Promociones">
      <div className="hero-carousel-track">
        {slides.map((slide, index) => {
          const actualVideoSrc =
            isMobile && slide.mobileSrc ? slide.mobileSrc : slide.src;

          return (
            <div
              key={slide.id || `${slide.type}-${slide.src}`}
              className={`hero-carousel-slide ${activeIndex === index ? "active" : ""}`}
              aria-hidden={activeIndex !== index}
              ref={(el) => {
                slideRefs.current[index] = el;
              }}
            >
              {slide.type === "video" ? (
                <video
                  key={isMobile ? "mobile" : "desktop"}
                  className="hero-carousel-media"
                  src={actualVideoSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  onError={(event) => {
                    if (isMobile) return;
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

      {/* ── Admin Controls ── */}
      {isAdmin && (
        <div className="hero-admin-controls">
          <button
            type="button"
            className="hero-admin-btn hero-admin-add"
            onClick={handleAddSlide}
            disabled={uploading}
            title="Agregar imagen o video"
          >
            {uploading ? (
              <svg className="hero-admin-spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="50" strokeLinecap="round" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            )}
          </button>
          {isDbSlide && (
            <button
              type="button"
              className="hero-admin-btn hero-admin-delete"
              onClick={handleDeleteSlide}
              title="Eliminar este slide"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,video/*"
            style={{ display: "none" }}
            onChange={handleFileSelected}
          />
        </div>
      )}

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
