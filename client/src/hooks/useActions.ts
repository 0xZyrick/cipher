import {
  AccountInterface,
  RpcProvider,
  CallData,
  CairoOption,
  CairoOptionVariant,
} from "starknet";
import { ACTIONS_ADDRESS, GAME_SETUP_ADDRESS } from "../config";
import { getActivePlayer, ACCOUNTS } from "../player";
import { computeCommitment, generateSalt, saveSalt } from "../utils/commitment";
import { EGS_GAME_ID } from "../utils/denshokan";

const RPC = import.meta.env.VITE_RPC_URL || "http://localhost:5050";
const provider = new RpcProvider({ nodeUrl: RPC });

const DENSHOKAN = "0x0142712722e62a38f9c40fcc904610e1a14c70125876ecaaf25d803556734467";
const TRANSFER_KEY = "0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9";

// ── Module-level cache ────────────────────────────────────
// getClassAt is fetched once on first createGame call,
// then reused forever — avoids slow RPC call on every mint.
let _denshokanCallData: CallData | null = null;

async function getDenshokanCallData(): Promise<CallData> {
  if (_denshokanCallData) return _denshokanCallData;
  const classAt = await provider.getClassAt(DENSHOKAN);
  const abi = typeof classAt.abi === "string"
    ? JSON.parse(classAt.abi)
    : classAt.abi;
  _denshokanCallData = new CallData(abi);
  return _denshokanCallData;
}
// ─────────────────────────────────────────────────────────

function toHex(n: number | bigint | string): string {
  return "0x" + BigInt(n).toString(16);
}

async function executeCall(
  method: string,
  calldata: string[],
  account?: AccountInterface | null,
) {
  if (!account) throw new Error("Please connect your Cartridge wallet first");
  const callObj = { contractAddress: ACTIONS_ADDRESS, entrypoint: method, calldata };
  const result = await account.execute([callObj] as Parameters<AccountInterface["execute"]>[0]);
  // Poll every 1s instead of default 5s — makes transactions feel faster
  await provider.waitForTransaction(result.transaction_hash, { retryInterval: 1000 });
  return result;
}

export function useActions(account?: AccountInterface | null) {
  return {

    async createGame(): Promise<string | null> {
      if (!account) throw new Error("Please connect your Cartridge wallet first");

      if (EGS_GAME_ID > 0) {
        // Uses cached CallData — no RPC call after the first time
        const cd = await getDenshokanCallData();
        const none = new CairoOption(CairoOptionVariant.None);

        const compiled = cd.compile("mint", [
          GAME_SETUP_ADDRESS, // game_address — must point to game_setup, not actions
          none,               // player_name   (Option<ByteArray>)
          none,               // settings_id   (Option<u32>)
          none,               // start         (Option<u64>)
          none,               // end           (Option<u64>)
          none,               // objective_id  (Option<u32>)
          none,               // context       (Option<felt252>)
          none,               // client_url    (Option<ByteArray>)
          none,               // renderer_address (Option<ContractAddress>)
          none,               // skills_address   (Option<ContractAddress>)
          account.address,    // to
          false,              // soulbound
          false,              // paymaster
          0,                  // salt
          0,                  // metadata
        ]);

        const mintCall = {
          contractAddress: DENSHOKAN,
          entrypoint: "mint",
          calldata: compiled,
        };

        const mintResult = await account.execute(
          [mintCall] as Parameters<AccountInterface["execute"]>[0]
        );
        // Poll every 1s instead of default 5s
        await provider.waitForTransaction(mintResult.transaction_hash, { retryInterval: 1000 });

        // Extract token ID from ERC-721 Transfer event
        const receipt = await provider.getTransactionReceipt(mintResult.transaction_hash);
        const events = (receipt as any)?.events as Array<{ keys: string[]; data: string[] }> | undefined;
 
        let tokenId: string | null = null;

        if (events) {
          for (const event of events) {
            if (event.keys?.[0] === TRANSFER_KEY && event.data?.length >= 1) {
              try {
                const n = BigInt(event.data[event.data.length - 1]);
                if (n > 0n) { tokenId = toHex(n); break; }
              } catch { continue; }
            }
          }
        }

        if (!tokenId) {
          console.warn("Could not extract token_id, falling back to legacy");
          return this.createGameLegacy();
        }

        await executeCall("create_game_egs", [tokenId], account);
        return tokenId;
      }

      return this.createGameLegacy();
    },

    async createGameLegacy(): Promise<string | null> {
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
      await executeCall(
        "place_piece",
        [gameId, toHex(pieceId), toHex(x), toHex(y), toHex(commitment)],
        account,
      );
    },

    async ready(gameId: string) {
      await executeCall("ready", [gameId], account);
    },

    async movePiece(
      gameId: string,
      pieceId: number,
      toX: number,
      toY: number,
      rank: number,
      salt: bigint,
    ) {
      await executeCall(
        "move_piece",
        [gameId, toHex(pieceId), toHex(toX), toHex(toY), toHex(rank), toHex(salt)],
        account,
      );
    },

    async resolveCombat(gameId: string, pieceId: number, rank: number, salt: bigint) {
      await executeCall(
        "resolve_combat",
        [gameId, toHex(pieceId), toHex(rank), toHex(salt)],
        account,
      );
    },

    async forfeit(gameId: string) {
      await executeCall("forfeit", [gameId], account);
    },

    async claimReward(gameId: string) {
  await executeCall("claim_reward", [gameId], account);

  if (account && EGS_GAME_ID > 0) {
    try {
      // Only sync to Denshokan if this is a real token id
      // Legacy game ids are small numbers (< 1,000,000)
      // Denshokan token ids are large packed numbers
      const isEgsToken = BigInt(gameId) > 1_000_000n;
      
      if (isEgsToken) {
        await account.execute([{
          contractAddress: DENSHOKAN,
          entrypoint: "update_game",
          calldata: [gameId],
        }] as Parameters<AccountInterface["execute"]>[0]);
      }
    } catch (e) {
      console.warn("EGS updateGame failed (non-fatal):", e);
    }
  }
},

    async initializeEGS(minigameTokenAddress: string) {
      await executeCall("initializer", [minigameTokenAddress], account);
    },

    async registerEGS(creatorAddress: string) {
      await executeCall("register_egs", [creatorAddress], account);
    },
  };
}