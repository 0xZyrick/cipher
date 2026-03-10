import { useState } from "react";
import { useAccount } from "@starknet-react/core";
import { LobbyPage } from "./pages/LobbyPage";
import { PlacementPage } from "./pages/PlacementPage";
import { BattlePage } from "./pages/BattlePage";
import { useGameState } from "./hooks/useGameState";
import { STATUS_ACTIVE } from "./config";
import { getActivePlayer } from "./player";

type Screen = "lobby" | "placement" | "battle";

export default function App() {
  const [screen, setScreen] = useState<Screen>("lobby");
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerAddress, setPlayerAddress] = useState<string>(getActivePlayer());
  const { account } = useAccount();
  const { game } = useGameState(gameId, 2000);

  if (screen === "placement" && game?.status === STATUS_ACTIVE) {
    setScreen("battle");
  }

  function handleGame(gid: string, address: string) {
    setGameId(gid);
    setPlayerAddress(address);
    setScreen("placement");
  }

  return (
    <div className="app-shell">
      {screen === "lobby" && (
        <LobbyPage onGame={handleGame} account={account} />
      )}
      {screen === "placement" && gameId && (
        <PlacementPage
          gameId={gameId}
          playerAddress={playerAddress}
          account={account}
          onBattle={() => setScreen("battle")}
          onLeave={() => { setGameId(null); setScreen("lobby"); }}
        />
      )}
      {screen === "battle" && gameId && (
        <BattlePage
          gameId={gameId}
          playerAddress={playerAddress}
          account={account}
          onLeave={() => { setGameId(null); setScreen("lobby"); }}
        />
      )}
    </div>
  );
}
