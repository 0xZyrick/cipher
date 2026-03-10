import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { sepolia } from "@starknet-react/chains";
import { StarknetConfig, jsonRpcProvider, cartridge } from "@starknet-react/core";
import { cartridgeConnector } from "./cartridge";

const provider = jsonRpcProvider({
  rpc: () => ({ nodeUrl: import.meta.env.VITE_RPC_URL || "https://api.cartridge.gg/x/starknet/sepolia" }),
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <StarknetConfig
      chains={[sepolia]}
      provider={provider}
      connectors={[cartridgeConnector as never]}
      explorer={cartridge}
      autoConnect
    >
      <App />
    </StarknetConfig>
  </React.StrictMode>
);
