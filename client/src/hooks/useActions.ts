import { Account, RpcProvider, Signer } from "starknet";
import { ACTIONS_ADDRESS } from "../config";
import { getActivePlayer, ACCOUNTS } from "../player";
import { computeCommitment, generateSalt, saveSalt } from "../utils/commitment";

const RPC = import.meta.env.VITE_RPC_URL || "http://localhost:5050";

const RESOURCE_BOUNDS = {
  l1_gas:      { max_amount: 100000n, max_price_per_unit: 1n },
  l2_gas:      { max_amount: 100000n, max_price_per_unit: 1n },
  l1_data_gas: { max_amount: 100000n, max_price_per_unit: 1n },
};

const provider = new RpcProvider({ nodeUrl: RPC });

// ✅ NEW: converts any number/bigint to hex string for StarkNet calldata
function toHex(n: number | bigint | string): string {
  return "0x" + BigInt(n).toString(16);
}

function getBurnerAccount(): Account {
  const address = getActivePlayer();
  const pk = ACCOUNTS[address.toLowerCase()] || ACCOUNTS[address];
  if (!pk) throw new Error("No key for " + address);
  return new Account({ provider, address, signer: new Signer(pk) } as never);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeCall(method: string, calldata: string[], cartridgeAccount?: any) {
  const callObj = { contractAddress: ACTIONS_ADDRESS, entrypoint: method, calldata };

  if (cartridgeAccount) {
    const result = await cartridgeAccount.execute([callObj]);
    await provider.waitForTransaction(result.transaction_hash);
    return result;
  } else {
    const account = getBurnerAccount();
    const result = await account.execute(
      callObj,
      { resourceBounds: RESOURCE_BOUNDS, tip: 0n } as never
    );
    await provider.waitForTransaction(result.transaction_hash);
    return result;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useActions(cartridgeAccount?: any) {
  return {
    async createGame(): Promise<string | null> {
      const result = await executeCall("create_game", [], cartridgeAccount);
      const receipt = await provider.getTransactionReceipt(result.transaction_hash);
      const events = (receipt as never as { events: { data: string[] }[] }).events;
      if (events && events.length > 0 && events[0].data.length > 0) {
        const id = parseInt(events[0].data[0], 16);
        return "0x" + id.toString(16);
      }
      return "0x1";
    },

    async joinGame(gameId: string) {
      await executeCall("join_game", [gameId], cartridgeAccount);
    },

    async placePiece(gameId: string, pieceId: number, x: number, y: number, rank: number) {
      const salt = generateSalt();
      saveSalt(gameId, pieceId, salt);
      const commitment = computeCommitment(rank, salt);
      await executeCall("place_piece", [
        gameId,
        toHex(pieceId),      // ✅ was: pieceId.toString()
        toHex(x),            // ✅ was: x.toString()
        toHex(y),            // ✅ was: y.toString()
        toHex(commitment),   // ✅ was: commitment.toString()
      ], cartridgeAccount);
    },

    async ready(gameId: string) {
      await executeCall("ready", [gameId], cartridgeAccount);
    },

    async movePiece(gameId: string, pieceId: number, toX: number, toY: number, rank: number, salt: bigint) {
      await executeCall("move_piece", [
        gameId,
        toHex(pieceId),   // ✅
        toHex(toX),       // ✅
        toHex(toY),       // ✅
        toHex(rank),      // ✅
        toHex(salt),      // ✅
      ], cartridgeAccount);
    },

    async resolveCombat(gameId: string, pieceId: number, rank: number, salt: bigint) {
      await executeCall("resolve_combat", [
        gameId,
        toHex(pieceId),   // ✅
        toHex(rank),      // ✅
        toHex(salt),      // ✅
      ], cartridgeAccount);
    },

    async forfeit(gameId: string) {
      await executeCall("forfeit", [gameId], cartridgeAccount);
    },
  };
}