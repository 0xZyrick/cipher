// ═══════════════════════════════════════════════════════════
//  CIPHER — Leaderboard (live from Torii)
//  No known-players list needed — Torii sorts by points natively.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { fetchLeaderboard, LeaderboardEntry } from "../hooks/useGameState";

interface Props { onBack: () => void; }

const RANK_COLORS: Record<number, string> = {
  1: "#FFD700",
  2: "#C0C0C0",
  3: "#CD7F32",
};

export function LeaderboardPage({ onBack }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard(10)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="leaderboard-screen">

      <button className="leaderboard-back-btn" onClick={onBack}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back
      </button>

      <div className="leaderboard-panel">

        <div className="leaderboard-header">
          <img
            src="/assets/icons/leaderboardhead.webp"
            alt="Leaderboard"
            className="leaderboard-head-img"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              const fb = document.createElement("div");
              fb.style.cssText = "font-family:var(--font-head);font-size:24px;letter-spacing:0.3em;color:var(--gold-light);text-transform:uppercase;padding:8px 0;";
              fb.textContent = "LEADERBOARD";
              (e.target as HTMLImageElement).parentElement?.appendChild(fb);
            }}
          />
        </div>

        <div className="leaderboard-divider" />

        <div className="leaderboard-rows">

          {loading && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div className="dot-loader"><span/><span/><span/></div>
              <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--text-dim)", fontSize: 13, marginTop: 12 }}>
                Consulting the war records...
              </p>
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--text-muted)", fontSize: 13, letterSpacing: "0.08em" }}>
                No campaigns recorded yet. Be the first to claim victory.
              </p>
            </div>
          )}

          {!loading && entries.map((entry) => (
            <div key={entry.player} className="leaderboard-row">

              <div className="leaderboard-medallion">
                <img
                  src="/assets/icons/medallion-base.webp"
                  alt=""
                  className="leaderboard-medallion-img"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>

              <span
                className="leaderboard-rank-num"
                style={{ color: RANK_COLORS[entry.rank] || "var(--text-dim)" }}
              >
                {entry.rank}.
              </span>

              <div>
                <div className="leaderboard-name">{entry.displayName}</div>
                <div style={{
                  fontFamily: "var(--font-head)", fontSize: 9,
                  color: "var(--text-muted)", letterSpacing: "0.08em", marginTop: 2,
                }}>
                  {entry.wins}W · {entry.losses}L
                </div>
              </div>

              <span className="leaderboard-pts">
                {entry.points.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <div className="leaderboard-footer">
          Rankings update after each completed campaign
        </div>
      </div>
    </div>
  );
}