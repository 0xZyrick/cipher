/// <reference types="vite/client" />
import { ControllerConnector } from "@cartridge/connector";

const ACTIONS_ADDRESS = import.meta.env.VITE_ACTIONS_ADDRESS as string;
const RPC_URL = (import.meta.env.VITE_RPC_URL as string) || "http://localhost:5050";

const policies = {
  contracts: {
    [ACTIONS_ADDRESS]: {
      methods: [
        { name: "create_game",    entrypoint: "create_game" },
        { name: "join_game",      entrypoint: "join_game" },
        { name: "place_piece",    entrypoint: "place_piece" },
        { name: "ready",          entrypoint: "ready" },
        { name: "move_piece",     entrypoint: "move_piece" },
        { name: "resolve_combat", entrypoint: "resolve_combat" },
        { name: "forfeit",        entrypoint: "forfeit" },
      ],
    },
  },
};

export const cartridgeConnector = new ControllerConnector({
  policies,
  chains: [{ rpcUrl: RPC_URL }],

  colorMode: "dark",
} as never);