import { Account, AccountInterface, RpcProvider, Signer } from "starknet";
import { ACTIONS_ADDRESS } from "../config";
import { getActivePlayer, ACCOUNTS } from "../player";
import { computeCommitment, generateSalt, saveSalt } from "../utils/commitment";

const RPC = import.meta.env.VITE_RPC_URL || "http://localhost:5050";
const provider = new RpcProvider({ nodeUrl: RPC });

function toHex(n: number | bigint | string): string {
  return "0x" + BigInt(n).toString(16);
}

async function executeCall(method: string, calldata: string[], account?: AccountInterface | null) {
  const callObj = { contractAddress: ACTIONS_ADDRESS, entrypoint: method, calldata };
  if (!account) {
    throw new Error("Please connect your Cartridge wallet first");
  }
  const result = await account.execute([callObj] as Parameters<AccountInterface['execute']>[0]);
  await provider.waitForTransaction(result.transaction_hash);
  return result;
}

export function useActions(account?: AccountInterface | null) {
  return {
    async createGame(): Promise<string | null> {
      const result = await executeCall("create_game", [], account);
      const receipt = await provider.getTransactionReceipt(result.transaction_hash);
      const events = (receipt as never as { events: { data: string[] }[] }).events;
      
      let gameId: bigint | null = null;
      for (const event of events) {
        for (const data of event.data) {
          try {
            const n = BigInt(data);
            if (n > 0n && n < 1000000n) {
              if (gameId === null || n > gameId) gameId = n;
            }
          } catch { continue; }
        }
      }
      if (gameId !== null) return "0x" + gameId.toString(16);
      return null;
    },
    async joinGame(gameId: string) {
      await executeCall("join_game", [gameId], account);
    },
    async placePiece(gameId: string, pieceId: number, x: number, y: number, rank: number) {
      const salt = generateSalt();
      saveSalt(gameId, pieceId, salt);
      const commitment = computeCommitment(rank, salt);
      await executeCall("place_piece", [gameId, toHex(pieceId), toHex(x), toHex(y), toHex(commitment)], account);
    },
    async ready(gameId: string) {
      await executeCall("ready", [gameId], account);
    },
    async movePiece(gameId: string, pieceId: number, toX: number, toY: number, rank: number, salt: bigint) {
      await executeCall("move_piece", [gameId, toHex(pieceId), toHex(toX), toHex(toY), toHex(rank), toHex(salt)], account);
    },
    async resolveCombat(gameId: string, pieceId: number, rank: number, salt: bigint) {
      await executeCall("resolve_combat", [gameId, toHex(pieceId), toHex(rank), toHex(salt)], account);
    },
    async forfeit(gameId: string) {
      await executeCall("forfeit", [gameId], account);
    },
  };
}
