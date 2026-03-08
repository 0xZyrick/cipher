import { useEffect, useState, useCallback } from "react";
import { TORII_URL } from "../config";

export interface GameState {
  game_id: string;
  player1: string;
  player2: string;
  status: number;
  current_turn: string;
  turn_count: number;
  p1_pieces_placed: number;
  p2_pieces_placed: number;
  winner: string;
}

export interface PieceState {
  game_id: string;
  piece_id: number;
  owner: string;
  x: number;
  y: number;
  rank_commitment: string;
  revealed_rank: number;
  is_alive: boolean;
  is_revealed: boolean;
  is_placed: boolean;
}

export interface CombatState {
  game_id: string;
  is_active: boolean;
  attacker_piece_id: number;
  attacker_rank: number;
  defender_piece_id: number;
  from_x: number;
  from_y: number;
  to_x: number;
  to_y: number;
}

async function toriiQuery(query: string) {
  try {
    const res = await fetch(`${TORII_URL}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

function hexToNum(hex: unknown): number {
  if (hex === true) return 1;
  if (hex === false) return 0;
  if (typeof hex === "number") return hex;
  if (typeof hex !== "string") return 0;
  if (!hex) return 0;
  if (hex === "true") return 1;
  if (hex === "false") return 0;
  return parseInt(hex, 16);
}

// Normalize any game ID to hex format that Torii uses e.g. "1" -> "0x1"
function normalizeId(id: string): string {
  if (!id) return "0x0";
  if (id.startsWith("0x")) return id;
  return "0x" + parseInt(id).toString(16);
}

function parseGame(node: Record<string, unknown>): GameState | null {
  if (!node) return null;
  return {
    game_id:           String(node.game_id           ?? "0"),
    player1:           String(node.player1           ?? "0x0"),
    player2:           String(node.player2           ?? "0x0"),
    status:            hexToNum(node.status),
    current_turn:      String(node.current_turn      ?? "0x0"),
    turn_count:        hexToNum(node.turn_count),
    p1_pieces_placed:  hexToNum(node.p1_pieces_placed),
    p2_pieces_placed:  hexToNum(node.p2_pieces_placed),
    winner:            String(node.winner            ?? "0x0"),
  };
}

function parsePiece(node: Record<string, unknown>): PieceState {
  return {
    game_id:         String(node.game_id         ?? "0"),
    piece_id:        hexToNum(node.piece_id),
    owner:           String(node.owner           ?? "0x0"),
    x:               hexToNum(node.x),
    y:               hexToNum(node.y),
    rank_commitment: String(node.rank_commitment ?? "0"),
    revealed_rank:   hexToNum(node.revealed_rank),
    is_alive:        node.is_alive === true || node.is_alive === "true" || node.is_alive === "0x1",
    is_revealed:     node.is_revealed === true || node.is_revealed === "true" || node.is_revealed === "0x1",
    is_placed:       node.is_placed === true || node.is_placed === "true" || node.is_placed === "0x1",
  };
}

export function useGameState(gameId: string | null, intervalMs = 2000) {
  const [game, setGame] = useState<GameState | null>(null);
  const [pieces, setPieces] = useState<PieceState[]>([]);
  const [combat, setCombat] = useState<CombatState | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchState = useCallback(async () => {
    if (!gameId) return;
    const gid = normalizeId(gameId);

    const gameData = await toriiQuery(`{
      cipherGameModels(where: { game_id: "${gid}" }, first: 1) {
        edges { node { game_id player1 player2 status current_turn turn_count p1_pieces_placed p2_pieces_placed winner } }
      }
    }`);

    const gameNode = gameData?.data?.cipherGameModels?.edges?.[0]?.node;
    if (gameNode) setGame(parseGame(gameNode));

    const piecesData = await toriiQuery(`{
      cipherPieceModels(where: { game_id: "${gid}" }, first: 100) {
        edges { node { game_id piece_id owner x y rank_commitment revealed_rank is_alive is_revealed is_placed } }
      }
    }`);

    const pieceNodes = piecesData?.data?.cipherPieceModels?.edges ?? [];
    setPieces(pieceNodes.map((e: { node: Record<string, string> }) => parsePiece(e.node)));

    const combatData = await toriiQuery(`{
      cipherPendingCombatModels(where: { game_id: "${gid}" }) {
        edges { node { game_id is_active attacker_piece_id attacker_rank defender_piece_id from_x from_y to_x to_y } }
      }
    }`);

    const combatNode = combatData?.data?.cipherPendingCombatModels?.edges?.[0]?.node;
    if (combatNode) {
      setCombat({
        game_id:           combatNode.game_id,
        is_active:         combatNode.is_active === true || combatNode.is_active === "true" || combatNode.is_active === "0x1",
        attacker_piece_id: hexToNum(combatNode.attacker_piece_id),
        attacker_rank:     hexToNum(combatNode.attacker_rank),
        defender_piece_id: hexToNum(combatNode.defender_piece_id),
        from_x:            hexToNum(combatNode.from_x),
        from_y:            hexToNum(combatNode.from_y),
        to_x:              hexToNum(combatNode.to_x),
        to_y:              hexToNum(combatNode.to_y),
      });
    }
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    fetchState();
    const id = setInterval(fetchState, intervalMs);
    return () => clearInterval(id);
  }, [gameId, fetchState, intervalMs]);

  return { game, pieces, combat, loading, refetch: fetchState };
}

export async function fetchPlayerGame(playerAddress: string): Promise<string | null> {
  const data = await toriiQuery(`{
    cipherPlayerGameModels(where: { player: "${playerAddress}" }) {
      edges { node { player game_id } }
    }
  }`);
  const node = data?.data?.cipherPlayerGameModels?.edges?.[0]?.node;
  if (!node || node.game_id === "0x0" || node.game_id === "0") return null;
  return node.game_id;
}