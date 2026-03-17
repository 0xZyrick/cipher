import { DenshokanClient } from "@provable-games/denshokan-sdk";

const DENSHOKAN_ADDRESS_SEPOLIA =
  "0x0142712722e62a38f9c40fcc904610e1a14c70125876ecaaf25d803556734467";
const REGISTRY_ADDRESS_SEPOLIA =
  "0x040f1ed9880611bb7273bf51fd67123ebbba04c282036e2f81314061f6f9b1a1";

export const EGS_GAME_ID = Number(import.meta.env.VITE_EGS_GAME_ID || "0");

// Single shared client — used for both reads and building write Call[]
// The account is NEVER passed here; it lives in useActions and calls account.execute(calls)
export const denshokanClient = new DenshokanClient({
  chain: "sepolia",
  denshokanAddress: DENSHOKAN_ADDRESS_SEPOLIA,
  registryAddress: REGISTRY_ADDRESS_SEPOLIA,
  rpcUrl:
    import.meta.env.VITE_RPC_URL ||
    "https://api.cartridge.gg/x/starknet/sepolia",
});