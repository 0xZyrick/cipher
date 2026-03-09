import { getActivePlayer } from "./player";
import { useState } from "react";
import { LobbyPage } from "./pages/LobbyPage";
import { PlacementPage } from "./pages/PlacementPage";
import { BattlePage } from "./pages/BattlePage";
import { useGameState } from "./hooks/useGameState";
import { STATUS_ACTIVE } from "./config";

type Screen = "lobby" | "placement" | "battle";

export default function App() {
  const [screen, setScreen] = useState<Screen>("lobby");
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerAddress, setPlayerAddress] = useState<string>(getActivePlayer());
  const { game } = useGameState(gameId, 2000);

  if (screen === "placement" && game?.status === STATUS_ACTIVE) {
    setScreen("battle");
  }

  function handleGame(gid: string, address: string) {
    setGameId(gid);
    setPlayerAddress(address);
    setScreen("placement");
  }

  const shortAddr = playerAddress
    ? `${playerAddress.slice(0, 8)}...${playerAddress.slice(-4)}`
    : "Not Connected";

  return (
    <div className="app-shell">


      {screen === "lobby" && <LobbyPage onGame={handleGame} />}
      {screen === "placement" && gameId && (
        <PlacementPage gameId={gameId} onBattle={() => setScreen("battle")} onLeave={() => { setGameId(null); setScreen("lobby"); }} />
      )}
      {screen === "battle" && gameId && (
        <BattlePage gameId={gameId} onLeave={() => { setGameId(null); setScreen("lobby"); }} />
      )}
    </div>
  );
}