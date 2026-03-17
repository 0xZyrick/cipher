// ═══════════════════════════════════════════════════════════
//  CIPHER — Voice Over Manager v2
//  Supports volume control via SoundMenu
// ═══════════════════════════════════════════════════════════

const VOICE_LINES: Record<string, string[]> = {
  battleCommencing: ["/assets/audio/vo-battle-commencing.mp3"],
  deployMen:        ["/assets/audio/vo-deploy-your-men.mp3"],
  yourTurn: [
    "/assets/audio/vo-your-move.mp3",
    "/assets/audio/vo-make-your-move.mp3",
    "/assets/audio/vo-commander.mp3",
  ],
  waitingOpponent:  ["/assets/audio/vo-waiting.mp3"],
  victory:          ["/assets/audio/vo-victory.mp3"],
  defeat:           ["/assets/audio/vo-defeat.mp3"],
  pieceDeployed:    ["/assets/audio/vo-unit-deployed.mp3"],
  allDeployed:      ["/assets/audio/vo-forces-ready.mp3"],
};

export type VoiceEvent = keyof typeof VOICE_LINES;

class VoiceOverManager {
  private muted: boolean = false;
  private volume: number = 1.0;
  private current: HTMLAudioElement | null = null;
  private lastEvent: string = "";
  private lastEventTime: number = 0;
  // One-shot events that must never fire more than once per session
  private readonly ONE_SHOT = new Set(["battleCommencing", "victory", "defeat"]);
  private fired = new Set<string>();

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted && this.current) {
      this.current.pause();
      this.current.currentTime = 0;
    }
  }
  isMuted() { return this.muted; }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.current) this.current.volume = this.volume;
  }

  // Reset one-shot guards — call when returning to lobby
  resetSession() {
    this.fired.clear();
  }

  play(event: VoiceEvent, options?: { force?: boolean; delay?: number }) {
    if (this.muted) return;
    // Hard block duplicate one-shot events
    if (this.ONE_SHOT.has(event) && this.fired.has(event) && !options?.force) return;
    const now = Date.now();
    if (!options?.force && event === this.lastEvent && now - this.lastEventTime < 4000) return;
    const lines = VOICE_LINES[event];
    if (!lines || lines.length === 0) return;
    const line = lines[Math.floor(Math.random() * lines.length)];
    const trigger = () => {
      if (this.current && !this.current.ended && !options?.force) return;
      if (this.current) { this.current.pause(); this.current.currentTime = 0; }
      const audio = new Audio(line);
      audio.volume = this.volume;
      audio.play().catch(() => {});
      this.current = audio;
      this.lastEvent = event;
      this.lastEventTime = Date.now();
      if (this.ONE_SHOT.has(event)) this.fired.add(event);
    };
    if (options?.delay) setTimeout(trigger, options.delay);
    else trigger();
  }

  stop() {
    if (this.current) {
      this.current.pause();
      this.current.currentTime = 0;
      this.current = null;
    }
  }
}

export const voiceOver = new VoiceOverManager();