// ═══════════════════════════════════════════════════════════
//  CIPHER — Sound Menu
//  On-brand volume control with sliders.
//  Uses audioManager for all state.
// ═══════════════════════════════════════════════════════════

import { useState } from "react";
import { audioManager } from "../utils/audioManager";
import { voiceOver } from "../utils/voiceOver";

interface Props {
  onClose: () => void;
  muted: boolean;
  onMuteChange: (muted: boolean) => void;
}

function IconClose() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

export function SoundMenu({ onClose, muted, onMuteChange }: Props) {
  const [musicVol, setMusicVol] = useState(30);
  const [sfxVol, setSfxVol]   = useState(65);
  const [voVol, setVoVol]     = useState(100);
  const [musicOn, setMusicOn] = useState(!muted);
  const [sfxOn, setSfxOn]     = useState(!muted);
  const [voOn, setVoOn]       = useState(!muted);

  function handleMusicVol(v: number) {
    setMusicVol(v);
    audioManager.setMusicVolume(v / 100);
  }
  function handleSfxVol(v: number) {
    setSfxVol(v);
    audioManager.setSfxVolume(v / 100);
  }
  function handleVoVol(v: number) {
    setVoVol(v);
    voiceOver.setVolume(v / 100);
  }
  function handleMusicToggle() {
    const next = !musicOn;
    setMusicOn(next);
    if (next) {
      audioManager.setMuted(false);
      audioManager.playMusic();
      onMuteChange(false);
    } else {
      audioManager.stopMusic();
    }
  }
  function handleSfxToggle() {
    const next = !sfxOn;
    setSfxOn(next);
    audioManager.setSfxMuted(!next);
  }
  function handleVoToggle() {
    const next = !voOn;
    setVoOn(next);
    voiceOver.setMuted(!next);
  }

  function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
      <div
        className={`sound-menu-toggle-track${on ? " on" : ""}`}
        onClick={onToggle}
      >
        <div className="sound-menu-toggle-thumb" />
      </div>
    );
  }

  return (
    <div className="sound-menu-overlay" onClick={onClose}>
      <div className="sound-menu-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="sound-menu-title" style={{ marginBottom: 0, paddingBottom: 0, border: "none" }}>
            SOUND SETTINGS
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 4 }}
          >
            <IconClose />
          </button>
        </div>
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, var(--gold-dim), transparent)", margin: "12px 0 20px" }} />

        {/* Music */}
        <div style={{ marginBottom: 20 }}>
          <div className="sound-menu-row" style={{ marginBottom: 10 }}>
            <span className="sound-menu-label">Music</span>
            <div style={{ flex: 1 }} />
            <Toggle on={musicOn} onToggle={handleMusicToggle} />
          </div>
          <div className="sound-menu-row">
            <span className="sound-menu-label" style={{ fontSize: 8, opacity: 0.6 }}>Volume</span>
            <input
              type="range" min={0} max={100} step={1}
              value={musicVol}
              onChange={e => handleMusicVol(Number(e.target.value))}
              className="sound-menu-slider"
              disabled={!musicOn}
              style={{ opacity: musicOn ? 1 : 0.4 }}
            />
            <span className="sound-menu-value">{musicVol}%</span>
          </div>
        </div>

        {/* SFX */}
        <div style={{ marginBottom: 20 }}>
          <div className="sound-menu-row" style={{ marginBottom: 10 }}>
            <span className="sound-menu-label">Effects</span>
            <div style={{ flex: 1 }} />
            <Toggle on={sfxOn} onToggle={handleSfxToggle} />
          </div>
          <div className="sound-menu-row">
            <span className="sound-menu-label" style={{ fontSize: 8, opacity: 0.6 }}>Volume</span>
            <input
              type="range" min={0} max={100} step={1}
              value={sfxVol}
              onChange={e => handleSfxVol(Number(e.target.value))}
              className="sound-menu-slider"
              disabled={!sfxOn}
              style={{ opacity: sfxOn ? 1 : 0.4 }}
            />
            <span className="sound-menu-value">{sfxVol}%</span>
          </div>
        </div>

        {/* Voice Over */}
        <div style={{ marginBottom: 24 }}>
          <div className="sound-menu-row" style={{ marginBottom: 10 }}>
            <span className="sound-menu-label">Voice</span>
            <div style={{ flex: 1 }} />
            <Toggle on={voOn} onToggle={handleVoToggle} />
          </div>
          <div className="sound-menu-row">
            <span className="sound-menu-label" style={{ fontSize: 8, opacity: 0.6 }}>Volume</span>
            <input
              type="range" min={0} max={100} step={1}
              value={voVol}
              onChange={e => handleVoVol(Number(e.target.value))}
              className="sound-menu-slider"
              disabled={!voOn}
              style={{ opacity: voOn ? 1 : 0.4 }}
            />
            <span className="sound-menu-value">{voVol}%</span>
          </div>
        </div>

        {/* Close button */}
        <button
          className="btn btn-primary"
          onClick={onClose}
          style={{ width: "100%", justifyContent: "center", fontSize: 11 }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
