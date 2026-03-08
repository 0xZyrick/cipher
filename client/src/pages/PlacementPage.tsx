import { computeCommitment, generateSalt, saveSalt, saveRank } from "../utils/commitment";
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
      <div className="placement-layout">
        <div className="waiting-state">
          <div className="spinner" />
          <h3>Loading Game</h3>
          <p>Game ID: <span style={{ color: "var(--gold-light)", fontFamily: "var(--font-ui)" }}>{gameId}</span></p>
        </div>
      </div>
    );
  }

  if (game.status === STATUS_ACTIVE) {
    onBattle();
    return null;
  }

  const isP1 = ACTIVE_PLAYER.toLowerCase() === game.player1.toLowerCase();
  const isP2 = ACTIVE_PLAYER.toLowerCase() === game.player2.toLowerCase();

  // Waiting for opponent to join
  if (game.status === STATUS_LOBBY || (!isP1 && !isP2)) {
    return (
      <div className="placement-layout">
        <div className="waiting-state">
          <h3>Waiting for Opponent</h3>
          <p>Share this Game ID:</p>
          <div className="game-id-display">{gameId}</div>
          <p style={{ fontSize: 13 }}>Ask your opponent to join with this ID</p>
          <div className="spinner" />
          <button className="btn btn-sm btn-danger" onClick={onLeave} style={{ marginTop: 16 }}>Leave</button>
        </div>
      </div>
    );
  }

  const myPieces = isP1 ? PIECES : P2_PIECES;
  const myMinRow = isP1 ? 0 : 6;
  const myMaxRow = isP1 ? 3 : 9;

  // Which of my pieces are already placed
  const placedPieceIds = new Set(
    pieces.filter(p => p.is_placed && p.owner.toLowerCase() === ACTIVE_PLAYER.toLowerCase())
      .map(p => p.piece_id)
  );

  // Board occupancy map for placed pieces
  const boardMap: Record<string, { piece_id: number; owner: string; rank: number; revealed: boolean }> = {};
  for (const p of pieces) {
    if (p.is_placed && p.is_alive) {
      boardMap[`${p.x}_${p.y}`] = {
        piece_id: p.piece_id,
        owner: p.owner,
        rank: p.revealed_rank,
        revealed: p.is_revealed,
      };
    }
  }

  const selectedPiece = selectedRackIdx !== null ? myPieces[selectedRackIdx] : null;
  const placedCount = placedPieceIds.size;
  const allPlaced = placedCount >= 10;

  async function handleCellClick(x: number, y: number) {
    if (!selectedPiece || loading) return;
    if (boardMap[`${x}_${y}`]) return; // occupied

    setLoading(true);
    setError(null);
    try {
      saveRank(gameId, selectedPiece.id, selectedPiece.rank);
      await actions.placePiece(gameId, selectedPiece.id, x, y, selectedPiece.rank);
      setSelectedRackIdx(null);
      await refetch();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReady() {
    setReadying(true);
    setError(null);
    try {
      await actions.ready(gameId);
      await refetch();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setReadying(false);
    }
  }

  const myPlaced = isP1 ? game.p1_pieces_placed : game.p2_pieces_placed;
  const oppPlaced = isP1 ? game.p2_pieces_placed : game.p1_pieces_placed;

  return (
    <div className="placement-layout">
      <div className="placement-header">
        <h2>Deploy Your Forces</h2>
        <p>Place your 10 pieces in {isP1 ? "rows 0–3 (top)" : "rows 6–9 (bottom)"}</p>
      </div>

      {/* Board */}
      <div className="board-container">
        <div className="board-frame">
          <div className="board">
            {Array.from({ length: BOARD_SIZE }, (_, row) =>
              Array.from({ length: BOARD_SIZE }, (_, col) => {
                const isMyZone = row >= myMinRow && row <= myMaxRow;
                const key = `${col}_${row}`;
                const occupant = boardMap[key];
                const isValidPlace = isMyZone && !occupant && selectedPiece;

                let cellClass = "cell";
                if (isP1 && row <= 3) cellClass += " zone-p1";
                else if (!isP1 && row >= 6) cellClass += " zone-p2";
                if (isValidPlace) cellClass += " valid-place";

                return (
                  <div
                    key={key}
                    className={cellClass}
                    data-col={col}
                    data-row={row}
                    onClick={() => isValidPlace && handleCellClick(col, row)}
                  >
                    {occupant && (
                      <div
                        className={`piece ${occupant.owner.toLowerCase() === ACTIVE_PLAYER.toLowerCase() ? "piece-p1" : "piece-hidden"}`}
                      >
                        {occupant.owner.toLowerCase() === ACTIVE_PLAYER.toLowerCase() ? (
                          <>
                            <span className="piece-rank">
                              {myPieces.find(p => p.id === occupant.piece_id)?.abbr ?? "?"}
                            </span>
                            <span className="piece-symbol">
                              {myPieces.find(p => p.id === occupant.piece_id)?.symbol ?? ""}
                            </span>
                          </>
                        ) : (
                          <span className="piece-rank">?</span>
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

      {/* Piece rack */}
      <div className="piece-rack">
        {myPieces.map((piece, idx) => {
          const isPlaced = placedPieceIds.has(piece.id);
          const isSelected = selectedRackIdx === idx;
          return (
            <div
              key={piece.id}
              className={`rack-piece ${isPlaced ? "placed" : ""} ${isSelected ? "selected-rack" : ""}`}
              onClick={() => !isPlaced && !loading && setSelectedRackIdx(isSelected ? null : idx)}
              data-tooltip={`${piece.name} (Rank ${piece.rank === 0 ? "Flag" : piece.rank === 11 ? "Bomb" : piece.rank})`}
            >
              <span className="rack-rank">{piece.abbr}</span>
              <span className="rack-name">{piece.name.slice(0, 3)}</span>
            </div>
          );
        })}
      </div>

      {/* Progress */}
      <div style={{ width: 520, maxWidth: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 10, letterSpacing: "0.2em", color: "var(--text-dim)" }}>
            YOUR FORCES: {myPlaced}/10
          </span>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 10, letterSpacing: "0.2em", color: "var(--text-dim)" }}>
            OPPONENT: {oppPlaced}/10
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(myPlaced / 10) * 100}%` }} />
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}

      <div style={{ display: "flex", gap: 12 }}>
        <button
          className="btn btn-primary"
          onClick={handleReady}
          disabled={!allPlaced || readying || loading}
        >
          {readying ? "Signaling Ready..." : allPlaced ? "⚔ Ready for Battle" : `Place ${10 - myPlaced} More`}
        </button>
        <button className="btn btn-sm btn-danger" onClick={onLeave}>Leave</button>
      </div>

      {selectedPiece && (
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--gold)", letterSpacing: "0.2em" }}>
          PLACING: {selectedPiece.name.toUpperCase()} — Click your zone to deploy
        </p>
      )}
    </div>
  );
}