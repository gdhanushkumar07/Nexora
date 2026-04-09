"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

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
  const scrollProgressFillRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef<HTMLDivElement>(null);
  const loadingBarRef = useRef<HTMLDivElement>(null);
  const loadingTextRef = useRef<HTMLSpanElement>(null);

  // ─── Native Data Array (Stacking Narrative) ────────────────────────────────
  const NARRATIVE = [
    {
      prefix: "01",
      title: "Trust Graph",
      bg: "#E3D5FF",
      items: [
        "Real-time relationship mapping",
        "Network topological correlation",
        "Identity graph clustering",
      ]
    },
    {
      prefix: "02",
      title: "Detection",
      bg: "#FFFDCF",
      items: [
        "Zero-Latency processing edge",
        "Sub-12ms anomaly routing",
        "Distributed threat intelligence",
      ]
    },
    {
      prefix: "03",
      title: "Risk Engine",
      bg: "#F4F4F5",
      items: [
        "Explainable confidence bands",
        "Forward-looking predictive modeling",
        "Actionable resolution paths",
      ]
    }
  ];

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

  // ─── GSAP Stacking Engine ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined") {
      gsap.registerPlugin(ScrollTrigger);

      // Timeout ensures DOM is fully painted after load before calculating offsets
      const ctx = gsap.context(() => {
        const stackCards = gsap.utils.toArray<HTMLElement>(".stack-card");

        stackCards.forEach((card, index) => {
          const isLastCard = index === stackCards.length - 1;

          // 1. Pin the card
          ScrollTrigger.create({
            trigger: card,
            start: "top top",
            pin: true,
            pinSpacing: false,
            id: `stack-${index}`,
          });

          // 2. Parallax fade down when next card covers it
          if (!isLastCard) {
            gsap.to(card, {
              yPercent: -20,
              ease: "none",
              scrollTrigger: {
                trigger: card,
                start: "top top",
                endTrigger: stackCards[index + 1],
                end: "top top",
                scrub: true,
              },
            });
          }
        });
        
        ScrollTrigger.refresh();
      });

      return () => ctx.revert(); // Cleanup GSAP hooks
    }
  }, [isLoaded]);

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
              <a href="#features">Features</a>
            </li>
            <li>
              <a href="#howitworks">How it works</a>
            </li>
            <li>
              <a href="#techstack">Tech stack</a>
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

      {/* ── Stacking Narrative Section ───────────────────────────────────── */}
      <section className="stack-container">
        {NARRATIVE.map((card, i) => (
          <div
            key={i}
            className="stack-card"
            style={{ backgroundColor: card.bg, zIndex: i + 10 }}
          >
            <div className="stack-inner">
              <div className="stack-left">
                <span className="stack-index">{card.prefix}</span>
                <h2 className="stack-title">{card.title}</h2>
              </div>
              <div className="stack-right">
                <ul className="stack-list">
                  {card.items.map((item, idx) => (
                    <li key={idx}>— {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ── Final Reveal CTA ──────────────────────────────────────────────── */}
      <section className="final-reveal">
        <h1>Join teams building faster with Nexora.</h1>
        <button className="navbar-cta" style={{ marginTop: '32px', padding: '16px 32px', fontSize: '1rem' }}>Get Started Today</button>
      </section>
    </>
  );
}
