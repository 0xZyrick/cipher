import { getActivePlayer } from "../player";
import { useState, useEffect, useRef, useCallback } from "react";
import { useGameState, PieceState } from "../hooks/useGameState";
import { useActions } from "../hooks/useActions";
import { RANK_NAME, STATUS_FINISHED, STATUS_PLACING } from "../config";
import { getRank, getSalt } from "../utils/commitment";

interface Props { gameId: string; onLeave: () => void; }

const BOARD_SIZE = 10;
const TIMER_SECS = 6 * 60; // 6 minutes

// Impassable lake cells
const LAKE_CELLS = new Set(["2_4","3_4","2_5","3_5","6_4","7_4","6_5","7_5"]);

type CellMode = "idle" | "move" | "attack";
type CombatPhase = "active" | "flipping" | "revealed" | "consequence";
type ConsequenceKind = "normal" | "bomb" | "spy_marshal" | "draw";

// ── Inline SVG Piece Icons ─────────────────────────────────
function FlagIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <line x1="5" y1="2" x2="5" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M5 2 L19 7 L5 13 Z" />
    </svg>
  );
}
function BombIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="11" cy="14" r="7.5" />
      <line x1="11" y1="6.5" x2="11" y2="2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M11 2.5 L15.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <circle cx="11" cy="14" r="2.5" fill="rgba(0,0,0,0.35)" />
    </svg>
  );
}
function EyeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}
function ZapIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  );
}
function PickaxeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3l6 6-10 10-3-3 3-2-4-4 2-3z" fill="currentColor" fillOpacity="0.8"/>
      <line x1="4" y1="20" x2="10.5" y2="13.5"/>
    </svg>
  );
}
function ShieldIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.35C17.25 23.15 21 18.25 21 13V7L12 2z" fillOpacity="0.85"/>
    </svg>
  );
}
function StarIcon({ size = 18, count = 1 }: { size?: number; count?: number }) {
  const positions = count === 1
    ? [{ cx: 12, cy: 12 }]
    : count === 2
    ? [{ cx: 8, cy: 13 }, { cx: 16, cy: 13 }]
    : [{ cx: 7, cy: 14 }, { cx: 12, cy: 10 }, { cx: 17, cy: 14 }];
  const r = count === 1 ? 6 : count === 2 ? 5 : 4.5;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      {positions.map((p, i) => (
        <polygon key={i}
          points={starPoints(p.cx, p.cy, r, r * 0.42, 5)}
        />
      ))}
    </svg>
  );
}
function starPoints(cx: number, cy: number, outerR: number, innerR: number, n: number) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const angle = (Math.PI / n) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(" ");
}
function CrownIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 19h20v2H2z" opacity="0.6"/>
      <path d="M2 7l5 6 5-7 5 7 5-6v10H2z" />
    </svg>
  );
}
function SwordsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/>
      <line x1="13" y1="19" x2="19" y2="13"/>
      <line x1="16" y1="16" x2="20" y2="20"/>
      <line x1="19" y1="21" x2="21" y2="19"/>
      <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/>
      <line x1="5" y1="14" x2="8.5" y2="17.5"/>
      <line x1="14.5" y1="6.5" x2="18.5" y2="10.5"/>
    </svg>
  );
}
function QuestionIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <text x="12" y="17" textAnchor="middle" fontSize="16" fontFamily="Cinzel, serif" fontWeight="700" fill="currentColor">C</text>
    </svg>
  );
}

// ── Rank → Icon mapping ────────────────────────────────────
function RankIcon({ rank, size = 18 }: { rank: number; size?: number }) {
  switch (rank) {
    case 0:  return <FlagIcon size={size} />;
    case 1:  return <EyeIcon size={size} />;
    case 2:  return <ZapIcon size={size} />;
    case 3:  return <PickaxeIcon size={size} />;
    case 4:  return <ShieldIcon size={size} />;
    case 5:  return <StarIcon size={size} count={1} />;
    case 6:  return <StarIcon size={size} count={2} />;
    case 7:  return <StarIcon size={size} count={3} />;
    case 8:  return <CrownIcon size={size} />;
    case 9:  return <SwordsIcon size={size} />;
    case 10: return <CrownIcon size={size} />;
    case 11: return <BombIcon size={size} />;
    default: return <QuestionIcon size={size} />;
  }
}

// ── Skull for gameover ─────────────────────────────────────
function SkullSVG() {
  return (
    <svg className="skull-svg" viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" fill="#1a1410">
      <ellipse cx="100" cy="88" rx="78" ry="82" />
      <ellipse cx="68" cy="82" rx="22" ry="24" fill="#080705" />
      <ellipse cx="132" cy="82" rx="22" ry="24" fill="#080705" />
      <path d="M90 106 Q100 118 110 106 Q105 122 100 128 Q95 122 90 106Z" fill="#080705" />
      <ellipse cx="100" cy="148" rx="62" ry="28" />
      <rect x="42" y="148" width="116" height="38" rx="8" />
      <rect x="56" y="148" width="14" height="32" rx="3" fill="#080705" />
      <rect x="77" y="148" width="14" height="34" rx="3" fill="#080705" />
      <rect x="98" y="148" width="14" height="34" rx="3" fill="#080705" />
      <rect x="119" y="148" width="14" height="32" rx="3" fill="#080705" />
    </svg>
  );
}

// ── Timer helper ───────────────────────────────────────────
function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Consequence helper ─────────────────────────────────────
function getConsequence(attackerRank: number, defenderRank: number): { kind: ConsequenceKind; text: string } {
  if (defenderRank === 11) return { kind: "bomb",       text: "💥 EXPLOSION" };
  if (attackerRank === 1 && defenderRank === 10) return { kind: "spy_marshal", text: "☠ SILENCED" };
  if (attackerRank === defenderRank) return { kind: "draw", text: "⚖ MUTUAL ANNIHILATION" };
  // Higher rank wins (lower rank = flag/spy at 0/1, higher = marshal at 10)
  if (attackerRank > defenderRank) return { kind: "normal", text: "💀 DESTROYED" };
  return { kind: "normal", text: "💀 DEFEATED" };
}

const ACTIVE_PLAYER = getActivePlayer();

export function BattlePage({ gameId, onLeave }: Props) {
  const { game, pieces, combat, refetch } = useGameState(gameId, 1500);
  const actions = useActions();

  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(null);
  const [validCells, setValidCells] = useState<Record<string, CellMode>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animation states
  const [trailCell, setTrailCell] = useState<string | null>(null);
  const [originCell, setOriginCell] = useState<string | null>(null);
  const [blastCell, setBlastCell] = useState<string | null>(null);

  // Combat modal state
  const [showCombatModal, setShowCombatModal] = useState(false);
  const [combatPhase, setCombatPhase] = useState<CombatPhase>("active");
  const [combatBurst, setCombatBurst] = useState(false);
  const [savedDefenderRank, setSavedDefenderRank] = useState<number | null>(null);
  const [consequence, setConsequence] = useState<{ kind: ConsequenceKind; text: string } | null>(null);
  const [showBombFlash, setShowBombFlash] = useState(false);

  // Timers
  const [myTime, setMyTime] = useState(TIMER_SECS);
  const [oppTime, setOppTime] = useState(TIMER_SECS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTurn = useRef<string>("");

  // Track combat activation
  const prevCombatActive = useRef(false);
  useEffect(() => {
    if (combat?.is_active && !prevCombatActive.current) {
      setShowCombatModal(true);
      setCombatPhase("active");
      setSavedDefenderRank(null);
      setConsequence(null);
      setCombatBurst(true);
      setTimeout(() => setCombatBurst(false), 600);
    }
    prevCombatActive.current = combat?.is_active ?? false;
  }, [combat?.is_active]);

  // Timer logic
  useEffect(() => {
    if (!game || game.status === STATUS_FINISHED) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const myAddress = ACTIVE_PLAYER?.toLowerCase() ?? "";
    const isMyTurn = game.current_turn.toLowerCase() === myAddress;

    // Reset timer when turn changes
    if (game.current_turn !== prevTurn.current) {
      prevTurn.current = game.current_turn;
    }

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (isMyTurn) {
        setMyTime(t => {
          if (t <= 1) {
            // Auto-forfeit
            actions.forfeit(gameId).catch(() => {});
            return 0;
          }
          return t - 1;
        });
      } else {
        setOppTime(t => Math.max(0, t - 1));
      }
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [game?.current_turn, game?.status]);

  const handleForfeit = useCallback(async () => {
    if (!confirm("Surrender this campaign?")) return;
    setLoading(true);
    try { await actions.forfeit(gameId); await refetch(); }
    catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [actions, gameId, refetch]);

  if (!game || !ACTIVE_PLAYER) {
    return (
      <div className="game-frame">
        <div className="waiting-state"><div className="spinner" /><h3>Loading</h3></div>
      </div>
    );
  }
  if (game.status === STATUS_PLACING) {
    return (
      <div className="game-frame">
        <div className="waiting-state">
          <h3>Awaiting Deployment</h3>
          <div className="spinner" />
          <p>Both players must deploy their forces</p>
        </div>
      </div>
    );
  }

  const isP1 = ACTIVE_PLAYER.toLowerCase() === game.player1.toLowerCase();
  const myAddress = ACTIVE_PLAYER.toLowerCase();
  const isMyTurn = game.current_turn.toLowerCase() === myAddress;
  const isWinner = game.status === STATUS_FINISHED && game.winner.toLowerCase() === myAddress;

  const boardMap: Record<string, PieceState> = {};
  for (const p of pieces) {
    if (p.is_placed && p.is_alive) boardMap[`${p.x}_${p.y}`] = p;
  }

  function getPieceByCell(x: number, y: number) { return boardMap[`${x}_${y}`] ?? null; }

  function computeValidMoves(piece: PieceState): Record<string, CellMode> {
    const cells: Record<string, CellMode> = {};
    const rank = getRank(gameId, piece.piece_id);
    if (rank === 0 || rank === 11) return cells;

    if (rank === 2) {
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      for (const [dx, dy] of dirs) {
        let nx = piece.x + dx, ny = piece.y + dy;
        while (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
          if (LAKE_CELLS.has(`${nx}_${ny}`)) break;
          const occ = getPieceByCell(nx, ny);
          if (occ) { if (occ.owner.toLowerCase() !== myAddress) cells[`${nx}_${ny}`] = "attack"; break; }
          cells[`${nx}_${ny}`] = "move";
          nx += dx; ny += dy;
        }
      }
    } else {
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = piece.x + dx, ny = piece.y + dy;
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) continue;
        if (LAKE_CELLS.has(`${nx}_${ny}`)) continue;
        const occ = getPieceByCell(nx, ny);
        if (!occ) cells[`${nx}_${ny}`] = "move";
        else if (occ.owner.toLowerCase() !== myAddress) cells[`${nx}_${ny}`] = "attack";
      }
    }
    return cells;
  }

  function handlePieceClick(piece: PieceState) {
    if (!isMyTurn || loading || combat?.is_active) return;
    if (piece.owner.toLowerCase() !== myAddress) return;
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

    setLoading(true); setError(null);
    setSelectedPieceId(null); setValidCells({});

    try {
      const rank = getRank(gameId, selectedPieceId);
      const salt = getSalt(gameId, selectedPieceId);
      await actions.movePiece(gameId, selectedPieceId, x, y, rank, salt);

      if (isAttack) {
        setBlastCell(toKey);
        setTimeout(() => setBlastCell(null), 750);
      } else {
        if (fromKey) {
          setOriginCell(fromKey);
          setTimeout(() => setOriginCell(null), 5000);
        }
        setTrailCell(toKey);
        setTimeout(() => setTrailCell(null), 5000);
      }
      await refetch();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function handleResolveCombat() {
    if (!combat) return;
    setLoading(true); setError(null);

    // Get defender rank (we ARE the defender)
    const defRank = getRank(gameId, combat.defender_piece_id);
    const defSalt = getSalt(gameId, combat.defender_piece_id);
    const conseq = getConsequence(combat.attacker_rank, defRank);

    // Blast on defender cell
    const defPiece = pieces.find(p => p.piece_id === combat.defender_piece_id);
    if (defPiece) {
      const key = `${defPiece.x}_${defPiece.y}`;
      setBlastCell(key);
      setTimeout(() => setBlastCell(null), 750);
    }

    // Phase 1: flip animation
    setCombatPhase("flipping");

    try {
      await actions.resolveCombat(gameId, combat.defender_piece_id, defRank, defSalt);

      // After 700ms (flip completes), show revealed rank
      await new Promise(r => setTimeout(r, 700));
      setSavedDefenderRank(defRank);
      setCombatPhase("revealed");

      // After 500ms, show consequence
      await new Promise(r => setTimeout(r, 500));
      setConsequence(conseq);
      setCombatPhase("consequence");

      // Bomb special: flash screen
      if (conseq.kind === "bomb") {
        setShowBombFlash(true);
        setTimeout(() => setShowBombFlash(false), 800);
      }

      // Refetch while consequence is showing
      await refetch();

      // Auto-close after consequence
      await new Promise(r => setTimeout(r, 1800));
    } catch (e: unknown) {
      setError((e as Error).message);
      setCombatPhase("active");
    } finally {
      setLoading(false);
      setShowCombatModal(false);
      setCombatPhase("active");
      setSavedDefenderRank(null);
      setConsequence(null);
    }
  }

  const myPieces = pieces.filter(p => p.owner.toLowerCase() === myAddress && p.is_alive);
  const oppPieces = pieces.filter(p => p.owner.toLowerCase() !== myAddress && p.is_alive);
  const amDefender = combat?.is_active && pieces.find(p => p.piece_id === combat.defender_piece_id)?.owner.toLowerCase() === myAddress;

  const p1Addr = game.player1;
  const p2Addr = game.player2;
  const myAddr = myAddress;
  const oppAddr = isP1 ? p2Addr : p1Addr;
  const short = (a: string) => a ? `${a.slice(0, 5)}...${a.slice(-3)}` : "—";

  return (
    <>
      <div className="game-frame">
        {/* ── Left Panel ── */}
        <div className="side-panel">
          {/* MY card */}
          <div className={`player-card${isMyTurn ? " is-active" : ""}`}>
            <div className="player-card-name">You</div>
            <div className="player-card-addr">{short(myAddr)}</div>
            <div className="player-card-row">
              <div>
                <div className="info-card-label" style={{ fontSize: 7 }}>Forces</div>
                <div className="piece-count">{myPieces.length}</div>
              </div>
              <div className={`timer${isMyTurn ? " active" : ""}${myTime < 60 && isMyTurn ? " danger" : ""}`}>
                {formatTime(myTime)}
              </div>
            </div>
          </div>

          {/* OPPONENT card */}
          <div className={`player-card${!isMyTurn ? " is-active" : ""}`}>
            <div className="player-card-name">Opponent</div>
            <div className="player-card-addr">{short(oppAddr)}</div>
            <div className="player-card-row">
              <div>
                <div className="info-card-label" style={{ fontSize: 7 }}>Forces</div>
                <div className="piece-count enemy">{oppPieces.length}</div>
              </div>
              <div className={`timer${!isMyTurn ? " active" : ""}${oppTime < 60 && !isMyTurn ? " danger" : ""}`}>
                {formatTime(oppTime)}
              </div>
            </div>
          </div>

          {/* Turn badge */}
          {isMyTurn && !combat?.is_active && <span className="badge badge-your-turn">Your Move</span>}
          {!isMyTurn && !combat?.is_active && <span className="badge badge-waiting">Opponent's Turn</span>}
          {combat?.is_active && <span className="badge badge-pending">⚔ Combat</span>}

          {/* Turn counter */}
          <div className="info-card">
            <div className="info-card-label">Turn</div>
            <div className="info-card-value gold">{game.turn_count}</div>
          </div>
        </div>

        {/* ── Board ── */}
        <div className="board-container">
          <div className="board-frame">
            <div className="board">
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
                    <div
                      key={key}
                      className={cls}
                      onClick={() => {
                        if (isLake) return;
                        if (piece?.owner.toLowerCase() === myAddress) handlePieceClick(piece!);
                        else if (cellMode) handleCellClick(col, row);
                      }}
                    >
                      {piece && (
                        <PieceToken
                          piece={piece}
                          isOwn={piece.owner.toLowerCase() === myAddress}
                          gameId={gameId}
                          isSelected={!!isSelected}
                          isCombat={combat?.is_active && (combat.attacker_piece_id === piece.piece_id || combat.defender_piece_id === piece.piece_id)}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="side-panel">
          <div className="info-card">
            <div className="info-card-label">Game ID</div>
            <div className="info-card-value" style={{ fontSize: 9, opacity: 0.6, wordBreak: "break-all" }}>{gameId}</div>
          </div>
          {selectedPieceId !== null && (() => {
            const r = getRank(gameId, selectedPieceId);
            return (
              <div className="info-card">
                <div className="info-card-label">Selected Unit</div>
                <div className="info-card-value gold" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <RankIcon rank={r} size={16} />
                  {RANK_NAME[r] ?? "Unknown"}
                </div>
              </div>
            );
          })()}
          {error && <div className="error-msg">{error}</div>}
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm btn-danger" onClick={handleForfeit} disabled={loading}>
            Surrender
          </button>
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div className="status-bar">
        <div className="status-turn">
          {isMyTurn && !combat?.is_active && <><div className="turn-dot" /> YOUR TURN</>}
          {!isMyTurn && !combat?.is_active && <span style={{ color: "var(--text-dim)" }}>Awaiting opponent...</span>}
          {combat?.is_active && <><div className="turn-dot" style={{ background: "#c04040", boxShadow: "0 0 5px #c04040" }} /> COMBAT IN PROGRESS</>}
        </div>
        <div className="status-info">
          {selectedPieceId !== null
            ? "Highlighted squares: move or attack"
            : isMyTurn && !combat?.is_active
            ? "Click a piece to select it"
            : ""}
        </div>
      </div>

      {/* ── Bomb Flash ── */}
      {showBombFlash && <div className="bomb-flash" />}

      {/* ── Combat Modal ── */}
      {showCombatModal && (
        <div className={`combat-overlay${combatBurst ? " combat-burst" : ""}`}>
          <div className="combat-modal">
            <div className="combat-title">⚔ &nbsp; COMBAT &nbsp; ⚔</div>

            <div className="combat-pieces">
              {/* Attacker — always revealed */}
              <div className="combat-piece">
                <div className="combat-piece-label">Attacker</div>
                <div className="piece piece-own" style={{ width: 74, height: 74, borderRadius: 8 }}>
                  <div className="piece-icon">
                    <RankIcon rank={combat!.attacker_rank} size={28} />
                  </div>
                </div>
                <div className="combat-piece-name" style={{ color: "#90b8f0" }}>
                  {RANK_NAME[combat!.attacker_rank] ?? "Unknown"}
                </div>
              </div>

              <div className="combat-vs">VS</div>

              {/* Defender — flips to reveal */}
              <div className="combat-piece">
                <div className="combat-piece-label">Defender</div>
                <div className="rank-card">
                  <div className={`rank-card-inner${combatPhase === "revealed" || combatPhase === "consequence" ? " flipped" : ""}`}>
                    {/* Front — hidden */}
                    <div className="rank-face rank-face-front">
                      <div style={{ fontSize: 28, color: "#b88040", fontFamily: "var(--font-title)", fontWeight: 900 }}>?</div>
                    </div>
                    {/* Back — revealed rank */}
                    <div className="rank-face rank-face-back">
                      {savedDefenderRank !== null && (
                        <div className="piece-icon" style={{ color: "#ffb0b0" }}>
                          <RankIcon rank={savedDefenderRank} size={28} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="combat-piece-name">
                  {combatPhase === "revealed" || combatPhase === "consequence"
                    ? RANK_NAME[savedDefenderRank ?? 0] ?? "Unknown"
                    : "Rank Hidden"}
                </div>
              </div>
            </div>

            {/* Consequence display */}
            {combatPhase === "consequence" && consequence && (
              <div className="consequence-display">
                <div className={`consequence-text consequence-${consequence.kind}`}>
                  {consequence.text}
                </div>
              </div>
            )}

            {/* Action buttons */}
            {combatPhase === "active" && (
              amDefender ? (
                <>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text)", fontStyle: "italic", marginBottom: 18, letterSpacing: "0.05em" }}>
                    Reveal your rank to resolve the battle.
                  </p>
                  <button className="btn btn-primary" onClick={handleResolveCombat} disabled={loading}>
                    {loading ? "Revealing..." : "⚡ Reveal & Resolve"}
                  </button>
                </>
              ) : (
                <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-dim)", fontStyle: "italic", letterSpacing: "0.05em" }}>
                  Waiting for opponent to reveal their rank...
                </p>
              )
            )}

            {combatPhase === "flipping" && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-dim)", fontStyle: "italic" }}>
                Revealing...
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Game Over ── */}
      {game.status === STATUS_FINISHED && (
        <div className={`gameover-overlay ${isWinner ? "victory-overlay" : "defeat-overlay"}`}>
          <div className="gameover-skull">
            <SkullSVG />
          </div>
          <div className="gameover-modal">
            <span className="gameover-eyebrow">
              {isWinner ? "Mission Accomplished" : "Campaign Lost"}
            </span>
            <span className={`gameover-title ${isWinner ? "victory" : "defeat"}`}>
              {isWinner ? "VICTORY" : "DEFEAT"}
            </span>
            <span className="gameover-sub">
              {isWinner ? "The Flag Has Fallen" : "Your Flag Has Fallen"}
            </span>
            <div className="gameover-divider" />
            <button className="btn btn-primary" onClick={onLeave}>
              Return to Lobby
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Piece Token Component ──────────────────────────────────
function PieceToken({ piece, isOwn, gameId, isSelected, isCombat }: {
  piece: PieceState; isOwn: boolean; gameId: string; isSelected: boolean; isCombat: boolean | undefined;
}) {
  const rank = isOwn ? getRank(gameId, piece.piece_id) : piece.revealed_rank;
  const isRevealed = isOwn || piece.is_revealed;
  const iconSize = 18;

  let cls = "piece ";
  if (isOwn) cls += "piece-own";
  else if (piece.is_revealed) cls += "piece-enemy-revealed";
  else cls += "piece-hidden";

  if (isSelected || isCombat) cls += " piece-selected";

  return (
    <div className={cls}>
      <div className="piece-icon">
        {isRevealed
          ? <RankIcon rank={rank} size={iconSize} />
          : <QuestionIcon size={iconSize} />
        }
      </div>
      {isRevealed && (
        <div className="piece-rank-badge">{rank}</div>
      )}
    </div>
  );
}