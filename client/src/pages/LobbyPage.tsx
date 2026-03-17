import { useState, useEffect, useRef } from "react";
import { PLAYER1, PLAYER2, getActivePlayer, setActivePlayer } from "../player";
import { useActions } from "../hooks/useActions";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { fetchPlayerGame } from "../hooks/useGameState";
import { audioManager } from "../utils/audioManager";
import { voiceOver } from "../utils/voiceOver";
import { SoundMenu } from "./SoundMenu";
import { LeaderboardPage } from "./LeaderboardPage";
import { usePlayerStats } from "../hooks/useGameState";

interface Props {
  onGame: (gameId: string, playerAddress: string) => void;
  account?: import("starknet").AccountInterface | null;
}

// ── Icons ─────────────────────────────────────────────────
function IconVolume({ muted }: { muted: boolean }) {
  return muted ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" fillOpacity="0.6"/>
      <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" fillOpacity="0.6"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
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
function IconTrophy() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 22 12 17 16 22"/><line x1="12" y1="17" x2="12" y2="11"/>
      <path d="M17 11V2H7v9a5 5 0 0 0 10 0z"/><path d="M5 6H3v4a4 4 0 0 0 4 4"/><path d="M19 6h2v4a4 4 0 0 1-4 4"/>
    </svg>
  );
}

// Diamond indicator — for active/hover state on buttons
function DiamondIcon() {
  return <span className="diamond-indicator"><img src="/assets/icons/diamond-indicator.webp" alt="" /></span>;
}

function SkullSVG() {
  return (
    <svg className="skull-svg" viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" fill="#1a1410">
      <ellipse cx="100" cy="88" rx="78" ry="82"/>
      <ellipse cx="68" cy="82" rx="22" ry="24" fill="#080705"/>
      <ellipse cx="132" cy="82" rx="22" ry="24" fill="#080705"/>
      <path d="M90 106 Q100 118 110 106 Q105 122 100 128 Q95 122 90 106Z" fill="#080705"/>
      <ellipse cx="100" cy="148" rx="62" ry="28"/>
      <rect x="42" y="148" width="116" height="38" rx="8"/>
      <rect x="56" y="148" width="14" height="32" rx="3" fill="#080705"/>
      <rect x="77" y="148" width="14" height="34" rx="3" fill="#080705"/>
      <rect x="98" y="148" width="14" height="34" rx="3" fill="#080705"/>
      <rect x="119" y="148" width="14" height="32" rx="3" fill="#080705"/>
    </svg>
  );
}

// Particle system
function useParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    const particles: Array<{ x: number; y: number; size: number; speedX: number; speedY: number; opacity: number; fade: number; }> = [];
    function resize() { if (!canvas) return; canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < 35; i++) {
      particles.push({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, size: Math.random() * 1.8 + 0.4, speedX: (Math.random() - 0.5) * 0.3, speedY: -(Math.random() * 0.4 + 0.1), opacity: Math.random() * 0.5 + 0.1, fade: Math.random() * 0.003 + 0.001 });
    }
    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.speedX; p.y += p.speedY; p.opacity -= p.fade;
        if (p.opacity <= 0 || p.y < -10) { p.x = Math.random() * canvas.width; p.y = canvas.height + 10; p.opacity = Math.random() * 0.4 + 0.1; p.speedY = -(Math.random() * 0.4 + 0.1); p.speedX = (Math.random() - 0.5) * 0.3; }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fillStyle = `rgba(201,168,76,${p.opacity})`; ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, [canvasRef]);
}

interface ToastItem { id: number; text: string; dying: boolean; }
let _toastId = 0;

export function LobbyPage({ onGame }: Props) {
  const { address, isConnected, account } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const actions = useActions(account);
  const [joinId, setJoinId] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showJoin, setShowJoin] = useState(false);
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const isCartridge = isConnected && address;
  const isP1 = getActivePlayer() === PLAYER1;
  const displayAddress = isCartridge ? address : (getActivePlayer() ?? "");
  const stats = usePlayerStats(displayAddress);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useParticles(canvasRef);

  useEffect(() => {
    audioManager.init();
    voiceOver.resetSession(); // reset one-shot VO guards for new session
    if (!muted) {
      audioManager.fadeInMusic(1500);
    }
  }, []);

  function addToast(text: string) {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, text, dying: false }]);
    setTimeout(() => setToasts(prev => prev.map(t => t.id === id ? { ...t, dying: true } : t)), 2200);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2700);
  }

  function handleMuteToggle() {
    audioManager.playSFX("click");
    const next = !muted;
    setMuted(next);
    audioManager.setMuted(next);
    voiceOver.setMuted(next); // keep voice in sync with global toggle
    if (!next) { audioManager.init(); audioManager.playMusic(); }
  }

  function handleOpenSoundMenu() {
    audioManager.playSFX("click");
    setShowSoundMenu(true);
  }

  function switchPlayer(p: string) {
    setActivePlayer(p);
    audioManager.playSFX("click");
  }

  async function handleCreate() {
    if (!displayAddress) { audioManager.playSFX("error"); addToast("⚔ Connect wallet to create a game"); return; }
    audioManager.playSFX("click");
    setLoading("create"); setError(null);
    try {
      const gid = await actions.createGame();
      if (gid) onGame(gid, displayAddress);
      else { audioManager.playSFX("error"); addToast("Failed to create game"); setError("No game ID returned."); }
    } catch (e: unknown) { audioManager.playSFX("error"); setError((e as Error).message); addToast("Error creating game"); }
    finally { setLoading(null); }
  }

  async function handleJoin() {
    if (!joinId.trim()) { addToast("Enter a Game ID"); return; }
    if (!displayAddress) { audioManager.playSFX("error"); addToast("⚔ Connect wallet to join"); return; }
    audioManager.playSFX("click");
    setLoading("join"); setError(null);
    try {
      await actions.joinGame(joinId.trim());
      onGame(joinId.trim(), displayAddress);
    } catch (e: unknown) { audioManager.playSFX("error"); setError((e as Error).message); addToast("Failed to join game"); }
    finally { setLoading(null); }
  }

  async function handleResume() {
    if (!displayAddress) { audioManager.playSFX("error"); addToast("⚔ Connect wallet to resume a game"); return; }
    audioManager.playSFX("click");
    setLoading("resume"); setError(null);
    try {
      const gid = await fetchPlayerGame(displayAddress);
      if (gid) onGame(gid, displayAddress);
      else { audioManager.playSFX("error"); addToast("⚔ No active campaign found"); setError("No active game found."); }
    } catch { setError("Error looking up game"); }
    finally { setLoading(null); }
  }

  const shortAddr = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  if (showLeaderboard) {
    return <LeaderboardPage onBack={() => setShowLeaderboard(false)} />;
  }

  return (
    <>
      <canvas ref={canvasRef} className="particle-canvas" aria-hidden="true" />
      <div className="skull-bg" aria-hidden="true"><SkullSVG /></div>
      <div className="fog" aria-hidden="true" />

      {showSoundMenu && (
        <SoundMenu onClose={() => setShowSoundMenu(false)} muted={muted} onMuteChange={(m) => setMuted(m)} />
      )}

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast${t.dying ? " toast-out" : ""}`}>{t.text}</div>
        ))}
      </div>

      {/* ── Top Bar ── */}
      <div className="lobby-top-bar">
        <div className="lobby-top-left">
          <button
            className={`lobby-icon-btn${!muted ? " active" : ""}`}
            onClick={handleMuteToggle}
            title={muted ? "Enable Sound" : "Mute"}
          >
            <IconVolume muted={muted} />
          </button>
          <button
            className="lobby-icon-btn"
            onClick={handleOpenSoundMenu}
            title="Sound Settings"
          >
            <IconSettings />
          </button>
        </div>

        <div className="lobby-top-right">
          {isCartridge ? (
            <div className="wallet-connected">
              <div className="pts-counter">⚔ {stats?.points ?? 0} pts</div>
              <div className="wallet-addr-pill">
                <img src="/assets/profile/player1.webp" alt="" className="profile-avatar-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <span className="wallet-addr-text">{shortAddr(address || "")}</span>
                <button className="wallet-disconnect" onClick={() => { audioManager.playSFX("click"); disconnect(); }} title="Disconnect">
                  <IconDisconnect />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Burner selector for dev */}
              <div className="burner-selector">
                <button className={`burner-btn${isP1 ? " active" : ""}`} onClick={() => switchPlayer(PLAYER1)}>P1</button>
                <button className={`burner-btn${!isP1 ? " active" : ""}`} onClick={() => switchPlayer(PLAYER2)}>P2</button>
              </div>
              <button
                className="lobby-connect-btn"
                onClick={() => { audioManager.playSFX("click"); connect({ connector: connectors[0] }); }}
              >
                <IconWallet />
                Connect Wallet
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Lobby Body ── */}
      <div className="lobby page-enter">

        {/* CIPHER plaque */}
        <div className="lobby-plaque" aria-label="CIPHER">
          <img
            src="/assets/ui/cipher-plaque.webp"
            alt="CIPHER"
            className="lobby-plaque-img"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              const fb = document.createElement("div");
              fb.className = "lobby-title";
              fb.textContent = "CIPHER";
              (e.target as HTMLImageElement).parentElement?.appendChild(fb);
            }}
          />
        </div>

        {/* ── Stacked Wooden Buttons ── */}
        <div className="lobby-buttons">

          {/* RESUME */}
          <button
            className={`lobby-btn${loading === "resume" ? " loading" : ""}${hoveredBtn === "resume" ? " hovered" : ""}`}
            onClick={!loading ? handleResume : undefined}
            onMouseEnter={() => setHoveredBtn("resume")}
            onMouseLeave={() => setHoveredBtn(null)}
            disabled={!!loading}
          >
            <span className="lobby-btn-diamond">
              <DiamondIcon />
            </span>
            <span className="lobby-btn-label">
              {loading === "resume" ? "Searching..." : "Resume Game"}
            </span>
          </button>

          {/* CREATE */}
          <button
            className={`lobby-btn${loading === "create" ? " loading" : ""}${hoveredBtn === "create" ? " hovered" : ""}`}
            onClick={!loading ? handleCreate : undefined}
            onMouseEnter={() => setHoveredBtn("create")}
            onMouseLeave={() => setHoveredBtn(null)}
            disabled={!!loading}
          >
            <span className="lobby-btn-diamond">
              <DiamondIcon />
            </span>
            <span className="lobby-btn-label">
              {loading === "create" ? "Creating..." : "Create a Room"}
            </span>
          </button>

          {/* JOIN */}
          <button
            className={`lobby-btn${loading === "join" ? " loading" : ""}${showJoin ? " hovered" : ""}${hoveredBtn === "join" ? " hovered" : ""}`}
            onClick={() => { audioManager.playSFX("click"); setShowJoin(s => !s); }}
            onMouseEnter={() => setHoveredBtn("join")}
            onMouseLeave={() => setHoveredBtn(null)}
            disabled={loading === "join"}
          >
            <span className="lobby-btn-diamond">
              <DiamondIcon />
            </span>
            <span className="lobby-btn-label">
              {loading === "join" ? "Joining..." : "Join a Room"}
            </span>
          </button>
        </div>

        {/* Join panel */}
        {showJoin && (
          <div className="lobby-join-panel">
            <input
              className="input lobby-join-input"
              placeholder="Enter Game ID (e.g. 0x1)"
              value={joinId}
              onChange={e => setJoinId(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleJoin()}
              autoFocus
            />
            <button
              className="lobby-btn lobby-btn-confirm"
              onClick={handleJoin}
              disabled={!!loading}
            >
              <span className="lobby-btn-diamond"><DiamondIcon /></span>
              <span className="lobby-btn-label">
                {loading === "join" ? "Joining..." : "Confirm Entry"}
              </span>
            </button>
          </div>
        )}

        {error && (
          <div className="error-msg" style={{ marginTop: 10, position: "relative", zIndex: 2 }}>
            {error}
          </div>
        )}

        {/* Leaderboard link */}
        <button
          className="leaderboard-link"
          onClick={() => { audioManager.playSFX("click"); setShowLeaderboard(true); }}
        >
          <IconTrophy />
          Leaderboard
        </button>
      </div>
    </>
  );
}