// ═══════════════════════════════════════════════════════════
//  CIPHER — Audio Manager v3
//  - Starts unmuted, music plays at 40% volume as background
//  - Auto-plays music on first user interaction (browser policy)
//  - SFX and voice unaffected by music fade
// ═══════════════════════════════════════════════════════════

type SFXName =
  | "click" | "move" | "attack" | "deploy"
  | "victory" | "defeat" | "error" | "bomb";

class AudioManager {
  private bgMusic: HTMLAudioElement | null = null;
  private muted: boolean = false;          // starts unmuted
  private sfxMuted: boolean = false;
  private musicVolume: number = 0.40;      // 40% background level
  private sfxVolume: number = 0.65;
  private initialized: boolean = false;
  private sfxCache: Map<SFXName, HTMLAudioElement> = new Map();
  private autoPlayBound = false;

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.bgMusic = new Audio("/assets/audio/bg-war.mp3");
    this.bgMusic.loop = true;
    this.bgMusic.volume = this.musicVolume;
    this.preloadSFX();
    // Auto-play on first user gesture — browsers require interaction
    this.attachAutoPlay();
  }

  private attachAutoPlay() {
    if (this.autoPlayBound) return;
    this.autoPlayBound = true;
    const start = () => {
      if (!this.muted && this.bgMusic && this.bgMusic.paused) {
        this.bgMusic.play().catch(() => {});
      }
      document.removeEventListener("click", start);
      document.removeEventListener("keydown", start);
      document.removeEventListener("touchstart", start);
    };
    document.addEventListener("click", start, { once: true });
    document.addEventListener("keydown", start, { once: true });
    document.addEventListener("touchstart", start, { once: true });
  }

  private preloadSFX() {
    const names: SFXName[] = ["click","move","attack","deploy","victory","defeat","error","bomb"];
    names.forEach(name => {
      const audio = new Audio(`/assets/audio/sfx-${name}.mp3`);
      audio.preload = "auto";
      this.sfxCache.set(name, audio);
    });
  }

  // ── Global mute ─────────────────────────────────────────
  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.bgMusic?.pause();
    } else {
      this.init();
      this.bgMusic?.play().catch(() => {});
    }
  }
  isMuted() { return this.muted; }

  // ── SFX mute — does NOT affect music ────────────────────
  setSfxMuted(muted: boolean) { this.sfxMuted = muted; }

  // ── Volume setters ───────────────────────────────────────
  setMusicVolume(v: number) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.bgMusic) this.bgMusic.volume = this.musicVolume;
  }
  setSfxVolume(v: number) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
  }

  // ── Music ────────────────────────────────────────────────
  playMusic() {
    if (this.muted || !this.bgMusic) return;
    this.bgMusic.play().catch(() => {});
  }
  stopMusic() {
    this.bgMusic?.pause();
    if (this.bgMusic) this.bgMusic.currentTime = 0;
  }
  fadeOutMusic(durationMs = 2000) {
    if (!this.bgMusic) return;
    const start = this.bgMusic.volume;
    const step = start / (durationMs / 50);
    const fade = setInterval(() => {
      if (!this.bgMusic) { clearInterval(fade); return; }
      if (this.bgMusic.volume > step) {
        this.bgMusic.volume = Math.max(0, this.bgMusic.volume - step);
      } else {
        this.bgMusic.volume = 0;
        this.bgMusic.pause();
        clearInterval(fade);
      }
    }, 50);
  }

  // Dim to a low volume but KEEP PLAYING — for battle background tension
  dimMusic(targetVolume = 0.15, durationMs = 1500) {
    if (this.muted || !this.bgMusic) return;
    // Ensure music is actually playing
    if (this.bgMusic.paused) {
      this.bgMusic.play().catch(() => {});
    }
    const target = Math.max(0, Math.min(1, targetVolume));
    const current = this.bgMusic.volume;
    const diff = current - target;
    // If already at or below target, just set it directly
    if (diff <= 0) { this.bgMusic.volume = target; return; }
    const step = diff / (durationMs / 50);
    const fade = setInterval(() => {
      if (!this.bgMusic) { clearInterval(fade); return; }
      const next = this.bgMusic.volume - step;
      if (next <= target) {
        this.bgMusic.volume = target;
        clearInterval(fade);
      } else {
        this.bgMusic.volume = next;
      }
    }, 50);
  }
  fadeInMusic(durationMs = 2000) {
    if (this.muted || !this.bgMusic) return;
    // Start from wherever volume currently is (could be dimmed to 0.15)
    if (this.bgMusic.paused) {
      this.bgMusic.volume = 0;
      this.bgMusic.play().catch(() => {});
    }
    const target = this.musicVolume; // restore to full 40%
    const current = this.bgMusic.volume;
    if (current >= target) return;
    const step = (target - current) / (durationMs / 50);
    const fade = setInterval(() => {
      if (!this.bgMusic) { clearInterval(fade); return; }
      const next = this.bgMusic.volume + step;
      if (next >= target) {
        this.bgMusic.volume = target;
        clearInterval(fade);
      } else {
        this.bgMusic.volume = next;
      }
    }, 50);
  }

  // ── SFX — never blocked by music mute ───────────────────
  playSFX(name: SFXName) {
    if (this.sfxMuted) return;   // only sfxMuted blocks SFX, NOT global muted
    const cached = this.sfxCache.get(name);
    if (cached) {
      const clone = cached.cloneNode() as HTMLAudioElement;
      clone.volume = this.sfxVolume;
      clone.play().catch(() => {});
    } else {
      const audio = new Audio(`/assets/audio/sfx-${name}.mp3`);
      audio.volume = this.sfxVolume;
      audio.play().catch(() => {});
    }
  }
}

export const audioManager = new AudioManager();