import { saveRank } from "../utils/commitment";
import { getActivePlayer } from "../player";
import { useState, useEffect } from "react";
import { useGameState } from "../hooks/useGameState";
import { useActions } from "../hooks/useActions";
import { PIECES, P2_PIECES, STATUS_LOBBY } from "../config";
import type { AccountInterface } from "starknet";
import { audioManager } from "../utils/audioManager";
import { voiceOver } from "../utils/voiceOver";

interface Props {
  gameId: string;
  playerAddress: string;
  account?: AccountInterface | null;
  onBattle: () => void;
  onLeave: () => void;
}

const BOARD_SIZE = 10;
const LAKE_CELLS = new Set(["2_4","3_4","2_5","3_5","6_4","7_4","6_5","7_5"]);

function DiamondIndicator() {
  return <span className="diamond-indicator"><img src="/assets/icons/diamond-indicator.webp" alt=""/></span>;
}

function HourglassIcon() {
  return (
    <svg className="hourglass" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2h14M5 22h14M6 2v4l5 4-5 4v4M18 2v4l-5 4 5 4v4"/>
    </svg>
  );
}

// ── Medallion Piece ───────────────────────────────────────
function MedallionPiece({ rank, isOwn, dimmed = false, size = "100%" }: {
  rank: number; isOwn: boolean; dimmed?: boolean; size?: string;
}) {
  const getAssetPath = () => {
    if (!isOwn) return "/assets/pieces/piece-hidden.webp";
    if (rank === 0) return "/assets/pieces/flag.webp";
    if (rank === 11) return "/assets/pieces/bomb.webp";
    return `/assets/pieces/rank-${rank}.png`;
  };
  const rankLabel = rank === 0 ? "F" : rank === 11 ? "B" : String(rank);
  return (
    <div style={{ width: size, height: size, position: "relative", opacity: dimmed ? 0.28 : 1, borderRadius: "50%" }}>
      <img
        src={getAssetPath()}
        alt={rankLabel}
        style={{ width: "100%", height: "100%", borderRadius: "50%", display: "block", objectFit: "cover", filter: dimmed ? "grayscale(0.8)" : "none" }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      {isOwn && (
        <div style={{
          position: "absolute", bottom: 0, right: 0,
          width: "32%", height: "32%", borderRadius: "50%",
          background: "rgba(0,0,0,0.75)", border: "1px solid rgba(201,168,76,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-head)", fontSize: "calc(var(--cell) * 0.15)",
          fontWeight: 700, color: "var(--gold-light)", lineHeight: 1,
          pointerEvents: "none", zIndex: 3,
        }}>
          {rankLabel}
        </div>
      )}
    </div>
  );
}

// ── Animated Water Lake — pure CSS, no image file needed ──
function ParchmentLake({ blobId }: { blobId: string }) {
  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 5, borderRadius: "10px", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 42% 38%, rgba(60,115,175,0.78) 0%, rgba(32,78,138,0.70) 50%, rgba(14,50,108,0.62) 100%)" }}/>
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(105deg, transparent 0px, transparent 18px, rgba(120,180,255,0.10) 18px, rgba(120,180,255,0.10) 20px)", animation: `wave-drift-a-${blobId} 5s linear infinite` }}/>
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(72deg, transparent 0px, transparent 12px, rgba(160,210,255,0.07) 12px, rgba(160,210,255,0.07) 14px)", animation: `wave-drift-b-${blobId} 3.5s linear infinite reverse` }}/>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 25%, rgba(180,225,255,0.22) 0%, transparent 55%)", animation: `shimmer-pulse-${blobId} 3s ease-in-out infinite alternate` }}/>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 50%, rgba(140,100,40,0.38) 100%)", borderRadius: "10px" }}/>
      <style>{`
        @keyframes wave-drift-a-${blobId} { from{background-position:0 0} to{background-position:40px 20px} }
        @keyframes wave-drift-b-${blobId} { from{background-position:0 0} to{background-position:-28px 14px} }
        @keyframes shimmer-pulse-${blobId} { from{opacity:0.6} to{opacity:1} }
      `}</style>
    </div>
  );
}

export function PlacementPage({ gameId, playerAddress, account, onBattle, onLeave }: Props) {
  const ACTIVE_PLAYER = playerAddress || getActivePlayer();
  const normalize = (addr: string) => "0x" + BigInt(addr).toString(16).padStart(64, "0");
  const { game, pieces, refetch } = useGameState(gameId, 1500);
  const actions = useActions(account);

  const [selectedRackIdx, setSelectedRackIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readying, setReadying] = useState(false);

  // Voice cue only — music continues during placement
  useEffect(() => {
    voiceOver.play("deployMen", { delay: 800 });
  }, []);

  if (!game || !ACTIVE_PLAYER) {
    return (
      <div className="vp-layout">
        <div className="waiting-state">
          <div className="dot-loader"><span/><span/><span/></div>
          <h3>Loading Game</h3>
          <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic" }}>
            Game ID: <span style={{ color: "var(--gold-light)" }}>{gameId}</span>
          </p>
        </div>
      </div>
    );
  }

  const isP1 = normalize(ACTIVE_PLAYER) === normalize(game.player1);
  const isP2 = normalize(ACTIVE_PLAYER) === normalize(game.player2);

  if (game.status === STATUS_LOBBY || (!isP1 && !isP2)) {
    return (
      <div className="vp-layout">
        <div className="waiting-state">
          <div style={{
            width: "min(420px, 70vw)", aspectRatio: "16 / 5",
            backgroundImage: "url('/assets/ui/cipher-plaque.webp')",
            backgroundSize: "contain", backgroundRepeat: "no-repeat",
            backgroundPosition: "center", marginBottom: 8,
            filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.7))",
          }} aria-hidden="true"/>
          <h3>Waiting for Opponent</h3>
          <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic" }}>Share this Game ID with your opponent</p>
          <div className="game-id-display">
            <span style={{ color: "var(--amber)", marginRight: 8 }}>▶</span>{gameId}
          </div>
          <HourglassIcon/>
          <button className="btn btn-danger btn-sm" onClick={() => { audioManager.playSFX("click"); onLeave(); }} style={{ marginTop: 16 }}>
            Leave
          </button>
        </div>
      </div>
    );
  }

  const myPieces = isP1 ? PIECES : P2_PIECES;
  const myMinRow = isP1 ? 0 : 6;
  const myMaxRow = isP1 ? 3 : 9;

  const placedPieceIds = new Set(
    pieces.filter(p => p.is_placed && normalize(p.owner) === normalize(ACTIVE_PLAYER)).map(p => p.piece_id)
  );
  const boardMap: Record<string, { piece_id: number; owner: string; rank: number }> = {};
  for (const p of pieces) {
    if (p.is_placed && p.is_alive) boardMap[`${p.x}_${p.y}`] = { piece_id: p.piece_id, owner: p.owner, rank: p.revealed_rank };
  }

  const selectedPiece = selectedRackIdx !== null ? myPieces[selectedRackIdx] : null;
  const allPlaced = placedPieceIds.size >= 10;
  const myPlaced = isP1 ? game.p1_pieces_placed : game.p2_pieces_placed;
  const oppPlaced = isP1 ? game.p2_pieces_placed : game.p1_pieces_placed;

  const boardRotation = isP1 ? "rotate(180deg)" : "none";
  const cellCounterRotation = isP1 ? "rotate(180deg)" : undefined;

  async function handleCellClick(x: number, y: number) {
    if (!selectedPiece || loading || boardMap[`${x}_${y}`]) return;
    setLoading(true); setError(null);
    try {
      saveRank(gameId, selectedPiece.id, selectedPiece.rank);
      await actions.placePiece(gameId, selectedPiece.id, x, y, selectedPiece.rank);
      audioManager.playSFX("deploy");
      const newCount = placedPieceIds.size + 1;
      if (newCount === 10) voiceOver.play("allDeployed", { delay: 300 });
      else if (newCount % 3 === 0) voiceOver.play("pieceDeployed");
      setSelectedRackIdx(null);
      await refetch();
    } catch (e: unknown) { audioManager.playSFX("error"); setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function handleReady() {
    setReadying(true); setError(null);
    try { audioManager.playSFX("click"); await actions.ready(gameId); await refetch(); }
    catch (e: unknown) { audioManager.playSFX("error"); setError((e as Error).message); }
    finally { setReadying(false); }
  }

  async function handleAutoFill() {
    const unplaced = myPieces.filter(p => !placedPieceIds.has(p.id));
    if (unplaced.length === 0) return;
    const emptyZoneCells: { x: number; y: number }[] = [];
    for (let row = myMinRow; row <= myMaxRow; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (!boardMap[`${col}_${row}`]) emptyZoneCells.push({ x: col, y: row });
      }
    }
    const shuffled = [...emptyZoneCells].sort(() => Math.random() - 0.5);
    setLoading(true); setError(null); audioManager.playSFX("click");
    try {
      for (let i = 0; i < unplaced.length && i < shuffled.length; i++) {
        const piece = unplaced[i]; const { x, y } = shuffled[i];
        saveRank(gameId, piece.id, piece.rank);
        await actions.placePiece(gameId, piece.id, x, y, piece.rank);
        audioManager.playSFX("deploy");
      }
      voiceOver.play("allDeployed", { delay: 400 });
      await refetch();
    } catch (e: unknown) { audioManager.playSFX("error"); setError((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div className="vp-layout vp-row page-enter">

      {/* ══ LEFT PANEL — Your Forces ══ */}
      <div className="placement-panel">

        {/* Section title */}
        <div className="placement-panel-title">
          <DiamondIndicator /> Your Forces
        </div>

        {/* 3-column piece grid */}
        <div className="army-grid">
          {myPieces.map((piece, idx) => {
            const isPlaced = placedPieceIds.has(piece.id);
            const isSelected = selectedRackIdx === idx;
            return (
              <button
                key={piece.id}
                className={`army-slot${isSelected ? " army-slot--selected" : ""}${isPlaced ? " army-slot--placed" : ""}`}
                onClick={() => { if (!isPlaced && !loading) { audioManager.playSFX("click"); setSelectedRackIdx(isSelected ? null : idx); } }}
                title={`${piece.name} · ${piece.rank === 0 ? "Flag" : piece.rank === 11 ? "Bomb" : "Rank " + piece.rank}`}
                disabled={loading}
              >
                <MedallionPiece rank={piece.rank} isOwn={true} dimmed={isPlaced} size="88%"/>
                {isPlaced && <div className="army-slot-placed-tick">✓</div>}
              </button>
            );
          })}
        </div>

        {/* Selected piece indicator */}
        {selectedPiece && (
          <div className="placement-selected-info">
            <DiamondIndicator/> PLACING — {selectedPiece.name.toUpperCase()}
          </div>
        )}
        {loading && (
          <div className="placement-deploying-info">
            <div className="dot-loader" style={{ transform: "scale(0.7)" }}><span/><span/><span/></div>
            DEPLOYING...
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Auto Fill button */}
        <button
          className="btn btn-secondary placement-auto-fill"
          onClick={handleAutoFill}
          disabled={loading || allPlaced}
        >
          <DiamondIndicator />
          {loading ? "Filling..." : "Auto Fill"}
        </button>

        {/* Leave Game button */}
        <button
          className="btn btn-danger placement-leave-btn"
          onClick={() => { audioManager.playSFX("click"); onLeave(); }}
        >
          Leave Game
        </button>

        {/* Progress — Your Forces */}
        <div className="placement-progress-block">
          <DiamondIndicator />
          <span className="placement-progress-label">Your Forces</span>
          <div className="placement-progress-bar">
            <div className="placement-progress-fill" style={{ width: `${(myPlaced / 10) * 100}%` }} />
          </div>
          <div className="placement-progress-row">
            <span className="placement-progress-sub">Placed:</span>
            <span className="placement-progress-count">{myPlaced}/10</span>
          </div>
        </div>

        {/* Ready for Battle — in left panel */}
        <button
          className="btn btn-primary"
          onClick={allPlaced && !readying ? handleReady : undefined}
          disabled={!allPlaced || readying || loading}
          style={{ width: "100%", justifyContent: "center", fontSize: 11, display: "flex", alignItems: "center", gap: 8 }}
        >
          <DiamondIndicator />
          {readying ? "Signalling..." : allPlaced ? "Ready for Battle" : `Place ${10 - myPlaced} More`}
        </button>

        {error && <div className="error-msg" style={{ fontSize: 10, marginTop: 4 }}>{error}</div>}
      </div>

      {/* ══ BOARD AREA ══ */}
      <div className="placement-board-area">
        <div className="board-container">
          <div className="board-frame">
            <div className="board" style={{ position: "relative", transform: boardRotation }}>
              {Array.from({ length: BOARD_SIZE }, (_, row) =>
                Array.from({ length: BOARD_SIZE }, (_, col) => {
                  const isMyZone = row >= myMinRow && row <= myMaxRow;
                  const key = `${col}_${row}`;
                  const isLake = LAKE_CELLS.has(key);
                  const occupant = isLake ? undefined : boardMap[key];
                  const isValidPlace = !isLake && isMyZone && !occupant && !!selectedPiece && !loading;
                  const isDimmed = !!selectedPiece && !isMyZone && !isLake;

                  let cellClass = "cell";
                  if (isLake) cellClass += " lake-cell";
                  else {
                    if (isP1 && row <= 3) cellClass += " zone-p1";
                    else if (!isP1 && row >= 6) cellClass += " zone-p2";
                    if (isValidPlace) cellClass += " valid-place";
                  }

                  const isOwn = normalize(occupant?.owner ?? "0x0") === normalize(ACTIVE_PLAYER);
                  const myPieceData = occupant ? myPieces.find(p => p.id === occupant.piece_id) : null;

                  return (
                    <div
                      key={key} className={cellClass}
                      style={cellCounterRotation ? {
                        transform: cellCounterRotation,
                        ...(isDimmed ? { opacity: 0.35, filter: "brightness(0.6)" } : {})
                      } : isDimmed ? { opacity: 0.35, filter: "brightness(0.6)" } : undefined}
                      onClick={() => !isLake && isValidPlace && handleCellClick(col, row)}
                    >
                      {occupant && (
                        <div style={{ width: "calc(var(--cell) * 0.88)", height: "calc(var(--cell) * 0.88)", position: "relative" }}>
                          {isOwn && myPieceData ? (
                            <MedallionPiece rank={myPieceData.rank} isOwn={true} size="100%"/>
                          ) : (
                            <MedallionPiece rank={occupant.rank} isOwn={false} dimmed={true} size="100%"/>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {/* Lakes */}
              <div style={{ position: "absolute", left: "calc(2 * var(--cell) + 2px)", top: "calc(4 * var(--cell) + 4px)", width: "calc(2 * var(--cell) + 1px)", height: "calc(2 * var(--cell) + 1px)", overflow: "visible", pointerEvents: "none" }}>
                <ParchmentLake blobId="pl"/>
              </div>
              <div style={{ position: "absolute", left: "calc(6 * var(--cell) + 6px)", top: "calc(4 * var(--cell) + 4px)", width: "calc(2 * var(--cell) + 1px)", height: "calc(2 * var(--cell) + 1px)", overflow: "visible", pointerEvents: "none" }}>
                <ParchmentLake blobId="pr"/>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ RIGHT PANEL — Opponent ══ */}
      <div className="placement-opponent-panel">
        <div className="placement-panel-title opp">
          <DiamondIndicator /> Opponent
        </div>
        <div className="placement-opp-avatar">
          <img src="/assets/profile/opponent.webp" alt="" className="profile-avatar" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}/>
        </div>
        <div className="placement-progress-block">
          <div className="placement-progress-row">
            <span className="placement-progress-sub">Placed:</span>
            <span className="placement-progress-count">{oppPlaced}/10</span>
          </div>
          <div className="placement-progress-bar">
            <div className="placement-progress-fill opp" style={{ width: `${(oppPlaced / 10) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}