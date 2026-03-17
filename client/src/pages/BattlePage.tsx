import type { AccountInterface } from "starknet";
import { getActivePlayer } from "../player";
import { useState, useEffect, useRef, useCallback } from "react";
import { useGameState, PieceState } from "../hooks/useGameState";
import { useActions } from "../hooks/useActions";
import { RANK_NAME, STATUS_FINISHED, STATUS_PLACING } from "../config";
import { getRank, getSalt } from "../utils/commitment";
import { audioManager } from "../utils/audioManager";
import { voiceOver } from "../utils/voiceOver";
import { CombatCinema } from "./CombatCinema";

interface Props {
  gameId: string;
  playerAddress: string;
  account?: AccountInterface | null;
  onLeave: () => void;
}

const BOARD_SIZE = 10;
const TIMER_SECS = 6 * 60;
const LAKE_CELLS = new Set(["2_4","3_4","2_5","3_5","6_4","7_4","6_5","7_5"]);

type CellMode = "idle" | "move" | "attack";
type ConsequenceKind = "normal" | "bomb" | "spy_marshal" | "draw";

// ── SVG Icons ─────────────────────────────────────────────
function FlagIcon({ size = 18 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><line x1="5" y1="2" x2="5" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/><path d="M5 2 L19 7 L5 13 Z"/></svg>; }
function BombIcon({ size = 18 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><circle cx="11" cy="14" r="7.5"/><line x1="11" y1="6.5" x2="11" y2="2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/><path d="M11 2.5 L15.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/><circle cx="11" cy="14" r="2.5" fill="rgba(0,0,0,0.35)"/></svg>; }
function EyeIcon({ size = 18 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>; }
function ZapIcon({ size = 18 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>; }
function PickaxeIcon({ size = 18 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3l6 6-10 10-3-3 3-2-4-4 2-3z" fill="currentColor" fillOpacity="0.8"/><line x1="4" y1="20" x2="10.5" y2="13.5"/></svg>; }
function ShieldIcon({ size = 18 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.35C17.25 23.15 21 18.25 21 13V7L12 2z" fillOpacity="0.85"/></svg>; }
function CrownIcon({ size = 18 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M2 19h20v2H2z" opacity="0.6"/><path d="M2 7l5 6 5-7 5 7 5-6v10H2z"/></svg>; }
function SwordsIcon({ size = 18 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" y1="14" x2="8.5" y2="17.5"/><line x1="14.5" y1="6.5" x2="18.5" y2="10.5"/></svg>; }
function StarIcon({ size = 18, count = 1 }: { size?: number; count?: number }) {
  const positions = count === 1 ? [{cx:12,cy:12}] : count === 2 ? [{cx:8,cy:13},{cx:16,cy:13}] : [{cx:7,cy:14},{cx:12,cy:10},{cx:17,cy:14}];
  const r = count === 1 ? 6 : count === 2 ? 5 : 4.5;
  const pts = (cx: number, cy: number) => { const a: string[] = []; for (let i = 0; i < 10; i++) { const ang = (Math.PI/5)*i - Math.PI/2; const rr = i%2===0?r:r*0.42; a.push(`${cx+rr*Math.cos(ang)},${cy+rr*Math.sin(ang)}`); } return a.join(" "); };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">{positions.map((p,i) => <polygon key={i} points={pts(p.cx,p.cy)}/>)}</svg>;
}
function RankIcon({ rank, size = 18 }: { rank: number; size?: number }) {
  switch(rank) {
    case 0:  return <FlagIcon size={size}/>;
    case 1:  return <EyeIcon size={size}/>;
    case 2:  return <ZapIcon size={size}/>;
    case 3:  return <PickaxeIcon size={size}/>;
    case 4:  return <ShieldIcon size={size}/>;
    case 5:  return <StarIcon size={size} count={1}/>;
    case 6:  return <StarIcon size={size} count={2}/>;
    case 7:  return <StarIcon size={size} count={3}/>;
    case 8:  return <CrownIcon size={size}/>;
    case 9:  return <SwordsIcon size={size}/>;
    case 10: return <CrownIcon size={size}/>;
    case 11: return <BombIcon size={size}/>;
    default: return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><text x="12" y="17" textAnchor="middle" fontSize="16" fontFamily="Cinzel,serif" fontWeight="700">C</text></svg>;
  }
}

function DiamondIndicator() {
  return <span className="diamond-indicator"><img src="/assets/icons/diamond-indicator.webp" alt="" /></span>;
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getConsequence(attackerRank: number, defenderRank: number): { kind: ConsequenceKind; text: string } {
  if (defenderRank === 11) return { kind: "bomb", text: "💥 EXPLOSION" };
  if (attackerRank === 1 && defenderRank === 10) return { kind: "spy_marshal", text: "☠ SILENCED" };
  if (attackerRank === defenderRank) return { kind: "draw", text: "⚖ MUTUAL ANNIHILATION" };
  if (attackerRank > defenderRank) return { kind: "normal", text: "💀 DESTROYED" };
  return { kind: "normal", text: "💀 DEFEATED" };
}

// ── Wax Seal Game Over (rendered over the board) ──────────
// intentionally removed — gameover now uses full-screen overlay with PNG assets below

// ── Medallion Piece ───────────────────────────────────────
function MedallionPiece({ rank, isOwn, isRevealed, isSelected, isCombat }: {
  rank: number; isOwn: boolean; isRevealed: boolean; isSelected: boolean; isCombat?: boolean;
}) {
  const getAssetPath = () => {
    // Enemy piece not yet revealed — always show back face
    if (!isOwn && !isRevealed) return "/assets/pieces/piece-hidden.webp";
    // From here: either our own piece, or an enemy piece that IS revealed
    // Trust the rank from the chain — show whatever rank was set
    if (rank === 0)  return "/assets/pieces/flag.webp";
    if (rank === 11) return "/assets/pieces/bomb.webp";
    return `/assets/pieces/rank-${rank}.png`;
  };
  const rankLabel = rank === 0 ? "F" : rank === 11 ? "B" : String(rank);
  let cls = "piece";
  if (isOwn) cls += " piece-own";
  else if (isRevealed) cls += " piece-enemy-revealed";
  else cls += " piece-hidden";
  if (isSelected || isCombat) cls += " piece-selected";
  return (
    <div className={cls} style={{ borderRadius: "50%", overflow: "visible" }}>
      <img src={getAssetPath()} alt={rankLabel} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", display: "block" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}/>
      {isRevealed && (
        <div style={{ position: "absolute", bottom: 0, right: 0, width: "32%", height: "32%", borderRadius: "50%", background: "rgba(0,0,0,0.75)", border: "1px solid rgba(201,168,76,0.6)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-head)", fontSize: "calc(var(--cell) * 0.14)", fontWeight: 700, color: isOwn ? "var(--gold-light)" : "#ffdede", lineHeight: 1, pointerEvents: "none", zIndex: 5 }}>
          {rankLabel}
        </div>
      )}
    </div>
  );
}

function PieceToken({ piece, isOwn, gameId, isSelected, isCombat }: {
  piece: PieceState; isOwn: boolean; gameId: string; isSelected: boolean; isCombat: boolean | undefined;
}) {
  const rank = isOwn ? getRank(gameId, piece.piece_id) : piece.revealed_rank;
  const isRevealed = isOwn || (!!isCombat && piece.is_revealed);
  return <MedallionPiece rank={rank} isOwn={isOwn} isRevealed={isRevealed} isSelected={isSelected} isCombat={isCombat}/>;
}

// ── Animated Water Lake — pure CSS, no image file needed ──
function ParchmentLake({ blobId }: { blobId: string }) {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0,
      width: "100%", height: "100%",
      pointerEvents: "none", zIndex: 5,
      borderRadius: "10px", overflow: "hidden",
    }}>
      {/* Deep water base */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 42% 38%, rgba(60,115,175,0.78) 0%, rgba(32,78,138,0.70) 50%, rgba(14,50,108,0.62) 100%)",
      }}/>

      {/* Wave layer 1 — slow diagonal drift */}
      <div style={{
        position: "absolute", inset: 0,
        background: `
          repeating-linear-gradient(
            105deg,
            transparent 0px,
            transparent 18px,
            rgba(120,180,255,0.10) 18px,
            rgba(120,180,255,0.10) 20px
          )
        `,
        animation: `wave-drift-a-${blobId} 5s linear infinite`,
      }}/>

      {/* Wave layer 2 — faster, opposite angle */}
      <div style={{
        position: "absolute", inset: 0,
        background: `
          repeating-linear-gradient(
            72deg,
            transparent 0px,
            transparent 12px,
            rgba(160,210,255,0.07) 12px,
            rgba(160,210,255,0.07) 14px
          )
        `,
        animation: `wave-drift-b-${blobId} 3.5s linear infinite reverse`,
      }}/>

      {/* Surface shimmer — slow breathing */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 30% 25%, rgba(180,225,255,0.22) 0%, transparent 55%)",
        animation: `shimmer-pulse-${blobId} 3s ease-in-out infinite alternate`,
      }}/>

      {/* Parchment blend edge — so water looks embedded in the map */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at center, transparent 50%, rgba(140,100,40,0.38) 100%)",
        borderRadius: "10px",
      }}/>

      <style>{`
        @keyframes wave-drift-a-${blobId} {
          from { background-position: 0 0; }
          to   { background-position: 40px 20px; }
        }
        @keyframes wave-drift-b-${blobId} {
          from { background-position: 0 0; }
          to   { background-position: -28px 14px; }
        }
        @keyframes shimmer-pulse-${blobId} {
          from { opacity: 0.6; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Game Over Overlay ─────────────────────────────────────
function GameOverOverlay({
  isWinner, gameId, actions, onLeave,
}: {
  isWinner: boolean;
  gameId: string;
  actions: ReturnType<typeof import("../hooks/useActions").useActions>;
  onLeave: () => void;
}) {
  const [claimed, setClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  async function handleClaim() {
    setClaiming(true); setClaimError(null);
    audioManager.playSFX("click");
    try {
      await actions.claimReward(gameId);
      audioManager.playSFX("victory");
      setClaimed(true);
    } catch (e: unknown) {
      audioManager.playSFX("error");
      // If already claimed, treat it as success silently
      const msg = (e as Error).message ?? "";
      if (msg.includes("Already claimed")) {
        setClaimed(true);
      } else {
        setClaimError("Could not claim — try again");
      }
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className={`gameover-overlay ${isWinner ? "victory-overlay" : "defeat-overlay"}`}>
      <div className="gameover-modal">
        {isWinner ? (
          <>
            <span className="gameover-title victory">VICTORY</span>

            {!claimed ? (
              <button
                className="lobby-btn"
                style={{ minWidth: 260, marginBottom: 10 }}
                onClick={handleClaim}
                disabled={claiming}
              >
                <span className="lobby-btn-diamond"><DiamondIndicator /></span>
                <span className="lobby-btn-label">
                  {claiming ? "Claiming..." : "Claim Reward"}
                </span>
              </button>
            ) : (
              <div style={{
                fontFamily: "var(--font-head)",
                fontSize: 13, letterSpacing: "0.18em",
                color: "var(--gold-light)",
                textShadow: "0 0 14px rgba(201,168,76,0.5)",
                padding: "12px 28px",
                border: "1px solid rgba(201,168,76,0.3)",
                borderRadius: "3px",
                marginBottom: 10,
                animation: "banner-pulse 1.4s ease-in-out infinite",
              }}>
                +100 POINTS BANKED
              </div>
            )}

            {claimError && (
              <div className="error-msg" style={{ marginBottom: 8 }}>{claimError}</div>
            )}

            <button
              className="lobby-btn"
              style={{ minWidth: 260 }}
              onClick={() => { audioManager.playSFX("click"); onLeave(); }}
            >
              <span className="lobby-btn-label">Return to Lobby</span>
            </button>
          </>
        ) : (
          <>
            <span className="gameover-title defeat">DEFEAT</span>
            <div style={{
              fontFamily: "var(--font-head)",
              fontSize: 11, letterSpacing: "0.14em",
              color: "var(--text-dim)", marginBottom: 16,
            }}>
              +10 participation points awarded
            </div>
            <button
              className="lobby-btn"
              style={{ minWidth: 260 }}
              onClick={() => { audioManager.playSFX("click"); onLeave(); }}
            >
              <span className="lobby-btn-label">Return to Lobby</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function BattlePage({ gameId, playerAddress, account, onLeave }: Props) {
  const ACTIVE_PLAYER = playerAddress || getActivePlayer();
  const { game, pieces, combat, refetch } = useGameState(gameId, 1500);
  const actions = useActions(account);

  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(null);
  const [validCells, setValidCells] = useState<Record<string, CellMode>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trailCell, setTrailCell] = useState<string | null>(null);
  const [originCell, setOriginCell] = useState<string | null>(null);
  const [blastCell, setBlastCell] = useState<string | null>(null);
  const [showBombFlash, setShowBombFlash] = useState(false);
  const [showCommencing, setShowCommencing] = useState(true);

  // Combat cinema state
  const [cinemaProps, setCinemaProps] = useState<{
    attacker: { pieceId: number; rank: number; isOwn: boolean; label: string };
    defender: { pieceId: number; rank: number; isOwn: boolean; label: string };
  } | null>(null);

  type FloatLabel = { id: number; text: string; cellKey: string };
  const [floatingLabels, setFloatingLabels] = useState<FloatLabel[]>([]);
  const floatIdRef = useRef(0);

  const emitFloat = useCallback((text: string, cellKey: string) => {
    const id = ++floatIdRef.current;
    setFloatingLabels(prev => [...prev, { id, text, cellKey }]);
    setTimeout(() => setFloatingLabels(prev => prev.filter(f => f.id !== id)), 2800);
  }, []);

  const normalize = (addr: string) => "0x" + BigInt(addr).toString(16).padStart(64, "0");

  // Always-fresh refs — avoids stale closure problems in async callbacks
  const piecesRef = useRef(pieces);
  useEffect(() => { piecesRef.current = pieces; }, [pieces]);
  const cinemaPropsRef = useRef(cinemaProps);
  useEffect(() => { cinemaPropsRef.current = cinemaProps; }, [cinemaProps]);

  // ── Music: dim during battle (keeps tension), restore on return ──
  useEffect(() => {
    voiceOver.play("battleCommencing", { delay: 600 });
    // Dim to 15% — audible tension, not overwhelming
    audioManager.dimMusic(0.15, 1500);
    const commencingTimer = setTimeout(() => setShowCommencing(false), 3500);
    return () => {
      clearTimeout(commencingTimer);
      // Restore full music volume when leaving battle
      audioManager.fadeInMusic(1500);
    };
  }, []);

  // ── Cinema trigger: fires for BOTH players when combat becomes active ──
  const prevCombatKeyRef = useRef("");
  useEffect(() => {
    if (!combat?.is_active) {
      prevCombatKeyRef.current = "";
      return;
    }
    const cKey = `${combat.attacker_piece_id}-${combat.defender_piece_id}`;
    if (prevCombatKeyRef.current === cKey) return;
    prevCombatKeyRef.current = cKey;

    const attPiece = pieces.find(p => p.piece_id === combat.attacker_piece_id);
    const defPiece = pieces.find(p => p.piece_id === combat.defender_piece_id);
    const isWeAttacker = normalize(attPiece?.owner ?? "0x0") === normalize(ACTIVE_PLAYER ?? "0x0");
    const isWeDefender = normalize(defPiece?.owner ?? "0x0") === normalize(ACTIVE_PLAYER ?? "0x0");

    // Resolve defender rank — we only know our OWN pieces' ranks
    let defRank = 0;
    if (isWeDefender) {
      defRank = getRank(gameId, combat.defender_piece_id);
      // Fallback: if stored rank is 0 and piece looks like a bomb
      if (defRank === 0 && defPiece?.revealed_rank === 11) defRank = 11;
      if (defRank === 0 && defPiece?.is_revealed) defRank = defPiece.revealed_rank;
    } else {
      defRank = 0; // intentional — attacker doesn't know yet, cinema reveals after chain confirms
    }

    setCinemaProps({
      attacker: {
        pieceId: combat.attacker_piece_id,
        rank: combat.attacker_rank,
        isOwn: isWeAttacker,
        label: "ATTACKER",
      },
      defender: {
        pieceId: combat.defender_piece_id,
        rank: defRank,
        isOwn: isWeDefender,
        label: "DEFENDER",
      },
    });
  }, [combat?.is_active, combat?.attacker_piece_id, combat?.defender_piece_id, pieces]);

  // ── Resolve combat (called by cinema's onResolve) ────────
  const handleResolveCombat = useCallback(async () => {
    if (!combat) return;
    const defPiece = pieces.find(p => p.piece_id === combat.defender_piece_id);
    const isWeDefender = normalize(defPiece?.owner ?? "0x0") === normalize(ACTIVE_PLAYER ?? "0x0");

    // Only the DEFENDER submits the resolve tx
    if (!isWeDefender) {
      // Attacker just polls until resolved
      await new Promise<void>(resolve => setTimeout(resolve, 1200));
      await refetch();
      return;
    }

    let defRank = getRank(gameId, combat.defender_piece_id);
    const defSalt = getSalt(gameId, combat.defender_piece_id);

    // Robust bomb detection
    if (defRank === 0 && defPiece?.revealed_rank === 11) defRank = 11;
    if (defRank === 0 && defPiece?.is_revealed) defRank = defPiece.revealed_rank;

    // If rank still unknown, try from piece type — last resort
    if (defRank === 0) {
      console.warn("CombatCinema: defender rank unknown, defaulting to 0");
    }

    try {
      await actions.resolveCombat(gameId, combat.defender_piece_id, defRank, defSalt);
      audioManager.playSFX("attack");
      if (defRank === 11) {
        setShowBombFlash(true);
        setTimeout(() => setShowBombFlash(false), 800);
      }
      if (defPiece) {
        const key = `${defPiece.x}_${defPiece.y}`;
        setBlastCell(key);
        setTimeout(() => setBlastCell(null), 900);
      }
      await refetch();
    } catch (e: unknown) {
      audioManager.playSFX("error");
      setError((e as Error).message);
      // Always refetch so game doesn't hang even if tx fails
      try { await refetch(); } catch { /* ignore */ }
    }
  }, [combat, pieces, gameId, actions, refetch]);

  const resolveRef = useRef(handleResolveCombat);
  resolveRef.current = handleResolveCombat;

  // ── Timers ─────────────────────────────────────────────
  const [myTime, setMyTime] = useState(TIMER_SECS);
  const [oppTime, setOppTime] = useState(TIMER_SECS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTurn = useRef<string>("");

  useEffect(() => {
    if (!game || game.status === STATUS_FINISHED) { if (timerRef.current) clearInterval(timerRef.current); return; }
    const myAddress = normalize(ACTIVE_PLAYER ?? "0x0");
    const isMyTurnNow = normalize(game.current_turn) === myAddress;
    if (game.current_turn !== prevTurn.current) {
      prevTurn.current = game.current_turn;
      if (isMyTurnNow) voiceOver.play("yourTurn", { delay: 300 });
    }
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (isMyTurnNow) { setMyTime(t => { if (t <= 1) { actions.forfeit(gameId).catch(() => {}); return 0; } return t - 1; }); }
      else { setOppTime(t => Math.max(0, t - 1)); }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [game?.current_turn, game?.status]);

  const handleForfeit = useCallback(async () => {
    if (!confirm("Surrender this campaign?")) return;
    setLoading(true); audioManager.playSFX("click");
    try { await actions.forfeit(gameId); await refetch(); }
    catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [actions, gameId, refetch]);

  // ── Game over audio ────────────────────────────────────
  const gameOverFiredRef = useRef(false);
  useEffect(() => {
    if (!game || game.status !== STATUS_FINISHED) return;
    if (gameOverFiredRef.current) return;
    gameOverFiredRef.current = true;
    const myAddr = normalize(ACTIVE_PLAYER ?? "0x0");
    const won = normalize(game.winner) === myAddr;
    audioManager.fadeOutMusic(1500);
    setTimeout(() => { audioManager.playSFX(won ? "victory" : "defeat"); voiceOver.play(won ? "victory" : "defeat", { force: true, delay: 600 }); }, 1600);
  }, [game?.status]);

  if (!game || !ACTIVE_PLAYER) {
    return (
      <div className="game-frame">
        <div className="waiting-state">
          <div className="dot-loader"><span/><span/><span/></div>
          <h3>Loading</h3>
        </div>
      </div>
    );
  }
  if (game.status === STATUS_PLACING) {
    return (
      <div className="game-frame">
        <div className="waiting-state">
          <h3>Awaiting Deployment</h3>
          <div className="dot-loader"><span/><span/><span/></div>
          <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic" }}>Both players must deploy their forces</p>
        </div>
      </div>
    );
  }

  const isP1 = normalize(ACTIVE_PLAYER) === normalize(game.player1);
  const myAddress = normalize(ACTIVE_PLAYER);
  const isMyTurn = normalize(game.current_turn) === myAddress;
  const isWinner = game.status === STATUS_FINISHED && normalize(game.winner) === myAddress;
  const isGameOver = game.status === STATUS_FINISHED;

  const myAvatar = "/assets/profile/player1.webp";
  const oppAvatar = "/assets/profile/opponent.webp";
  const oppAddr = isP1 ? game.player2 : game.player1;
  const short = (a: string) => a ? `${a.slice(0, 5)}...${a.slice(-3)}` : "—";

  const boardMap: Record<string, PieceState> = {};
  for (const p of pieces) { if (p.is_placed && p.is_alive) boardMap[`${p.x}_${p.y}`] = p; }

  function getPieceByCell(x: number, y: number) { return boardMap[`${x}_${y}`] ?? null; }

  function computeValidMoves(piece: PieceState): Record<string, CellMode> {
    const cells: Record<string, CellMode> = {};
    const rank = getRank(gameId, piece.piece_id);
    if (rank === 0 || rank === 11) return cells;
    if (rank === 2) {
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        let nx = piece.x + dx, ny = piece.y + dy;
        while (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
          if (LAKE_CELLS.has(`${nx}_${ny}`)) break;
          const occ = getPieceByCell(nx, ny);
          if (occ) { if (normalize(occ.owner) !== myAddress) cells[`${nx}_${ny}`] = "attack"; break; }
          cells[`${nx}_${ny}`] = "move"; nx += dx; ny += dy;
        }
      }
    } else {
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = piece.x + dx, ny = piece.y + dy;
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) continue;
        if (LAKE_CELLS.has(`${nx}_${ny}`)) continue;
        const occ = getPieceByCell(nx, ny);
        if (!occ) cells[`${nx}_${ny}`] = "move";
        else if (normalize(occ.owner) !== myAddress) cells[`${nx}_${ny}`] = "attack";
      }
    }
    return cells;
  }

  function handlePieceClick(piece: PieceState) {
    if (!isMyTurn || loading || combat?.is_active) return;
    if (normalize(piece.owner) !== myAddress) return;
    audioManager.playSFX("click");
    if (selectedPieceId === piece.piece_id) { setSelectedPieceId(null); setValidCells({}); return; }
    setSelectedPieceId(piece.piece_id);
    setValidCells(computeValidMoves(piece));
  }

  async function handleCellClick(x: number, y: number) {
    const mode = validCells[`${x}_${y}`];
    if (!mode || !selectedPieceId || loading) return;
    const fromPiece = pieces.find(p => p.piece_id === selectedPieceId);
    const fromKey = fromPiece ? `${fromPiece.x}_${fromPiece.y}` : null;
    const toKey = `${x}_${y}`;
    const isAttack = mode === "attack";
    setLoading(true); setError(null); setSelectedPieceId(null); setValidCells({});
    try {
      const rank = getRank(gameId, selectedPieceId);
      const salt = getSalt(gameId, selectedPieceId);
      await actions.movePiece(gameId, selectedPieceId, x, y, rank, salt);
      audioManager.playSFX(isAttack ? "attack" : "move");
      if (isAttack) { setBlastCell(toKey); setTimeout(() => setBlastCell(null), 750); }
      else { if (fromKey) { setOriginCell(fromKey); setTimeout(() => setOriginCell(null), 5000); } setTrailCell(toKey); setTimeout(() => setTrailCell(null), 5000); }
      await refetch();
    } catch (e: unknown) { audioManager.playSFX("error"); setError((e as Error).message); }
    finally { setLoading(false); }
  }

  const myPieces = pieces.filter(p => normalize(p.owner) === myAddress && p.is_alive);
  const oppPieces = pieces.filter(p => normalize(p.owner) !== myAddress && p.is_alive);
  const myPlaced = isP1 ? game.p1_pieces_placed : game.p2_pieces_placed;
  const oppPlaced = isP1 ? game.p2_pieces_placed : game.p1_pieces_placed;

  const boardRotation = isP1 ? "rotate(180deg)" : "none";
  const cellCounterRotation = isP1 ? "rotate(180deg)" : undefined;



  return (
    <>
      {/* Battle Commencing overlay */}
      {showCommencing && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "radial-gradient(ellipse at center, rgba(20,10,5,0.97) 0%, rgba(0,0,0,0.99) 100%)",
          animation: "commencingFadeOut 3.5s ease-out forwards",
          pointerEvents: "none",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-title)", fontSize: "clamp(32px,6vw,64px)", fontWeight: 900, color: "var(--gold)", letterSpacing: "0.2em", animation: "commencingPulse 1s ease-in-out 3", textShadow: "0 0 60px rgba(201,168,76,0.7), 0 0 120px rgba(201,168,76,0.3)" }}>
              ⚔ BATTLE COMMENCING ⚔
            </div>
            <div style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: 16, letterSpacing: "0.18em", color: "var(--text-dim)", marginTop: 20 }}>
              Deploy your strategy
            </div>
            <div style={{ marginTop: 24 }}>
              <div className="dot-loader"><span/><span/><span/></div>
            </div>
          </div>
        </div>
      )}

      <div className="game-frame page-enter">

        {/* ── Left Panel — Your Forces + Opponent ── */}
        <div className="battle-left-panel">

          {/* YOUR FORCES card */}
          <div className={`battle-player-card${isMyTurn && !isGameOver ? " is-active-turn" : ""}`}>
            <div className="battle-card-avatar-row">
              <img src={myAvatar} alt="" className="profile-avatar" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}/>
            </div>
            <div className="battle-card-title">
              <DiamondIndicator /> Your Forces
            </div>
            <div className="battle-card-info-row">
              <span className="battle-card-label">Address:</span>
              <span className="battle-card-value">{short(myAddress)}</span>
            </div>
            <div className="battle-card-info-row">
              <span className="battle-card-label">Timer</span>
              <span className={`battle-card-value timer-value${isMyTurn ? " active" : ""}${myTime < 60 && isMyTurn ? " danger" : ""}`}>
                {formatTime(myTime)}
              </span>
            </div>
            <div className="battle-card-info-row">
              <span className="battle-card-label">Placed:</span>
              <span className="battle-card-value gold">{myPlaced}/10</span>
            </div>
            <div className="battle-card-progress">
              <div className="battle-card-progress-fill" style={{ width: `${(myPieces.length / 10) * 100}%` }}/>
            </div>
          </div>

          {/* OPPONENT card */}
          <div className={`battle-player-card battle-opp-card${!isMyTurn && !isGameOver ? " is-active-turn" : ""}`}>
            <div className="battle-card-title">
              <DiamondIndicator /> Opponent
            </div>
            <div className="battle-card-info-row">
              <span className="battle-card-label">Address:</span>
              <span className="battle-card-value">{short(oppAddr)}</span>
            </div>
            <div className="battle-card-info-row">
              <span className="battle-card-label">Placed:</span>
              <span className="battle-card-value">{oppPlaced}/10</span>
            </div>
            <div className="battle-card-progress">
              <div className="battle-card-progress-fill opp" style={{ width: `${(oppPieces.length / 10) * 100}%` }}/>
            </div>
            <div className="battle-card-avatar-row opp-avatar-row">
              <img src={oppAvatar} alt="" className="profile-avatar-sm opp-avatar-float" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}/>
            </div>
          </div>

          {error && <div className="error-msg" style={{ fontSize: 10, marginTop: 4 }}>{error}</div>}

          <div style={{ flex: 1 }}/>

          <button className="btn btn-sm btn-danger" onClick={handleForfeit} disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
            Surrender
          </button>
        </div>

        {/* ── Board ── */}
        <div className="board-container" style={{ position: "relative" }}>
          <div className="board-frame">
            <div className="board" style={{ position: "relative", transform: boardRotation }}>
              {Array.from({ length: BOARD_SIZE }, (_, row) =>
                Array.from({ length: BOARD_SIZE }, (_, col) => {
                  const key = `${col}_${row}`;
                  const isLake = LAKE_CELLS.has(key);
                  const cellMode = isLake ? undefined : validCells[key];
                  const piece = isLake ? undefined : boardMap[key];
                  const isSelected = piece?.piece_id === selectedPieceId;

                  let cls = "cell";
                  if (isLake) cls += " lake-cell";
                  else {
                    if (cellMode === "move")   cls += " valid-move";
                    if (cellMode === "attack") cls += " valid-attack";
                    if (isSelected)            cls += " selected";
                    if (key === trailCell)     cls += " cell-trail";
                    if (key === originCell)    cls += " cell-origin";
                    if (key === blastCell)     cls += " cell-blast";
                  }

                  return (
                    <div key={key} className={cls}
                      style={cellCounterRotation ? { transform: cellCounterRotation } : undefined}
                      onClick={() => {
                        if (isLake) return;
                        if (piece && normalize(piece.owner) === myAddress) handlePieceClick(piece);
                        else if (cellMode) handleCellClick(col, row);
                      }}
                    >
                      {piece && (
                        <PieceToken piece={piece} isOwn={normalize(piece.owner) === myAddress} gameId={gameId} isSelected={!!isSelected} isCombat={combat?.is_active && (combat.attacker_piece_id === piece.piece_id || combat.defender_piece_id === piece.piece_id)}/>
                      )}
                      {floatingLabels.filter(f => f.cellKey === key).map(f => (
                        <div key={f.id} style={{ position: "absolute", top: "-4px", left: "50%", transform: "translateX(-50%)", zIndex: 50, pointerEvents: "none", background: "rgba(80,5,5,0.95)", border: "1px solid rgba(201,168,76,0.35)", padding: "4px 10px", borderRadius: "3px", fontFamily: "var(--font-head)", fontSize: 13, fontWeight: 700, color: "var(--gold-light)", letterSpacing: "0.06em", whiteSpace: "nowrap", animation: "floatUp 2.8s ease-out forwards" }}>
                          {f.text}
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
              {/* Lakes */}
              <div style={{ position: "absolute", left: "calc(2 * var(--cell) + 2px)", top: "calc(4 * var(--cell) + 4px)", width: "calc(2 * var(--cell) + 1px)", height: "calc(2 * var(--cell) + 1px)", overflow: "visible", pointerEvents: "none" }}>
                <ParchmentLake blobId="left"/>
              </div>
              <div style={{ position: "absolute", left: "calc(6 * var(--cell) + 6px)", top: "calc(4 * var(--cell) + 4px)", width: "calc(2 * var(--cell) + 1px)", height: "calc(2 * var(--cell) + 1px)", overflow: "visible", pointerEvents: "none" }}>
                <ParchmentLake blobId="right"/>
              </div>
            </div>
          </div>

        </div>

        {/* ── Right Panel — Battle Status ── */}
        <div className="battle-right-panel">
          <div className="battle-status-title">Battle Status</div>
          <div className="battle-status-divider"/>

          <div className="battle-status-row">
            <DiamondIndicator />
            <span className="battle-status-label">Turn</span>
            <span className="battle-status-value gold">{game.turn_count}</span>
          </div>

          <div className="battle-status-row">
            <span className="battle-status-label">Placed:</span>
            <span className="battle-status-value muted">{gameId.slice(0, 8)}</span>
          </div>

          {/* Large round clock */}
          <div className="battle-clock">
            <div className="battle-clock-face">
              <span className={`battle-clock-time${isMyTurn && myTime < 60 ? " danger" : ""}`}>
                {formatTime(isMyTurn ? myTime : oppTime)}
              </span>
            </div>
          </div>

          {/* Turn / Status indicator — in right panel */}
          <div className={`battle-status-badge${
            loading || combat?.is_active ? " badge-deploying"
            : isMyTurn ? " badge-your-turn"
            : " badge-waiting"
          }`}>
            <DiamondIndicator />
            <span className="battle-status-badge-text">
              {loading || combat?.is_active
                ? "Deploying..."
                : isMyTurn
                ? "Your Move"
                : "Awaiting..."}
            </span>
            {(loading || combat?.is_active) && (
              <div className="dot-loader" style={{ transform: "scale(0.55)" }}><span/><span/><span/></div>
            )}
          </div>

          {selectedPieceId !== null && (() => {
            const r = getRank(gameId, selectedPieceId);
            return (
              <div className="battle-selected-unit">
                <span className="battle-status-label">Selected:</span>
                <span className="battle-status-value gold" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                  <RankIcon rank={r} size={14}/> {RANK_NAME[r] ?? "Unknown"}
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      {showBombFlash && <div className="bomb-flash"/>}

      {/* ── Game Over ── */}
      {isGameOver && (
        <GameOverOverlay
          isWinner={isWinner}
          gameId={gameId}
          actions={actions}
          onLeave={onLeave}
        />
      )}

      {/* ── Combat Cinema ── */}
      {cinemaProps && (
        <CombatCinema
          attacker={cinemaProps.attacker}
          defender={cinemaProps.defender}
          onResolve={async () => {
            await resolveRef.current();
            const defPieceId = cinemaPropsRef.current?.defender.pieceId;
            for (let i = 0; i < 12; i++) {
              await new Promise(r => setTimeout(r, 600));
              await refetch();
              const defPiece = piecesRef.current.find(p => p.piece_id === defPieceId);
              if (defPiece?.is_revealed) {
                return defPiece.revealed_rank;
              }
            }

            // Fallback if polling timed out — should rarely happen
            const defPiece = piecesRef.current.find(p => p.piece_id === defPieceId);
            return defPiece?.revealed_rank ?? 0;
          }}
          onDone={() => {
            setCinemaProps(null);
            refetch();
          }}
        />
      )}
    </>
  );
}