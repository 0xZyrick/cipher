import { useEffect, useState, useCallback } from "react";
import { TORII_URL } from "../config";

// ── Existing types (unchanged) ─────────────────────────────

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

// ── New types for point system ─────────────────────────────

export interface PlayerStats {
  player: string;
  wins: number;
  losses: number;
  points: number;
  last_session_id: string;
}

export interface LeaderboardEntry {
  rank: number;
  player: string;
  displayName: string;
  wins: number;
  losses: number;
  points: number;
}

// ── Torii query helper (unchanged from original) ───────────

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

// ── Helpers (unchanged from original) ─────────────────────

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

function normalizeId(id: string): string {
  if (!id) return "0x0";
  if (id.startsWith("0x")) return id;
  return "0x" + parseInt(id).toString(16);
}

function parseGame(node: Record<string, unknown>): GameState | null {
  if (!node) return null;
  return {
    game_id:          String(node.game_id          ?? "0"),
    player1:          String(node.player1          ?? "0x0"),
    player2:          String(node.player2          ?? "0x0"),
    status:           hexToNum(node.status),
    current_turn:     String(node.current_turn     ?? "0x0"),
    turn_count:       hexToNum(node.turn_count),
    p1_pieces_placed: hexToNum(node.p1_pieces_placed),
    p2_pieces_placed: hexToNum(node.p2_pieces_placed),
    winner:           String(node.winner           ?? "0x0"),
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
    is_alive:    node.is_alive    === true || node.is_alive    === "true" || node.is_alive    === "0x1",
    is_revealed: node.is_revealed === true || node.is_revealed === "true" || node.is_revealed === "0x1",
    is_placed:   node.is_placed   === true || node.is_placed   === "true" || node.is_placed   === "0x1",
  };
}

function parsePlayerStats(node: Record<string, unknown>): PlayerStats {
  return {
    player:          String(node.player          ?? "0x0"),
    wins:            hexToNum(node.wins),
    losses:          hexToNum(node.losses),
    points:          hexToNum(node.points),
    last_session_id: String(node.last_session_id ?? "0x0"),
  };
}

// ── useGameState (logic unchanged, same polling pattern) ───

export function useGameState(gameId: string | null, intervalMs = 4000) {
  const [game, setGame]     = useState<GameState | null>(null);
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

// ── fetchPlayerGame (unchanged from original) ──────────────

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

// ── fetchPlayerStats — reads a single wallet's stats ───────
// Used by lobby header to show live pts counter.
// EGS: no changes — model key stays wallet address.

export async function fetchPlayerStats(playerAddress: string): Promise<PlayerStats | null> {
  const data = await toriiQuery(`{
    cipherPlayerStatsModels(where: { player: "${playerAddress}" }) {
      edges { node { player wins losses points last_session_id } }
    }
  }`);
  const node = data?.data?.cipherPlayerStatsModels?.edges?.[0]?.node;
  if (!node) return null;
  return parsePlayerStats(node);
}

// ── usePlayerStats — reactive hook for header pts display ──

export function usePlayerStats(playerAddress: string | undefined) {
  const [stats, setStats] = useState<PlayerStats | null>(null);

  const fetch = useCallback(async () => {
    if (!playerAddress) return;
    const result = await fetchPlayerStats(playerAddress);
    if (result) setStats(result);
  }, [playerAddress]);

  useEffect(() => {
    fetch();
    // Refresh every 30s — stats only change after game ends
    const id = setInterval(fetch, 30_000);
    return () => clearInterval(id);
  }, [fetch]);

  return stats;
}

// ── fetchRewardClaimed — guards the Claim Reward button ────

export async function fetchRewardClaimed(gameId: string): Promise<boolean> {
  const gid = normalizeId(gameId);
  const data = await toriiQuery(`{
    cipherRewardClaimModels(where: { game_id: "${gid}" }) {
      edges { node { game_id claimed claimed_by } }
    }
  }`);
  const node = data?.data?.cipherRewardClaimModels?.edges?.[0]?.node;
  if (!node) return false;
  return node.claimed === true || node.claimed === "true" || node.claimed === "0x1";
}

// ── fetchLeaderboard — Torii sorts by points natively ──────
// Uses Torii's orderBy — no need to know player addresses upfront.
// Torii indexes all model writes, so any player who has played
// appears here automatically.
//
// EGS: no changes needed — PlayerStats model key stays wallet address.

export async function fetchLeaderboard(topN = 10): Promise<LeaderboardEntry[]> {
  const data = await toriiQuery(`{
    cipherPlayerStatsModels(
      order: { field: POINTS, direction: DESC },
      first: ${topN}
    ) {
      edges { node { player wins losses points last_session_id } }
    }
  }`);

  const edges = data?.data?.cipherPlayerStatsModels?.edges ?? [];
  return edges.map((e: { node: Record<string, unknown> }, i: number) => {
    const s = parsePlayerStats(e.node);
    return {
      rank:        i + 1,
      player:      s.player,
      displayName: shortAddr(s.player),
      wins:        s.wins,
      losses:      s.losses,
      points:      s.points,
    };
  });
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}