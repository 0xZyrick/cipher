import { saveRank } from "../utils/commitment";
import { getActivePlayer } from "../player";
import { useState } from "react";
import { useGameState } from "../hooks/useGameState";
import { useActions } from "../hooks/useActions";
import { PIECES, P2_PIECES, STATUS_ACTIVE, STATUS_LOBBY } from "../config";

interface Props {
  gameId: string;
  onBattle: () => void;
  onLeave: () => void;
}

const BOARD_SIZE = 10;

// ── Rank icon SVGs (small, for slot corners) ─────────────
function RankIconSVG({ rank, color = "currentColor" }: { rank: number; color?: string }) {
  const s = color;
  switch (rank) {
    case 0: // Flag
      return <svg viewBox="0 0 16 16" fill={s}><line x1="3" y1="1" x2="3" y2="15" stroke={s} strokeWidth="1.4" strokeLinecap="round"/><path d="M3 1 L13 4.5 L3 8 Z"/></svg>;
    case 1: // Spy — eye
      return <svg viewBox="0 0 16 16" fill="none" stroke={s} strokeWidth="1.3" strokeLinecap="round"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2" fill={s}/></svg>;
    case 2: // Scout — zap
      return <svg viewBox="0 0 16 16" fill={s}><path d="M9 1L2 9h6l-1 6 7-8H8z"/></svg>;
    case 3: // Miner — pickaxe
      return <svg viewBox="0 0 16 16" fill="none" stroke={s} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2l4 4-7 7-2-2 2-1.5L4 6l1.5-2z" fill={s} fillOpacity="0.8"/><line x1="3" y1="13" x2="7" y2="9"/></svg>;
    case 4: // Sergeant — shield
      return <svg viewBox="0 0 16 16" fill={s}><path d="M8 1L2 4v4c0 3.5 2.5 6.7 6 7.5C11.5 14.7 14 11.5 14 8V4z" fillOpacity="0.85"/></svg>;
    case 5: // Lieutenant — 1 star
      return <svg viewBox="0 0 16 16" fill={s}><polygon points="8,2 9.5,6.5 14,6.5 10.5,9.5 11.8,14 8,11 4.2,14 5.5,9.5 2,6.5 6.5,6.5"/></svg>;
    case 6: // Captain — 2 stars
      return <svg viewBox="0 0 16 16" fill={s}><polygon points="5,2 6,5 9,5 6.8,6.8 7.5,10 5,8.2 2.5,10 3.2,6.8 1,5 4,5"/><polygon points="11,2 12,5 15,5 12.8,6.8 13.5,10 11,8.2 8.5,10 9.2,6.8 7,5 10,5"/></svg>;
    case 7: // Major — 3 stars (crown-ish)
      return <svg viewBox="0 0 16 16" fill={s}><polygon points="3,3 4.2,6.5 7,6.5 4.8,8.2 5.5,11.5 3,9.5 0.5,11.5 1.2,8.2 -1,6.5 1.8,6.5" transform="translate(2,0) scale(0.7)"/><polygon points="8,1 9.5,5 13,5 10.5,7.2 11.5,11 8,8.8 4.5,11 5.5,7.2 3,5 6.5,5"/><polygon points="3,3 4.2,6.5 7,6.5 4.8,8.2 5.5,11.5 3,9.5 0.5,11.5 1.2,8.2 -1,6.5 1.8,6.5" transform="translate(7,0) scale(0.7)"/></svg>;
    case 8: // Colonel — crown
      return <svg viewBox="0 0 16 16" fill={s}><path d="M1 12h14v2H1z" opacity="0.6"/><path d="M1 5l3 4 4-5 4 5 3-4v7H1z"/></svg>;
    case 9: // General — swords
      return <svg viewBox="0 0 16 16" fill="none" stroke={s} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="2" x2="12" y2="12"/><polyline points="2,2 2,5 5,2"/><line x1="14" y1="14" x2="12" y2="12"/><line x1="14" y1="2" x2="4" y2="12"/><polyline points="14,2 11,2 14,5"/><line x1="2" y1="14" x2="4" y2="12"/></svg>;
    case 10: // Marshal — double crown
      return <svg viewBox="0 0 16 16" fill={s}><path d="M1 13h14v1.5H1z" opacity="0.55"/><path d="M1 4.5l3 3.5 4-5 4 5 3-3.5v7H1z"/></svg>;
    case 11: // Bomb
      return <svg viewBox="0 0 16 16" fill={s}><circle cx="8" cy="10" r="5"/><line x1="8" y1="5" x2="8" y2="2" stroke={s} strokeWidth="1.4" strokeLinecap="round" fill="none"/><path d="M8 2 L11 3.5" stroke={s} strokeWidth="1.4" strokeLinecap="round" fill="none"/><circle cx="8" cy="10" r="1.8" fill="rgba(0,0,0,0.3)"/></svg>;
    default:
      return <svg viewBox="0 0 16 16" fill={s}><text x="8" y="12" textAnchor="middle" fontSize="10" fontFamily="Cinzel,serif" fontWeight="700">?</text></svg>;
  }
}

// ── Soldier silhouette (no rank text — displayed outside) ─
function SoldierSVG({ isSelected, isPlaced }: { isSelected: boolean; isPlaced: boolean }) {
  const bodyColor = isPlaced ? "rgba(80,65,35,0.4)" : isSelected ? "#c8902a" : "#6a90c0";
  return (
    <svg viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", display: "block" }}>
      {/* Helmet arc */}
      <path d="M7 13 Q14 4 21 13" fill={bodyColor} />
      {/* Head */}
      <ellipse cx="14" cy="14.5" rx="6" ry="6" fill={bodyColor} />
      {/* Helmet brim */}
      <rect x="6.5" y="19" width="15" height="2.8" rx="1.4" fill={bodyColor} opacity="0.9" />
      {/* Neck */}
      <rect x="11.8" y="21.8" width="4.4" height="2.5" fill={bodyColor} opacity="0.8" />
      {/* Torso */}
      <path d="M6.5 24.5 L5.5 39 L22.5 39 L21.5 24.5 Q14 22 6.5 24.5Z" fill={bodyColor} opacity="0.92" />
      {/* Left arm */}
      <rect x="1.5" y="25" width="6.5" height="3" rx="1.5" fill={bodyColor} opacity="0.82" transform="rotate(-12 4.8 26.5)" />
      {/* Right arm */}
      <rect x="20" y="25" width="6.5" height="3" rx="1.5" fill={bodyColor} opacity="0.82" transform="rotate(12 23.2 26.5)" />
    </svg>
  );
}

// ── Tiny soldier for board cells ──────────────────────────
function BoardSoldierSVG({ rank }: { rank: number }) {
  return (
    <svg viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg" style={{ width: "68%", height: "68%", display: "block" }}>
      <path d="M7 13 Q14 4 21 13" fill="#6a90c0" />
      <ellipse cx="14" cy="14.5" rx="6" ry="6" fill="#6a90c0" />
      <rect x="6.5" y="19" width="15" height="2.8" rx="1.4" fill="#5a80b0" opacity="0.9" />
      <rect x="11.8" y="21.8" width="4.4" height="2.5" fill="#6a90c0" opacity="0.8" />
      <path d="M6.5 24.5 L5.5 39 L22.5 39 L21.5 24.5 Q14 22 6.5 24.5Z" fill="#5a80b0" opacity="0.9" />
      <rect x="1.5" y="25" width="6.5" height="3" rx="1.5" fill="#5a80b0" opacity="0.8" transform="rotate(-12 4.8 26.5)" />
      <rect x="20" y="25" width="6.5" height="3" rx="1.5" fill="#5a80b0" opacity="0.8" transform="rotate(12 23.2 26.5)" />
      {/* Rank on chest */}
      <text x="14" y="34" textAnchor="middle" fontSize={rank >= 10 ? "6.5" : "8"} fontWeight="800"
        fontFamily="'Cinzel', serif" fill="#ddeeff">{rank === 0 ? "F" : rank === 11 ? "B" : String(rank)}</text>
    </svg>
  );
}

export function PlacementPage({ gameId, onBattle, onLeave }: Props) {
  const ACTIVE_PLAYER = getActivePlayer();
  const { game, pieces, refetch } = useGameState(gameId, 1500);
  const actions = useActions();

  const [selectedRackIdx, setSelectedRackIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readying, setReadying] = useState(false);

  if (!game || !ACTIVE_PLAYER) {
    return (
      <div className="vp-layout">
        <div className="waiting-state">
          <div className="spinner" />
          <h3>Loading Game</h3>
          <p>Game ID: <span style={{ color: "var(--gold-light)" }}>{gameId}</span></p>
        </div>
      </div>
    );
  }

  if (game.status === STATUS_ACTIVE) { onBattle(); return null; }

  const isP1 = ACTIVE_PLAYER.toLowerCase() === game.player1.toLowerCase();
  const isP2 = ACTIVE_PLAYER.toLowerCase() === game.player2.toLowerCase();

  if (game.status === STATUS_LOBBY || (!isP1 && !isP2)) {
    return (
      <div className="vp-layout">
        <div className="waiting-state">
          <h3>Waiting for Opponent</h3>
          <p>Share this Game ID:</p>
          <div className="game-id-display">{gameId}</div>
          <div className="spinner" />
          <button className="btn btn-sm btn-danger" onClick={onLeave} style={{ marginTop: 16 }}>Leave</button>
        </div>
      </div>
    );
  }

  const myPieces = isP1 ? PIECES : P2_PIECES;
  const myMinRow = isP1 ? 0 : 6;
  const myMaxRow = isP1 ? 3 : 9;

  const placedPieceIds = new Set(
    pieces.filter(p => p.is_placed && p.owner.toLowerCase() === ACTIVE_PLAYER.toLowerCase())
      .map(p => p.piece_id)
  );

  const boardMap: Record<string, { piece_id: number; owner: string; rank: number }> = {};
  for (const p of pieces) {
    if (p.is_placed && p.is_alive)
      boardMap[`${p.x}_${p.y}`] = { piece_id: p.piece_id, owner: p.owner, rank: p.revealed_rank };
  }

  const selectedPiece = selectedRackIdx !== null ? myPieces[selectedRackIdx] : null;
  const allPlaced = placedPieceIds.size >= 10;
  const myPlaced = isP1 ? game.p1_pieces_placed : game.p2_pieces_placed;
  const oppPlaced = isP1 ? game.p2_pieces_placed : game.p1_pieces_placed;

  async function handleCellClick(x: number, y: number) {
    if (!selectedPiece || loading || boardMap[`${x}_${y}`]) return;
    setLoading(true); setError(null);
    try {
      saveRank(gameId, selectedPiece.id, selectedPiece.rank);
      await actions.placePiece(gameId, selectedPiece.id, x, y, selectedPiece.rank);
      setSelectedRackIdx(null);
      await refetch();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function handleReady() {
    setReadying(true); setError(null);
    try { await actions.ready(gameId); await refetch(); }
    catch (e: unknown) { setError((e as Error).message); }
    finally { setReadying(false); }
  }

  return (
    <div className="vp-layout vp-row">

      {/* ══ LEFT PANEL ══ */}
      <div className="placement-panel">

        <div className="panel-section-title">YOUR FORCES</div>

        {/* 4-column inventory grid */}
        <div className="army-grid">
          {myPieces.map((piece, idx) => {
            const isPlaced = placedPieceIds.has(piece.id);
            const isSelected = selectedRackIdx === idx;
            return (
              <button
                key={piece.id}
                className={`army-slot${isSelected ? " army-slot--selected" : ""}${isPlaced ? " army-slot--placed" : ""}`}
                onClick={() => !isPlaced && !loading && setSelectedRackIdx(isSelected ? null : idx)}
                title={`${piece.name} · ${piece.rank === 0 ? "Flag" : piece.rank === 11 ? "Bomb" : "Rank " + piece.rank}`}
                disabled={loading}
              >
                {/* Rank number — top left, floating */}
                <div style={{
                  position: "absolute", top: 3, left: 4,
                  fontFamily: "var(--font-head)", fontWeight: 800,
                  fontSize: piece.rank >= 10 ? 9 : 11,
                  lineHeight: 1, letterSpacing: "-0.02em",
                  color: isPlaced ? "rgba(140,110,50,0.35)" : isSelected ? "#ffe8a0" : "#9ab8d8",
                  textShadow: isPlaced ? "none" : "0 1px 4px rgba(0,0,0,0.9)",
                  zIndex: 2,
                }}>
                  {piece.rank === 0 ? "F" : piece.rank === 11 ? "B" : piece.rank}
                </div>

                {/* Soldier silhouette — center, bigger */}
                <div style={{ width: "78%", height: "78%", position: "relative", zIndex: 1 }}>
                  <SoldierSVG isSelected={isSelected} isPlaced={isPlaced} />
                </div>

                {/* Rank icon — bottom right, small */}
                <div style={{
                  position: "absolute", bottom: 3, right: 3,
                  width: 12, height: 12,
                  color: isPlaced ? "rgba(140,110,50,0.3)" : isSelected ? "#c8902a" : "rgba(160,190,220,0.75)",
                  zIndex: 2,
                  filter: isPlaced ? "none" : isSelected ? "drop-shadow(0 0 3px rgba(200,148,26,0.6))" : "drop-shadow(0 1px 2px rgba(0,0,0,0.8))",
                }}>
                  <RankIconSVG rank={piece.rank} color="currentColor" />
                </div>

                {isPlaced && <div className="army-slot-placed-tick">✓</div>}
              </button>
            );
          })}
        </div>

        {/* Selected info */}
        <div className="panel-info-box">
          {selectedPiece ? (
            <>
              <span className="panel-info-label">PLACING</span>
              <span className="panel-info-value gold">{selectedPiece.name.toUpperCase()}</span>
              <span className="panel-info-label">
                {selectedPiece.rank === 0 ? "FLAG · CANNOT MOVE" : selectedPiece.rank === 11 ? "BOMB · CANNOT MOVE" : `RANK ${selectedPiece.rank}`}
              </span>
            </>
          ) : (
            <span className="panel-info-label">SELECT A UNIT TO PLACE</span>
          )}
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, justifyContent: "center" }}>
              <div className="spinner" style={{ width: 11, height: 11, borderWidth: 2 }} />
              <span className="panel-info-label" style={{ color: "var(--gold)", animation: "pulse 1s ease-in-out infinite" }}>
                DEPLOYING...
              </span>
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Progress */}
        <div className="panel-info-box">
          <div className="panel-progress-row">
            <span className="panel-info-label">YOU</span>
            <span className="panel-info-label" style={{ color: "var(--gold)" }}>{myPlaced}/10</span>
          </div>
          <div className="progress-bar" style={{ marginBottom: 7 }}>
            <div className="progress-fill" style={{ width: `${(myPlaced / 10) * 100}%` }} />
          </div>
          <div className="panel-progress-row">
            <span className="panel-info-label">OPPONENT</span>
            <span className="panel-info-label">{oppPlaced}/10</span>
          </div>
          <div className="progress-bar">
            <div style={{ height: "100%", background: "rgba(150,100,50,0.4)", width: `${(oppPlaced / 10) * 100}%`, transition: "width 0.4s" }} />
          </div>
        </div>

        {error && <div className="error-msg" style={{ fontSize: 9, marginTop: 4 }}>{error}</div>}

        <button
          className="btn btn-primary"
          onClick={handleReady}
          disabled={!allPlaced || readying || loading}
          style={{ width: "100%", justifyContent: "center", fontSize: 10, marginTop: 6 }}
        >
          {readying ? "Signaling..." : allPlaced ? "⚔ Ready for Battle" : `Place ${10 - myPlaced} More`}
        </button>
        <button
          className="btn btn-sm btn-danger"
          onClick={onLeave}
          style={{ width: "100%", justifyContent: "center", marginTop: 5 }}
        >
          Leave
        </button>
      </div>

      {/* ══ BOARD AREA ══ */}
      <div className="placement-board-area">
        <div className="placement-header">
          <h2>Deploy Your Forces</h2>
          <p>{isP1 ? "Your zone · rows 0–3 (green, top)" : "Your zone · rows 6–9 (green, bottom)"}</p>
        </div>

        <div className="board-container">
          <div className="board-frame">
            <div className="board">
              {Array.from({ length: BOARD_SIZE }, (_, row) =>
                Array.from({ length: BOARD_SIZE }, (_, col) => {
                  const isMyZone = row >= myMinRow && row <= myMaxRow;
                  const key = `${col}_${row}`;
                  const occupant = boardMap[key];
                  const isValidPlace = isMyZone && !occupant && !!selectedPiece && !loading;
                  const isDimmed = !!selectedPiece && !isMyZone;

                  let cellClass = "cell";
                  if (isP1 && row <= 3) cellClass += " zone-p1";
                  else if (!isP1 && row >= 6) cellClass += " zone-p2";
                  if (isValidPlace) cellClass += " valid-place";

                  const isOwn = occupant?.owner.toLowerCase() === ACTIVE_PLAYER.toLowerCase();
                  const myPieceData = occupant ? myPieces.find(p => p.id === occupant.piece_id) : null;

                  return (
                    <div
                      key={key}
                      className={cellClass}
                      onClick={() => isValidPlace && handleCellClick(col, row)}
                      style={isDimmed ? { opacity: 0.35, filter: "brightness(0.5)" } : undefined}
                    >
                      {occupant && (
                        <div className={`piece ${isOwn ? "piece-p1" : "piece-hidden"}`}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {isOwn && myPieceData ? (
                            <BoardSoldierSVG rank={myPieceData.rank} />
                          ) : (
                            <span style={{
                              fontFamily: "var(--font-head)",
                              fontSize: "calc(var(--cell) * 0.3)",
                              fontWeight: 700, color: "#b88040",
                            }}>C</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}