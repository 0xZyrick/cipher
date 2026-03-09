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

  // Floating combat labels
  type FloatLabel = { id: number; text: string; cellKey: string };
  const [floatingLabels, setFloatingLabels] = useState<FloatLabel[]>([]);
  const floatIdRef = useRef(0);

  const emitFloat = useCallback((text: string, cellKey: string) => {
    const id = ++floatIdRef.current;
    setFloatingLabels(prev => [...prev, { id, text, cellKey }]);
    setTimeout(() => setFloatingLabels(prev => prev.filter(f => f.id !== id)), 2800);
  }, []);

  // ── Auto-resolve combat (no modal) ────────────────────────
  const handleResolveCombat = useCallback(async () => {
    if (!combat) return;
    setLoading(true); setError(null);
    const defRank = getRank(gameId, combat.defender_piece_id);
    const defSalt = getSalt(gameId, combat.defender_piece_id);
    const conseq = getConsequence(combat.attacker_rank, defRank);
    const defPiece = pieces.find(p => p.piece_id === combat.defender_piece_id);
    const floatText = conseq.kind === 'bomb' ? '💥 BOMB!'
      : conseq.kind === 'draw' ? '⚖ DRAW!'
      : conseq.kind === 'spy_marshal' ? '☠ SILENCED!'
      : combat.attacker_rank > defRank ? '💀 DESTROYED!'
      : '💀 DEFEATED!';
    try {
      await actions.resolveCombat(gameId, combat.defender_piece_id, defRank, defSalt);
      if (defPiece) {
        const key = `${defPiece.x}_${defPiece.y}`;
        setBlastCell(key);
        setTimeout(() => setBlastCell(null), 900);
        emitFloat(floatText, key);
      }
      if (conseq.kind === 'bomb') {
        setShowBombFlash(true);
        setTimeout(() => setShowBombFlash(false), 800);
      }
      await refetch();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [combat, pieces, gameId, actions, refetch, emitFloat]);

  const resolveRef = useRef(handleResolveCombat);
  resolveRef.current = handleResolveCombat;

  // Detect when we are the defender and auto-resolve
  const prevCombatKeyRef = useRef('');
  useEffect(() => {
    if (!combat?.is_active) { prevCombatKeyRef.current = ''; return; }
    const defPiece = pieces.find(p => p.piece_id === combat.defender_piece_id);
    const isWeDefender = defPiece?.owner.toLowerCase() === (ACTIVE_PLAYER?.toLowerCase() ?? '');
    if (!isWeDefender) return;
    const cKey = `${combat.attacker_piece_id}-${combat.defender_piece_id}`;
    if (prevCombatKeyRef.current === cKey) return;
    prevCombatKeyRef.current = cKey;
    const t = setTimeout(() => resolveRef.current(), 550);
    return () => clearTimeout(t);
  }, [combat?.is_active, combat?.attacker_piece_id, combat?.defender_piece_id, pieces]);

  // Battle commencing banner
  const [showCommencing, setShowCommencing] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowCommencing(false), 2400);
    return () => clearTimeout(t);
  }, []);

  // Combat / animation states
  const [showBombFlash, setShowBombFlash] = useState(false);

  // Timers
  const [myTime, setMyTime] = useState(TIMER_SECS);
  const [oppTime, setOppTime] = useState(TIMER_SECS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTurn = useRef<string>("");

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

  const myPieces = pieces.filter(p => p.owner.toLowerCase() === myAddress && p.is_alive);
  const oppPieces = pieces.filter(p => p.owner.toLowerCase() !== myAddress && p.is_alive);

  const p1Addr = game.player1;
  const p2Addr = game.player2;
  const myAddr = myAddress;
  const oppAddr = isP1 ? p2Addr : p1Addr;
  const short = (a: string) => a ? `${a.slice(0, 5)}...${a.slice(-3)}` : "—";

  return (
    <>
      {/* ── Battle Commencing Banner ── */}
      {showCommencing && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
          background: "radial-gradient(ellipse at center, rgba(20,10,5,0.92) 0%, rgba(0,0,0,0.97) 100%)",
          animation: "commencingFadeOut 2.4s ease-out forwards",
          pointerEvents: "none",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: "var(--font-title)", fontSize: "clamp(28px, 5vw, 56px)", fontWeight: 900,
              color: "#c8902a", letterSpacing: "0.25em",
              animation: "commencingPulse 0.8s ease-in-out 3",
            }}>⚔ BATTLE COMMENCING ⚔</div>
            <div style={{
              fontFamily: "var(--font-ui)", fontSize: 13, letterSpacing: "0.3em",
              color: "var(--text-dim)", marginTop: 14,
            }}>DEPLOY YOUR STRATEGY</div>
          </div>
        </div>
      )}

      <div className="game-frame">
        {/* ── Left Panel ── */}
        <div className="side-panel" style={{
          background: "linear-gradient(180deg, rgba(20,14,8,0.97) 0%, rgba(12,8,4,0.99) 100%)",
          borderRight: "1px solid rgba(184,130,26,0.18)",
          boxShadow: "inset -4px 0 16px rgba(0,0,0,0.5)",
        }}>
          {/* MY card */}
          <div className={`player-card${isMyTurn ? " is-active" : ""}`}>
            <div className="player-card-name">You</div>
            <div className="player-card-addr">{short(myAddr)}</div>
            <div className="player-card-row">
              <div>
                <div className="piece-count-label">Forces</div>
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
                <div className="piece-count-label">Forces</div>
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
            <div className="board" style={{ position: 'relative' }}>
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
                      {floatingLabels.filter(f => f.cellKey === key).map(f => (
                        <div key={f.id} style={{
                          position: "absolute", top: '-4px', left: '50%',
                          transform: "translateX(-50%)",
                          zIndex: 50, pointerEvents: "none",
                          background: "rgba(90,6,6,0.94)",
                          border: "1px solid rgba(220,55,55,0.5)",
                          padding: "4px 10px", borderRadius: "3px",
                          fontFamily: "var(--font-head)", fontSize: 14, fontWeight: 900,
                          color: "#ff9090", textShadow: "0 1px 0 rgba(0,0,0,0.9)",
                          letterSpacing: "0.06em", whiteSpace: "nowrap",
                          animation: "floatUp 2.8s ease-out forwards",
                        }}>{f.text}</div>
                      ))}
                    </div>
                  );
                })
              )}
              {/* Lake blobs — irregular water SVG shapes */}
              <div style={{
                position: 'absolute',
                left: 'calc(2 * var(--cell) + 2px)', top: 'calc(4 * var(--cell) + 4px)',
                width: 'calc(2 * var(--cell) + 1px)', height: 'calc(2 * var(--cell) + 1px)',
                overflow: 'visible', pointerEvents: 'none',
              }}>
                <LakeBlob blobId="left" />
              </div>
              <div style={{
                position: 'absolute',
                left: 'calc(6 * var(--cell) + 6px)', top: 'calc(4 * var(--cell) + 4px)',
                width: 'calc(2 * var(--cell) + 1px)', height: 'calc(2 * var(--cell) + 1px)',
                overflow: 'visible', pointerEvents: 'none',
              }}>
                <LakeBlob blobId="right" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="side-panel" style={{
          background: "linear-gradient(180deg, rgba(20,14,8,0.97) 0%, rgba(12,8,4,0.99) 100%)",
          borderLeft: "1px solid rgba(184,130,26,0.18)",
          boxShadow: "inset 4px 0 16px rgba(0,0,0,0.5)",
        }}>
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

// ── Chunky Soldier Silhouette with depth gradient ─────────
function SoldierSilhouetteSVG({ pieceId, isOwn, dimmed = false }: {
  pieceId: number; isOwn: boolean; dimmed?: boolean;
}) {
  const gradId = `sg-${pieceId}`;
  const vlight = isOwn ? '#4a7acc' : '#cc4a4a';
  const light  = isOwn ? '#1e4a9a' : '#9a1e1e';
  const main   = isOwn ? '#0d2d6a' : '#6a0d0d';
  const dark   = isOwn ? '#050e22' : '#220505';
  const op = dimmed ? 0.45 : 1;

  return (
    <svg viewBox="0 0 44 58" xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0.12" y1="0" x2="0.9" y2="1">
          <stop offset="0%"   stopColor={vlight} stopOpacity={op}/>
          <stop offset="38%"  stopColor={light}  stopOpacity={op}/>
          <stop offset="72%"  stopColor={main}   stopOpacity={op}/>
          <stop offset="100%" stopColor={dark}   stopOpacity={op}/>
        </linearGradient>
      </defs>
      {/* Ground shadow */}
      <ellipse cx="22" cy="57" rx="14" ry="2.2" fill="rgba(0,0,0,0.38)" opacity={op}/>
      {/* Left leg */}
      <rect x="10" y="37" width="10" height="18" rx="4.5" fill={`url(#${gradId})`}/>
      {/* Right leg */}
      <rect x="24" y="37" width="10" height="18" rx="4.5" fill={`url(#${gradId})`}/>
      {/* Crotch bridge */}
      <rect x="10" y="37" width="24" height="7" rx="2.5" fill={main} opacity={dimmed ? 0.5 : 0.95}/>
      {/* Torso — wide solid block */}
      <rect x="6" y="19" width="32" height="20" rx="6.5" fill={`url(#${gradId})`}/>
      {/* Left arm */}
      <rect x="0.5" y="20" width="8" height="16" rx="4" fill={`url(#${gradId})`}/>
      {/* Right arm */}
      <rect x="35.5" y="20" width="8" height="16" rx="4" fill={`url(#${gradId})`}/>
      {/* Neck */}
      <rect x="16" y="15.5" width="12" height="6.5" rx="3" fill={main} opacity={dimmed ? 0.5 : 0.95}/>
      {/* Head */}
      <ellipse cx="22" cy="11" rx="12.5" ry="11" fill={`url(#${gradId})`}/>
      {/* Helmet dome */}
      <path d="M9.5,11 Q9.5,-0.5 22,-1 Q34.5,-0.5 34.5,11" fill={vlight} opacity={dimmed ? 0.2 : 0.52}/>
      {/* Helmet brim */}
      <rect x="7.5" y="17.5" width="29" height="3.5" rx="1.75" fill={light} opacity={dimmed ? 0.18 : 0.44}/>
      {/* Face highlight (gives depth) */}
      <ellipse cx="17" cy="9" rx="4" ry="5.5" fill="white" opacity={dimmed ? 0.02 : 0.08}/>
      {/* Torso highlight */}
      <rect x="10" y="22" width="12" height="11" rx="4.5" fill="white" opacity={dimmed ? 0.01 : 0.055}/>
    </svg>
  );
}

// ── Irregular lake SVG blob ────────────────────────────────
function LakeBlob({ blobId }: { blobId: string }) {
  const gradId = `lakeG-${blobId}`;
  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 5, overflow: 'visible' }}
      viewBox="0 0 200 200" preserveAspectRatio="none"
    >
      <defs>
        <radialGradient id={gradId} cx="40%" cy="33%" r="62%">
          <stop offset="0%"   stopColor="rgba(195,238,255,0.97)"/>
          <stop offset="32%"  stopColor="rgba(80,185,238,0.92)"/>
          <stop offset="68%"  stopColor="rgba(32,120,195,0.87)"/>
          <stop offset="100%" stopColor="rgba(15,80,150,0.82)"/>
        </radialGradient>
      </defs>
      {/* Irregular organic blob path */}
      <path
        d="M24,102 C10,72 16,32 48,16 C70,5 108,0 134,18 C158,35 188,44 194,78 C200,110 190,152 162,166 C138,178 98,192 66,180 C36,168 10,148 6,118 C4,112 14,116 24,102 Z"
        fill={`url(#${gradId})`}
      />
      {/* Top shimmer */}
      <path d="M40,28 C56,16 84,12 110,24 C92,40 64,38 40,28 Z" fill="rgba(255,255,255,0.32)"/>
      {/* Bottom shimmer */}
      <ellipse cx="145" cy="150" rx="24" ry="10" fill="rgba(255,255,255,0.11)" transform="rotate(-28,145,150)"/>
    </svg>
  );
}

// ── Helper ─────────────────────────────────────────────────
function getWinnerSide(kind: ConsequenceKind, attRank: number, defRank: number): 'attacker' | 'defender' | 'draw' {
  if (kind === 'draw') return 'draw';
  if (kind === 'bomb') return 'defender';
  if (kind === 'spy_marshal') return 'attacker';
  return attRank > defRank ? 'attacker' : 'defender';
}

// ── Piece Token Component ──────────────────────────────────
function PieceToken({ piece, isOwn, gameId, isSelected, isCombat }: {
  piece: PieceState; isOwn: boolean; gameId: string; isSelected: boolean; isCombat: boolean | undefined;
}) {
  const rank = isOwn ? getRank(gameId, piece.piece_id) : piece.revealed_rank;
  const isRevealed = isOwn || piece.is_revealed;

  let cls = 'piece ';
  if (isOwn) cls += 'piece-own';
  else if (piece.is_revealed) cls += 'piece-enemy-revealed';
  else cls += 'piece-hidden';
  if (isSelected || isCombat) cls += ' piece-selected';

  const rankLabel = rank === 0 ? 'F' : rank === 11 ? 'B' : rank;

  return (
    <div className={cls}>
      {/* Chunky silhouette fills whole piece */}
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <SoldierSilhouetteSVG pieceId={piece.piece_id} isOwn={isOwn} dimmed={!isRevealed && !isOwn} />

        {/* Rank number — top-left corner */}
        {isRevealed && (
          <div style={{
            position: 'absolute', top: 0, left: 2,
            fontFamily: 'var(--font-head)', fontWeight: 900,
            fontSize: 'calc(var(--cell) * 0.26)',
            color: isOwn ? '#deeeff' : '#ffdede',
            textShadow: '0 1px 4px rgba(0,0,0,0.95)',
            lineHeight: 1, zIndex: 5, letterSpacing: '-0.03em',
            pointerEvents: 'none',
          }}>
            {rankLabel}
          </div>
        )}

        {/* Rank icon — bottom-right corner, outside silhouette body */}
        {isRevealed && (
          <div style={{
            position: 'absolute', bottom: 1, right: 1,
            zIndex: 5, pointerEvents: 'none',
            color: isOwn ? '#90b8f8' : '#f89090',
            filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))',
          }}>
            <RankIcon rank={rank} size={Math.round(Math.max(12, Math.min(18, 16)))} />
          </div>
        )}
      </div>
    </div>
  );
}