"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const TOTAL_FRAMES = 152;
// Total scroll height for the cinematic sequence (in vh units)
const SCROLL_HEIGHT_VH = 700;

/** Zero-pad a number to 3 digits */
const padFrame = (n: number): string => String(n).padStart(3, "0");

/** Generate the public path for a given 1-indexed frame */
const framePath = (n: number): string =>
  `/sequence/ezgif-frame-${padFrame(n)}.jpg`;

export default function CinematicHero() {
  // ─── DOM Refs ───────────────────────────────────────────────────────────────
  const scrollTrackRef = useRef<HTMLDivElement>(null); // tall div = scroll distance
  const canvasWrapperRef = useRef<HTMLDivElement>(null); // dolly zoom target
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const navbarRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const scrollProgressFillRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef<HTMLDivElement>(null);
  const loadingBarRef = useRef<HTMLDivElement>(null);
  const loadingTextRef = useRef<HTMLSpanElement>(null);

  // ─── State & Internal Refs ─────────────────────────────────────────────────
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const loadedCountRef = useRef(0);
  const currentFrameRef = useRef(-1);
  const rafRef = useRef<number | null>(null);
  const lastScrollYRef = useRef(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // ─── Canvas Draw (Retina + Cover) ──────────────────────────────────────────
  const drawFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = imagesRef.current[index];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const cW = canvas.width;
    const cH = canvas.height;

    // Object-Fit: Cover math
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = cW / cH;
    let sx = 0,
      sy = 0,
      sw = img.naturalWidth,
      sh = img.naturalHeight;

    if (imgAspect > canvasAspect) {
      sw = img.naturalHeight * canvasAspect;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = img.naturalWidth / canvasAspect;
      sy = (img.naturalHeight - sh) / 2;
    }

    ctx.clearRect(0, 0, cW, cH);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cW, cH);
  }, []);

  // ─── Resize canvas to full DPR-aware dimensions ────────────────────────────
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.imageSmoothingEnabled = true;
    if (currentFrameRef.current >= 0) drawFrame(currentFrameRef.current);
  }, [drawFrame]);

  // ─── Compute scroll progress (0→1) based on scroll track position ──────────
  const getScrollProgress = useCallback((): number => {
    const track = scrollTrackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    // rect.top goes from 0 (track starts at top of viewport) to -trackHeight (track scrolled past)
    const trackHeight = track.offsetHeight - window.innerHeight;
    if (trackHeight <= 0) return 0;
    const scrolled = -rect.top; // positive as we scroll down
    return Math.min(Math.max(scrolled / trackHeight, 0), 1);
  }, []);

  // ─── RAF scroll tick: frame scrubbing + overlay tweening ──────────────────
  const onScrollTick = useCallback(() => {
    rafRef.current = null;
    const progress = getScrollProgress();

    // Frame scrubbing
    const targetFrame = Math.min(
      Math.floor(progress * (TOTAL_FRAMES - 1)),
      TOTAL_FRAMES - 1,
    );
    if (targetFrame !== currentFrameRef.current) {
      currentFrameRef.current = targetFrame;
      drawFrame(targetFrame);
    }

    // Scroll progress indicator
    const fill = scrollProgressFillRef.current;
    if (fill) fill.style.height = `${progress * 100}%`;

    const progressEl = scrollProgressRef.current;
    if (progressEl) {
      progressEl.style.opacity = String(Math.max(0, 1 - progress / 0.12));
    }

    // ── Navbar fade: 0→10% ──────────────────────────────────────────────────
    const navbar = navbarRef.current;
    if (navbar) {
      const navOpacity = Math.max(0, 1 - progress / 0.1);
      navbar.style.opacity = String(navOpacity);
    }

    // ── Header depth fade + 3D recede: 0→25% ───────────────────────────────
    const header = headerRef.current;
    if (header) {
      const t = Math.min(progress / 0.25, 1);
      // ease-in curve
      const eased = t * t;
      const opacity = 1 - eased;
      const z = -280 * eased;
      header.style.opacity = String(opacity);
      header.style.transform = `translateZ(${z}px) scale(${1 - 0.08 * eased})`;
    }

    // ── Dolly zoom: canvas wrapper scale 1.12→1.0 from 0→90% ───────────────
    const wrapper = canvasWrapperRef.current;
    if (wrapper) {
      const t = Math.min(progress / 0.9, 1);
      const scale = 1.12 - 0.12 * t;
      wrapper.style.transform = `scale(${scale})`;
    }

    // ── Trust Cards reveal: 60→85%, fade out 90→100% ────────────────────────
    const cards = cardsRef.current;
    if (cards) {
      if (progress < 0.6) {
        cards.style.opacity = "0";
        cards.style.pointerEvents = "none";
        // reset card positions
        cards.querySelectorAll<HTMLElement>(".trust-card").forEach((c) => {
          c.style.transform = "translateY(60px)";
          c.style.opacity = "0";
        });
      } else if (progress <= 0.9) {
        const t = (progress - 0.6) / 0.25;
        const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic
        cards.style.opacity = "1";
        cards.style.pointerEvents = "auto";
        cards.querySelectorAll<HTMLElement>(".trust-card").forEach((c, i) => {
          const delay = i * 0.12;
          const cardT = Math.min(Math.max((t - delay) / (1 - delay), 0), 1);
          const cardEased = 1 - Math.pow(1 - cardT, 3);
          c.style.transform = `translateY(${60 * (1 - cardEased)}px)`;
          c.style.opacity = String(cardEased);
        });
      } else {
        // Fade out 90→100%
        const t = (progress - 0.9) / 0.1;
        cards.style.opacity = String(1 - t);
      }
    }
  }, [drawFrame, getScrollProgress]);

  // ─── Scroll listener (schedules RAF) ──────────────────────────────────────
  const onScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(onScrollTick);
  }, [onScrollTick]);

  // ─── Init: start animation engine after images loaded ─────────────────────
  const initAnimation = useCallback(() => {
    // Draw first frame
    currentFrameRef.current = 0;
    drawFrame(0);
    // Run first tick to set initial overlay states
    onScrollTick();
    // Start listening
    window.addEventListener("scroll", onScroll, { passive: true });
  }, [drawFrame, onScrollTick, onScroll]);

  // ─── Image Preloading ──────────────────────────────────────────────────────
  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const images: HTMLImageElement[] = new Array(TOTAL_FRAMES);
    imagesRef.current = images;

    const onImageLoad = () => {
      loadedCountRef.current += 1;
      const pct = Math.round((loadedCountRef.current / TOTAL_FRAMES) * 100);
      if (loadingBarRef.current) loadingBarRef.current.style.width = `${pct}%`;
      if (loadingTextRef.current)
        loadingTextRef.current.textContent = `${pct}%`;

      if (loadedCountRef.current === TOTAL_FRAMES) {
        setTimeout(() => {
          setIsLoaded(true);
          initAnimation();
        }, 400);
      }
    };

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = framePath(i + 1);
      img.onload = onImageLoad;
      img.onerror = onImageLoad;
      images[i] = img;
    }

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [resizeCanvas, initAnimation, onScroll]);

  return (
    <>
      {/* ── Loading Screen ──────────────────────────────────────────────── */}
      <div className={`loading-screen${isLoaded ? " hidden" : ""}`}>
        <div className="loading-logo">NEXORA</div>
        <div className="loading-bar-track">
          <div ref={loadingBarRef} className="loading-bar-fill" />
        </div>
        <div className="loading-text">
          Loading experience &nbsp;·&nbsp; <span ref={loadingTextRef}>0%</span>
        </div>
      </div>

      {/* ── Fixed Canvas + Overlays (always in viewport) ────────────────── */}
      <div className="hero-fixed-layer">
        {/* Canvas wrapper for dolly zoom */}
        <div
          ref={canvasWrapperRef}
          className="canvas-wrapper"
          style={{ transform: "scale(1.12)", transformOrigin: "center center" }}
        >
          <canvas ref={canvasRef} id="heroCanvas" />
        </div>

        {/* Navbar */}
        <nav ref={navbarRef} className="navbar">
          <div className="navbar-logo">NEXORA</div>
          <ul className="navbar-links">
            <li>
              <a href="#platform">Platform</a>
            </li>
            <li>
              <a href="#trust">Trust Engine</a>
            </li>
            <li>
              <a href="#docs">Docs</a>
            </li>
            <li>
              <a href="#get-started" className="navbar-cta">
                Get Started
              </a>
            </li>
          </ul>
        </nav>

        {/* Hero Header Text */}
        <div
          ref={headerRef}
          className="hero-header header"
          style={{ perspective: "1000px", transformStyle: "preserve-3d" }}
        >
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            Autonomous Trust Engine
          </div>
          <h1 className="hero-title">
            The AI That
            <br />
            Knows Who
            <br />
            To Trust
          </h1>
          <p className="hero-subtitle">
            Nexora continuously maps the trust graph of your organisation —
            surfacing risk before it surfaces you.
          </p>
        </div>

        {/* Trust Cards */}
        <div
          ref={cardsRef}
          className="trust-cards-container"
          style={{ opacity: 0 }}
        >
          <div
            className="trust-card"
            style={{ transform: "translateY(60px)", opacity: 0 }}
          >
            <div className="trust-card-icon purple">🛡️</div>
            <div className="trust-card-title">Trust Graph</div>
            <div className="trust-card-desc">
              Real-time relationship mapping across every node in your network.
            </div>
            <div className="trust-card-metric">99.8%</div>
          </div>
          <div
            className="trust-card"
            style={{ transform: "translateY(60px)", opacity: 0 }}
          >
            <div className="trust-card-icon blue">⚡</div>
            <div className="trust-card-title">Zero-Latency Detection</div>
            <div className="trust-card-desc">
              Anomaly signals processed in under 12ms via edge inference.
            </div>
            <div className="trust-card-metric">&lt;12ms</div>
          </div>
          <div
            className="trust-card"
            style={{ transform: "translateY(60px)", opacity: 0 }}
          >
            <div className="trust-card-icon pink">🔮</div>
            <div className="trust-card-title">Predictive Risk Score</div>
            <div className="trust-card-desc">
              Forward-looking threat scoring with explainable confidence bands.
            </div>
            <div className="trust-card-metric">4.2× safer</div>
          </div>
        </div>

        {/* Scroll Progress Indicator */}
        <div ref={scrollProgressRef} className="scroll-progress">
          <div className="scroll-progress-line">
            <div ref={scrollProgressFillRef} className="scroll-progress-fill" />
          </div>
          <span className="scroll-progress-text">Scroll</span>
        </div>
      </div>

      {/* ── Tall Scroll Track (creates the scroll distance) ─────────────── */}
      <div
        ref={scrollTrackRef}
        className="scroll-track"
        style={{ height: `${SCROLL_HEIGHT_VH}vh` }}
        aria-hidden="true"
      />

      {/* ── After-Hero content ───────────────────────────────────────────── */}
      <section className="after-hero" id="platform">
        <p
          style={{
            color: "rgba(255,255,255,0.3)",
            fontSize: "0.875rem",
            textAlign: "center",
          }}
        >
          ↓ &nbsp;Content continues below the cinematic sequence
        </p>
      </section>
    </>
  );
}
