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

// Returns burner account for local dev
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
    // Cartridge account — no resource bounds needed, it handles fees
    const result = await cartridgeAccount.execute([callObj]);
    await provider.waitForTransaction(result.transaction_hash);
    return result;
  } else {
    // Burner account — V3 with resource bounds
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
      await executeCall("place_piece", [gameId, pieceId.toString(), x.toString(), y.toString(), commitment.toString()], cartridgeAccount);
    },
    async ready(gameId: string) {
      await executeCall("ready", [gameId], cartridgeAccount);
    },
    async movePiece(gameId: string, pieceId: number, toX: number, toY: number, rank: number, salt: bigint) {
      await executeCall("move_piece", [gameId, pieceId.toString(), toX.toString(), toY.toString(), rank.toString(), salt.toString()], cartridgeAccount);
    },
    async resolveCombat(gameId: string, pieceId: number, rank: number, salt: bigint) {
      await executeCall("resolve_combat", [gameId, pieceId.toString(), rank.toString(), salt.toString()], cartridgeAccount);
    },
    async forfeit(gameId: string) {
      await executeCall("forfeit", [gameId], cartridgeAccount);
    },
  };
}