// ═══════════════════════════════════════════════════════════
//  CIPHER — Loading Screen
//  Shows while the game assets and graphics load.
//  Fades out when ready.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from "react";

interface Props {
  onReady: () => void;
}

const MESSAGES = [
  "Assembling your forces...",
  "Unrolling the war map...",
  "Lighting the command candles...",
  "Sharpening the cipher keys...",
  "The enemy stirs in the shadows...",
  "Preparing the battlefield...",
];

// Assets to preload — add all critical images here
const ASSETS_TO_PRELOAD = [
  "/assets/backgrounds/bg-menu.webp",
  "/assets/backgrounds/bg-board.webp",
  "/assets/ui/cipher-plaque.webp",
  "/assets/ui/btn-wood.webp",
  "/assets/ui/panel-wood.webp",
  "/assets/board/board-frame.webp",
  "/assets/board/board-surface.webp",
  "/assets/icons/medallion-base.webp",
  "/assets/icons/diamond-indicator.webp",
  "/assets/overlays/victory.webp",
  "/assets/overlays/defeat.webp",
  "/assets/pieces/piece-hidden.webp",
  "/assets/pieces/flag.webp",
  "/assets/pieces/bomb.webp",
  // Rank pieces
  ...Array.from({ length: 10 }, (_, i) => `/assets/pieces/rank-${i + 1}.png`),
];

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // Don't fail if asset missing
    img.src = src;
  });
}

export function LoadingScreen({ onReady }: Props) {
  const [progress, setProgress] = useState(0);
  const [message] = useState(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const total = ASSETS_TO_PRELOAD.length;
    let loaded = 0;

    // Minimum display time — 2.5s for atmosphere
    const minTime = new Promise<void>(resolve => setTimeout(resolve, 2500));

    const assetLoads = ASSETS_TO_PRELOAD.map(src =>
      preloadImage(src).then(() => {
        if (!cancelled) {
          loaded++;
          setProgress(Math.round((loaded / total) * 100));
        }
      })
    );

    Promise.all([Promise.all(assetLoads), minTime]).then(() => {
      if (!cancelled) {
        setProgress(100);
        setTimeout(() => {
          if (!cancelled) {
            setFadeOut(true);
            setTimeout(() => { if (!cancelled) onReady(); }, 600);
          }
        }, 400);
      }
    });

    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      backgroundImage: "url('/assets/backgrounds/bg-menu.webp')",
      backgroundSize: "cover", backgroundPosition: "center",
      opacity: fadeOut ? 0 : 1,
      transition: "opacity 0.6s ease",
    }}>
      {/* Dark overlay */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }}/>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>

        {/* CIPHER plaque */}
        <div style={{
          width: "min(480px, 72vw)",
          aspectRatio: "16 / 5",
          backgroundImage: "url('/assets/ui/cipher-plaque.webp')",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          filter: "drop-shadow(0 4px 24px rgba(0,0,0,0.8))",
          animation: "plaque-flicker 5s ease-in-out infinite",
        }}/>

        {/* Progress bar */}
        <div style={{
          width: "min(320px, 60vw)",
          height: 6,
          background: "rgba(201,168,76,0.1)",
          border: "1px solid var(--gold-dim)",
          borderRadius: 3,
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${progress}%`,
            background: "linear-gradient(90deg, var(--gold-dim), var(--amber), var(--gold-light))",
            borderRadius: 3,
            transition: "width 0.2s ease",
          }}/>
        </div>

        {/* Flavour text */}
        <p style={{
          fontFamily: "'IM Fell English', serif",
          fontStyle: "italic",
          fontSize: 14,
          color: "var(--text-dim)",
          letterSpacing: "0.08em",
        }}>
          {message}
        </p>

        {/* Dot loader */}
        <div className="dot-loader">
          <span/><span/><span/>
        </div>
      </div>
    </div>
  );
}
