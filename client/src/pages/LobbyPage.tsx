import { useState, useEffect } from "react";
import { PLAYER1, PLAYER2, getActivePlayer, setActivePlayer } from "../player";
import { useActions } from "../hooks/useActions";
import { useCartridgeAccount } from "../hooks/useCartridgeAccount";
import { fetchPlayerGame } from "../hooks/useGameState";

interface Props { onGame: (gameId: string, playerAddress: string) => void; }

// ── Inline SVG Icons (no deps) ────────────────────────────
function IconExit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
function IconVolume({ muted }: { muted: boolean }) {
  return muted ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    </svg>
  );
}
function IconWallet() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
      <path d="M16 3H8L4 7h16l-4-4z"/>
      <circle cx="17" cy="13" r="1" fill="currentColor"/>
    </svg>
  );
}
function IconDisconnect() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 17l-4-4 4-4"/><path d="M15 7l4 4-4 4"/>
      <line x1="5" y1="13" x2="9" y2="13" strokeDasharray="2 2"/>
      <line x1="15" y1="11" x2="19" y2="11" strokeDasharray="2 2"/>
    </svg>
  );
}
function IconSword() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/>
      <line x1="13" y1="19" x2="19" y2="13"/>
      <line x1="16" y1="16" x2="20" y2="20"/>
      <line x1="19" y1="21" x2="21" y2="19"/>
    </svg>
  );
}
function IconFlag() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="15" x2="4" y2="22"/>
      <path d="M4 15C4 9 18 9 18 4C18 9 4 9 4 15Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor"/>
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" fillOpacity="0.15"/>
    </svg>
  );
}
function IconTrophy() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 22 12 17 16 22"/><line x1="12" y1="17" x2="12" y2="11"/>
      <path d="M17 11V2H7v9a5 5 0 0 0 10 0z"/><path d="M5 6H3v4a4 4 0 0 0 4 4"/><path d="M19 6h2v4a4 4 0 0 1-4 4"/>
    </svg>
  );
}
function IconChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

// ── Skull SVG ─────────────────────────────────────────────
function SkullSVG({ className }: { className?: string }) {
  return (
    <svg className={`skull-svg${className ? ` ${className}` : ''}`} viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" fill="#1a1410">
      {/* Cranium */}
      <ellipse cx="100" cy="88" rx="78" ry="82" />
      {/* Left eye socket */}
      <ellipse cx="68" cy="82" rx="22" ry="24" fill="#080705" />
      {/* Right eye socket */}
      <ellipse cx="132" cy="82" rx="22" ry="24" fill="#080705" />
      {/* Nose */}
      <path d="M90 106 Q100 118 110 106 Q105 122 100 128 Q95 122 90 106Z" fill="#080705" />
      {/* Cheekbones */}
      <ellipse cx="100" cy="148" rx="62" ry="28" />
      {/* Jaw */}
      <rect x="42" y="148" width="116" height="38" rx="8" />
      {/* Teeth gaps */}
      <rect x="56" y="148" width="14" height="32" rx="3" fill="#080705" />
      <rect x="77" y="148" width="14" height="34" rx="3" fill="#080705" />
      <rect x="98" y="148" width="14" height="34" rx="3" fill="#080705" />
      <rect x="119" y="148" width="14" height="32" rx="3" fill="#080705" />
      {/* Suture lines on cranium */}
      <path d="M100 8 Q108 30 100 52 Q92 30 100 8" fill="#080705" opacity="0.5" />
      <path d="M30 60 Q54 68 78 60 Q54 80 30 60" fill="#080705" opacity="0.35" />
      <path d="M170 60 Q146 68 122 60 Q146 80 170 60" fill="#080705" opacity="0.35" />
    </svg>
  );
}

// ── Toast System ──────────────────────────────────────────
interface ToastItem { id: number; text: string; dying: boolean; }

let _toastId = 0;

// ── Shield Background ─────────────────────────────────────
function ShieldBg() {
  return (
    <svg className="shield-bg-svg" viewBox="0 0 400 460" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
      style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%, -52%)", width: "min(520px, 80vw)", opacity: 0.045, pointerEvents: "none", zIndex: 0 }}>
      <path d="M200 20 L380 80 L380 220 C380 330 300 410 200 440 C100 410 20 330 20 220 L20 80 Z"
        fill="#c8902a" stroke="#c8902a" strokeWidth="2"/>
      <path d="M200 55 L345 105 L345 220 C345 308 278 378 200 405 C122 378 55 308 55 220 L55 105 Z"
        fill="none" stroke="#c8902a" strokeWidth="1.5" opacity="0.6"/>
      <line x1="200" y1="55" x2="200" y2="405" stroke="#c8902a" strokeWidth="1" opacity="0.4"/>
      <line x1="55" y1="160" x2="345" y2="160" stroke="#c8902a" strokeWidth="1" opacity="0.4"/>
    </svg>
  );
}

export function LobbyPage({ onGame }: Props) {
  const { session, connect, disconnect, connecting, error: cartridgeError } = useCartridgeAccount();
  const [activePlayer, setActive] = useState(getActivePlayer());
  const actions = useActions(session?.account);
  const [joinId, setJoinId] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showJoin, setShowJoin] = useState(false);

  const displayAddress = session?.address || activePlayer;
  const isCartridge = !!session?.isConnected;
  const isP1 = activePlayer.toLowerCase() === PLAYER1.toLowerCase();

  // Animate loading bar 0→100 over 1.2s then reveal
  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const duration = 1100;
    function tick(now: number) {
      const elapsed = now - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setLoadProgress(pct);
      if (pct < 100) frame = requestAnimationFrame(tick);
      else setTimeout(() => setReady(true), 80);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  function addToast(text: string) {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, text, dying: false }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, dying: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 400);
    }, 3000);
  }

  function switchPlayer(addr: string) {
    setActivePlayer(addr);
    setActive(addr);
    window.location.reload();
  }

  function handleExit() {
    addToast("⚔ No active campaign to exit");
  }

  async function handleCreate() {
    if (!displayAddress) { addToast("⚔ Connect wallet to create a game"); return; }
    setLoading("create"); setError(null);
    try {
      const gameId = await actions.createGame();
      if (gameId) onGame(gameId, displayAddress);
      else setError("Failed to create game.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error creating game");
    } finally { setLoading(null); }
  }

  async function handleJoin() {
    if (!joinId.trim()) { addToast("⚔ Enter a Game ID to join"); return; }
    if (!displayAddress) { addToast("⚔ Connect wallet to join a game"); return; }
    setLoading("join"); setError(null);
    const raw = joinId.trim();
    const normalized = raw.startsWith("0x") ? raw : "0x" + parseInt(raw).toString(16);
    try {
      await actions.joinGame(normalized);
      onGame(normalized, displayAddress);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error joining game");
    } finally { setLoading(null); }
  }

  async function handleResume() {
    if (!displayAddress) { addToast("⚔ Connect wallet to resume a game"); return; }
    setLoading("resume"); setError(null);
    try {
      const gid = await fetchPlayerGame(displayAddress);
      if (gid) onGame(gid, displayAddress);
      else { addToast("⚔ No active campaign found"); setError("No active game found."); }
    } catch { setError("Error looking up game"); }
    finally { setLoading(null); }
  }

  const shortAddr = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  return (
    <>
      {/* Shield background */}
      <ShieldBg />

      {/* Skull background */}
      <div className="skull-bg" aria-hidden="true">
        <SkullSVG />
      </div>

      {/* Fog layers */}
      <div className="fog" aria-hidden="true">
        <div className="fog-layer fog-layer-1" />
        <div className="fog-layer fog-layer-2" />
        <div className="fog-layer fog-layer-3" />
      </div>

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast${t.dying ? " toast-out" : ""}`}>{t.text}</div>
        ))}
      </div>

      {/* Top bar */}
      <div className="lobby-top-bar">
        {/* Left: exit + volume */}
        <div className="lobby-top-left">
          <button className="icon-btn" onClick={handleExit} title="Exit">
            <IconExit />
          </button>
          <button className="icon-btn" onClick={() => setMuted(m => !m)} title={muted ? "Unmute" : "Mute"}>
            <IconVolume muted={muted} />
          </button>
        </div>

        {/* Right: wallet + pts */}
        <div className="lobby-top-right">
          {isCartridge ? (
            <div className="wallet-connected">
              <div className="pts-counter">⚔ 0 pts</div>
              <div className="wallet-addr-pill">
                <div className="wallet-avatar">C</div>
                <span className="wallet-addr-text">{shortAddr(session.address)}</span>
                <button className="wallet-disconnect" onClick={disconnect} title="Disconnect">
                  <IconDisconnect />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Burner selector */}
              <div className="burner-selector">
                <button className={`burner-btn${isP1 ? " active" : ""}`} onClick={() => switchPlayer(PLAYER1)}>P1</button>
                <button className={`burner-btn${!isP1 ? " active" : ""}`} onClick={() => switchPlayer(PLAYER2)}>P2</button>
              </div>
              <button className="wallet-btn" onClick={() => { connect(); }} disabled={connecting}>
                <IconWallet />
                {connecting ? "Connecting..." : "Connect Wallet"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lobby body */}
      <div className="lobby">
        {/* Title */}
        <h1 className="lobby-title">CIPHER</h1>

        {/* Loading bar → fades into buttons */}
        {!ready && (
          <div className="lobby-loader" style={{ position: "relative" }}>
            <div className="lobby-loader-fill" style={{ width: `${loadProgress}%`, transition: "width 0.05s linear" }} />
            <span style={{
              position: "absolute", right: 0, top: "-18px",
              fontFamily: "var(--font-ui)", fontSize: 9, letterSpacing: "0.2em",
              color: "var(--text-dim)",
            }}>{Math.round(loadProgress)}%</span>
          </div>
        )}

        {/* Main cards — appear after load */}
        {ready && (
          <div className="lobby-cards">
            {/* CREATE GAME */}
            <div className="lobby-card" onClick={!loading ? handleCreate : undefined}>
              <div className="lobby-card-btn">
                <div className="lobby-card-icon"><IconSword /></div>
                <span className="lobby-card-label">
                  {loading === "create" ? "Creating Campaign..." : "Create Game"}
                </span>
                <div className="lobby-card-arrow"><IconChevron /></div>
              </div>
            </div>

            {/* JOIN CAMPAIGN */}
            <div className="lobby-card" onClick={() => !showJoin && setShowJoin(true)}>
              <div className="lobby-card-btn">
                <div className="lobby-card-icon"><IconFlag /></div>
                <span className="lobby-card-label">
                  {loading === "join" ? "Joining..." : "Join Campaign"}
                </span>
                <div className="lobby-card-arrow"><IconChevron /></div>
              </div>
              {showJoin && (
                <div className="lobby-join-row" onClick={e => e.stopPropagation()}>
                  <input
                    className="input"
                    placeholder="Game ID (e.g. 0x1)"
                    value={joinId}
                    onChange={e => setJoinId(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleJoin()}
                    autoFocus
                    style={{ marginBottom: 10 }}
                  />
                  <button className="btn btn-primary" onClick={handleJoin} disabled={!!loading} style={{ width: "100%", justifyContent: "center" }}>
                    {loading === "join" ? "Joining..." : "Join"}
                  </button>
                </div>
              )}
            </div>

            {/* RESUME CAMPAIGN */}
            <div className="lobby-card" onClick={!loading ? handleResume : undefined}>
              <div className="lobby-card-btn">
                <div className="lobby-card-icon"><IconShield /></div>
                <span className="lobby-card-label">
                  {loading === "resume" ? "Searching..." : "Resume Campaign"}
                </span>
                <div className="lobby-card-arrow"><IconChevron /></div>
              </div>
            </div>

            {/* Error */}
            {(error || cartridgeError) && (
              <div className="error-msg">{error || cartridgeError}</div>
            )}
          </div>
        )}

        {/* Leaderboard */}
        {ready && (
          <button className="leaderboard-link" onClick={() => addToast("🏆 Leaderboard coming soon")}>
            <IconTrophy />
            Leaderboard
          </button>
        )}
      </div>
    </>
  );
}