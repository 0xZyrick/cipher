// ═══════════════════════════════════════════════════════════
//  CIPHER — Combat Cinema Component (v3)
//
//  SEQUENCE:
//  1. show_both    — Both cards shown (attacker up, defender down)
//                    onResolve fires NOW in background during tension pause
//  2. waiting      — Short "Resolving..." indicator while chain confirms
//  3. reveal       — Defender flips using the NOW-CONFIRMED rank
//  4. result       — Winner/loser effects. Bomb: explosion inline on modal
//                    Army: crack lines on loser medallion
//  5. hold         — 2s hold so both players can see result
//  6. flip_back    — Defender flips back face-down
//  7. done         — Overlay fades, onDone fires
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { audioManager } from "../utils/audioManager";

interface CombatPiece {
  pieceId: number;
  rank: number;
  isOwn: boolean;
  label: string;
}

interface Props {
  attacker: CombatPiece;
  defender: CombatPiece;
  // Returns the confirmed defender rank after chain resolves
  onResolve: () => Promise<number>;
  onDone: () => void;
}

type Phase =
  | "show_both"   // attacker up, defender down — chain resolves in background
  | "resolving"   // waiting for chain confirm
  | "reveal"      // flip defender with confirmed rank
  | "result"      // winner/loser effects
  | "flip_back"   // defender flips back face-down
  | "done";

function getRankName(rank: number): string {
  const names: Record<number, string> = {
    0: "Flag", 1: "Spy", 2: "Scout", 3: "Miner",
    4: "Sergeant", 5: "Lieutenant", 6: "Captain",
    7: "Major", 8: "Colonel", 9: "General",
    10: "Marshal", 11: "Bomb",
  };
  return names[rank] ?? "Unknown";
}

function getResult(attRank: number, defRank: number): {
  winner: "attacker" | "defender" | "draw";
  text: string;
  isBomb: boolean;
} {
  if (defRank === 11) return { winner: "defender", text: "BOMB!", isBomb: true };
  if (attRank === 1 && defRank === 10) return { winner: "attacker", text: "SILENCED", isBomb: false };
  if (attRank === defRank) return { winner: "draw", text: "DRAW", isBomb: false };
  if (attRank > defRank) return { winner: "attacker", text: "DESTROYED", isBomb: false };
  return { winner: "defender", text: "REPELLED", isBomb: false };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function CombatCinema({ attacker, defender, onResolve, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>("show_both");
  const [defenderRevealed, setDefenderRevealed] = useState(false);
  // Confirmed rank — starts as what we already know, updated after chain resolves
  const [confirmedDefRank, setConfirmedDefRank] = useState(defender.rank);
  const [showInlineExplosion, setShowInlineExplosion] = useState(false);

  const result = getResult(attacker.rank, confirmedDefRank);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Phase 1 — show both cards, fire chain resolve immediately
      // Chain resolves during the dramatic 0.9s pause — so by reveal we have the rank
      const resolvePromise = onResolve(); // fire — don't await yet

      await delay(900);
      if (cancelled) return;

      // Phase 2 — brief "resolving" state while we wait for chain
      setPhase("resolving");
      const confirmedRank = await resolvePromise; // now we wait
      if (cancelled) return;

      // Update defender rank with what chain confirmed
      setConfirmedDefRank(confirmedRank);

      // Phase 3 — flip defender to reveal the CONFIRMED rank
      setPhase("reveal");
      await delay(150);
      if (!cancelled) setDefenderRevealed(true);
      await delay(700);
      if (cancelled) return;

      // Phase 4 — result effects
      setPhase("result");

      const isBombNow = confirmedRank === 11;
      if (isBombNow) {
        audioManager.playSFX("bomb");
        setShowInlineExplosion(true);
        await delay(500);
        if (!cancelled) setShowInlineExplosion(false);
      } else {
        audioManager.playSFX("attack");
      }

      // Hold result visible
      await delay(2200);
      if (cancelled) return;

      // Phase 5 — flip defender back face-down
      setPhase("flip_back");
      await delay(200);
      if (!cancelled) setDefenderRevealed(false);
      await delay(500);
      if (cancelled) return;

      // Phase 6 — done
      setPhase("done");
      await delay(300);
      if (!cancelled) onDone();
    }

    run();
    return () => { cancelled = true; };
  }, []);

  if (phase === "done") return null;

  const attackerWins = result.winner === "attacker";
  const defenderWins = result.winner === "defender";
  const isDraw = result.winner === "draw";
  const showResultEffects = phase === "result" || phase === "flip_back";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 150,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "radial-gradient(ellipse at center, rgba(15,8,3,0.95) 0%, rgba(0,0,0,0.98) 100%)",
      gap: 20,
      animation: "page-fade-in 0.3s ease forwards",
    }}>

      {/* Header */}
      <div style={{
        fontFamily: "var(--font-title)",
        fontSize: "clamp(10px, 1.2vw, 13px)",
        letterSpacing: "0.55em",
        color: "var(--text-dim)",
        textTransform: "uppercase",
        marginBottom: 4,
      }}>
        Combat Resolution
      </div>

      {/* Cards stage */}
      <div style={{ display: "flex", alignItems: "center", gap: "clamp(28px, 4.5vw, 60px)", position: "relative" }}>

        {/* Attacker card — always face up */}
        <CombatCard
          piece={attacker}
          revealed={true}
          isWinner={showResultEffects && attackerWins}
          isLoser={showResultEffects && defenderWins}
          isDraw={showResultEffects && isDraw}
          showResult={showResultEffects}
          animateBreak={showResultEffects && defenderWins && !result.isBomb}
          isBomb={false}
        />

        {/* VS divider */}
        <div style={{
          fontFamily: "var(--font-title)",
          fontSize: "clamp(22px, 3.5vw, 38px)",
          fontWeight: 900,
          color: "var(--danger-light)",
          textShadow: "0 0 18px rgba(180,40,40,0.7)",
          animation: "vs-throb 0.9s ease-in-out infinite",
          userSelect: "none",
        }}>
          VS
        </div>

        {/* Defender card — flips to reveal confirmed rank */}
        <CombatCard
          piece={{ ...defender, rank: confirmedDefRank }}
          revealed={defenderRevealed}
          isWinner={showResultEffects && defenderWins}
          isLoser={showResultEffects && attackerWins}
          isDraw={showResultEffects && isDraw}
          showResult={showResultEffects}
          flipAnimation={phase === "reveal" || phase === "flip_back"}
          animateBreak={showResultEffects && attackerWins && !result.isBomb}
          isBomb={result.isBomb}
        />

        {/* ── Inline explosion — centred on the modal, NOT a fixed screen flash ── */}
        {showInlineExplosion && (
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "clamp(180px, 22vw, 280px)",
            height: "clamp(180px, 22vw, 280px)",
            pointerEvents: "none",
            zIndex: 10,
            animation: "explosion-pop 0.7s ease forwards",
          }}>
            <img
              src="/assets/icons/explosion.webp"
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
              onError={(e) => {
                // SVG fallback if explosion.png is missing
                const el = e.target as HTMLImageElement;
                el.style.display = "none";
                const parent = el.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <svg viewBox="0 0 200 200" style="width:100%;height:100%">
                      <circle cx="100" cy="100" r="90" fill="rgba(255,120,0,0.35)"/>
                      <circle cx="100" cy="100" r="60" fill="rgba(255,80,0,0.55)"/>
                      <circle cx="100" cy="100" r="35" fill="rgba(255,200,0,0.8)"/>
                      <circle cx="100" cy="100" r="16" fill="white" opacity="0.9"/>
                      ${[0,45,90,135,180,225,270,315].map(a => {
                        const r = (a * Math.PI) / 180;
                        const x2 = 100 + 95 * Math.cos(r);
                        const y2 = 100 + 95 * Math.sin(r);
                        return `<line x1="100" y1="100" x2="${x2}" y2="${y2}" stroke="rgba(255,160,0,0.7)" stroke-width="6" stroke-linecap="round"/>`;
                      }).join('')}
                    </svg>`;
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Resolving indicator — only during chain wait */}
      {phase === "resolving" && (
        <div style={{
          fontFamily: "var(--font-body)",
          fontStyle: "italic",
          fontSize: 12,
          color: "var(--amber)",
          letterSpacing: "0.12em",
          display: "flex", alignItems: "center", gap: 8,
          animation: "pulse 0.8s ease-in-out infinite",
        }}>
          <div className="dot-loader" style={{ transform: "scale(0.6)" }}><span/><span/><span/></div>
          Confirming on chain...
        </div>
      )}

      {/* Result text banner */}
      {showResultEffects && (
        <div style={{
          fontFamily: "var(--font-title)",
          fontSize: "clamp(16px, 2.6vw, 26px)",
          fontWeight: 900,
          letterSpacing: "0.22em",
          color: result.isBomb ? "#FF6B00"
            : isDraw ? "var(--text-dim)"
            : "var(--gold-light)",
          textShadow: result.isBomb
            ? "0 0 28px rgba(255,100,0,0.8)"
            : "0 0 18px rgba(201,168,76,0.5)",
          animation: "banner-pulse 0.8s ease-in-out infinite",
          marginTop: 4,
        }}>
          {result.text}
        </div>
      )}
    </div>
  );
}

// ── Individual combat card ────────────────────────────────
interface CombatCardProps {
  piece: CombatPiece;
  revealed: boolean;
  isWinner: boolean;
  isLoser: boolean;
  isDraw: boolean;
  showResult: boolean;
  flipAnimation?: boolean;
  animateBreak?: boolean;
  isBomb?: boolean;
}

function CombatCard({
  piece, revealed, isWinner, isLoser, isDraw, showResult, flipAnimation, animateBreak, isBomb,
}: CombatCardProps) {
  const rankLabel = piece.rank === 0 ? "F" : piece.rank === 11 ? "B" : String(piece.rank);
  const assetPath = piece.rank === 0 ? "/assets/pieces/flag.webp"
    : piece.rank === 11 ? "/assets/pieces/bomb.webp"
    : `/assets/pieces/rank-${piece.rank}.png`;
  const hiddenPath = "/assets/pieces/piece-hidden.webp";

  let borderColor = "rgba(201,168,76,0.25)";
  let boxShadow = "none";
  if (showResult && isWinner) {
    borderColor = "var(--gold)";
    boxShadow = "0 0 22px rgba(201,168,76,0.65), 0 0 44px rgba(201,168,76,0.25)";
  } else if (showResult && isLoser) {
    borderColor = "rgba(160,30,30,0.4)";
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", gap: 10,
      opacity: showResult && isLoser ? 0.3 : 1,
      transform: showResult && isWinner ? "scale(1.07)" : showResult && isLoser ? "scale(0.86)" : "scale(1)",
      transition: "opacity 0.55s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      filter: showResult && isLoser ? "grayscale(0.9) brightness(0.6)" : "none",
      animation: animateBreak ? "combat-break-shake 0.45s ease" : undefined,
    }}>

      {/* Label */}
      <div style={{
        fontFamily: "var(--font-head)",
        fontSize: 8, letterSpacing: "0.42em",
        color: "var(--text-dim)", textTransform: "uppercase",
      }}>
        {piece.label}
      </div>

      {/* Piece image */}
      <div style={{
        width: "clamp(96px, 11vw, 136px)",
        height: "clamp(96px, 11vw, 136px)",
        borderRadius: "50%",
        border: `2px solid ${borderColor}`,
        boxShadow,
        transition: "border-color 0.4s ease, box-shadow 0.4s ease",
        overflow: "hidden",
        position: "relative",
        animation: flipAnimation ? "card-flip 0.45s ease" : undefined,
      }}>
        <img
          src={revealed ? assetPath : hiddenPath}
          alt={rankLabel}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />

        {/* Crack lines on army loser — not bomb */}
        {showResult && isLoser && !isBomb && (
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            pointerEvents: "none",
            animation: "crack-appear 0.3s ease forwards",
          }}>
            <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}>
              <line x1="30" y1="10" x2="55" y2="50" stroke="rgba(0,0,0,0.7)" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="55" y1="50" x2="40" y2="90" stroke="rgba(0,0,0,0.65)" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="55" y1="50" x2="75" y2="70" stroke="rgba(0,0,0,0.5)" strokeWidth="0.9" strokeLinecap="round"/>
              <line x1="60" y1="15" x2="70" y2="45" stroke="rgba(0,0,0,0.4)" strokeWidth="0.8" strokeLinecap="round"/>
            </svg>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(180,20,20,0.25)" }}/>
          </div>
        )}
      </div>

      {/* Rank name */}
      <div style={{
        fontFamily: "var(--font-head)",
        fontSize: "clamp(9px, 1.1vw, 12px)",
        letterSpacing: "0.15em",
        color: revealed ? "var(--gold-light)" : "var(--text-muted)",
        textTransform: "uppercase",
        textShadow: "0 1px 4px rgba(0,0,0,0.9)",
        minHeight: "1em",
      }}>
        {revealed ? getRankName(piece.rank) : "Unknown"}
      </div>

      {/* Rank badge */}
      {revealed && (
        <div style={{
          fontFamily: "var(--font-head)",
          fontSize: 10, fontWeight: 700,
          color: "var(--text-dim)",
          letterSpacing: "0.08em",
        }}>
          {piece.rank === 0 ? "Flag" : piece.rank === 11 ? "Bomb" : `Rank ${piece.rank}`}
        </div>
      )}

      {/* VICTOR / FALLEN / DRAW badge */}
      {showResult && (
        <div style={{
          fontFamily: "var(--font-head)",
          fontSize: 8, letterSpacing: "0.32em",
          color: isWinner ? "var(--gold-light)" : isLoser ? "var(--danger-light)" : "var(--text-dim)",
          textTransform: "uppercase",
          padding: "3px 11px",
          border: `1px solid ${isWinner ? "var(--gold-dim)" : isLoser ? "var(--danger)" : "var(--text-muted)"}`,
          borderRadius: "var(--radius-sm)",
          animation: isWinner ? "winner-pulse 0.9s ease-in-out infinite" : undefined,
        }}>
          {isWinner ? "VICTOR" : isLoser ? "FALLEN" : "DRAW"}
        </div>
      )}
    </div>
  );
}