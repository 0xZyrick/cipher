import { hash } from "starknet";

export function generateSalt(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(31));
  return BigInt("0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join(""));
}

export function computeCommitment(rank: number, salt: bigint): string {
  return hash.computePoseidonHashOnElements([rank.toString(), salt.toString()]);
}

export function saveSalt(gameId: string, pieceId: number, salt: bigint) {
  localStorage.setItem(`cipher_salt_${gameId}_${pieceId}`, salt.toString());
}

export function getSalt(gameId: string, pieceId: number): bigint {
  const v = localStorage.getItem(`cipher_salt_${gameId}_${pieceId}`);
  return v ? BigInt(v) : 0n;
}

export function saveRank(gameId: string, pieceId: number, rank: number) {
  localStorage.setItem(`cipher_rank_${gameId}_${pieceId}`, rank.toString());
}

export function getRank(gameId: string, pieceId: number): number {
  const v = localStorage.getItem(`cipher_rank_${gameId}_${pieceId}`);
  return v ? parseInt(v) : 0;
}
