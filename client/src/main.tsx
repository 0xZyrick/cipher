import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { sepolia } from "@starknet-react/chains";
import { StarknetConfig, jsonRpcProvider, cartridge } from "@starknet-react/core";
import { cartridgeConnector } from "./cartridge";
import { LoadingScreen } from "./pages/LoadingScreen";

function Main() {
  const [appReady, setAppReady] = React.useState(false);

  if (!appReady) return <LoadingScreen onReady={() => setAppReady(true)} />;

  const provider = jsonRpcProvider({
    rpc: () => ({ nodeUrl: import.meta.env.VITE_RPC_URL || "https://api.cartridge.gg/x/starknet/sepolia" }),
  });

  return (
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
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<Main />);
