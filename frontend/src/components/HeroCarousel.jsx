import React, { useEffect, useRef, useState, useCallback } from "react";
import { fetchHeroSlides, uploadHeroSlide, deleteHeroSlide } from "../api";
import "../styles/HeroCarousel.css";

const AUTOPLAY_MS = 6000;
const INTERACTION_PAUSE_MS = 8000;
const MAX_SLIDES = 10;

function HeroCarousel({ isAdmin, mabelToken }) {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pauseUntil, setPauseUntil] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const resumeTimeoutRef = useRef(null);
  const slideRefs = useRef([]);
  const fileInputRef = useRef(null);

  const isPaused = pauseUntil > Date.now();

  /* ── Load slides from API ── */
  const loadSlides = useCallback(() => {
    fetchHeroSlides()
      .then((data) => {
        setSlides(data);
        setLoading(false);
      })
      .catch(() => {
        setSlides([]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadSlides();
  }, [loadSlides]);

  /* ── Responsive ── */
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 920);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* ── Autoplay ── */
  useEffect(() => {
    if (isPaused || slides.length === 0) return undefined;
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

  /* ── Play/pause videos on slide change ── */
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

  /* ── Navigation ── */
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

  /* ── Admin: add slide ── */
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
      setActiveIndex(0); // go to the new slide (it's first)
    } catch (err) {
      alert("Error al subir: " + (err.message || err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* ── Admin: delete current slide ── */
  const handleDeleteSlide = async () => {
    const current = slides[activeIndex];
    if (!current?.id || !mabelToken) return;
    if (!window.confirm("¿Eliminar este flyer del carrusel?")) return;
    try {
      await deleteHeroSlide(current.id, mabelToken);
      setActiveIndex((prev) => Math.max(0, prev - 1));
      loadSlides();
    } catch (err) {
      alert("Error al eliminar: " + (err.message || err));
    }
  };

  /* ── Render ── */
  if (loading || slides.length === 0) {
    return (
      <section className="hero-carousel" aria-label="Promociones">
        <div className="hero-carousel-track" />
      </section>
    );
  }

  return (
    <section className="hero-carousel" aria-label="Promociones">
      <div className="hero-carousel-track">
        {slides.map((slide, index) => {
          const videoSrc =
            isMobile && slide.mobileSrc ? slide.mobileSrc : slide.url;

          return (
            <div
              key={slide.id}
              className={`hero-carousel-slide ${activeIndex === index ? "active" : ""}`}
              aria-hidden={activeIndex !== index}
              ref={(el) => {
                slideRefs.current[index] = el;
              }}
            >
              {(slide.type === "video") ? (
                <video
                  key={isMobile ? "mobile" : "desktop"}
                  className="hero-carousel-media"
                  src={videoSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img
                  className="hero-carousel-media"
                  src={slide.url}
                  alt="Hero slide"
                  loading="lazy"
                />
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
          {slides.length < MAX_SLIDES && (
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
          )}
          <button
            type="button"
            className="hero-admin-btn hero-admin-delete"
            onClick={handleDeleteSlide}
            title="Eliminar este flyer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
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
