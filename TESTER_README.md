# Cipher — Tester Setup Guide

## Prerequisites

- Node.js installed
- Access to the cipher repo

---

## Starting the Game

**Terminal 1** — start the backend (Katana + Torii):
```bash
~/start-cipher.sh
```
Wait until it says it's ready before moving on.

**Terminal 2** — start the frontend:
```bash
cd ~/cipher/client && npm run dev
```

Then open your browser at: **http://localhost:3000**

---

## Playing as Burner Accounts (P1 vs P2)

Two prefunded local accounts are available for testing — no wallet needed.

1. Open **two separate browser tabs** (or two different browsers)
2. In **Tab 1** — click the **P1** button in the top-left corner
3. In **Tab 2** — click the **P2** button in the top-left corner
4. Use Tab 1 as Player 1 and Tab 2 as Player 2

> The P1/P2 buttons disappear if you connect a wallet. Use one or the other, not both.

---

## Game Flow

1. **P1** clicks **Create Game** → a game ID appears
2. **P2** clicks **Join Game** → enters the game ID
3. Both players enter the **Placement Phase** — place all 10 pieces in your half of the board (rows 0–3 for P1, rows 6–9 for P2)
4. Both players click **Ready** when all pieces are placed
5. **Battle Phase** begins — P1 goes first
6. Click a piece to select it, then click a destination square to move
7. If you attack an opponent's piece, combat resolves automatically
8. Capture the opponent's **Flag** to win — or click **Forfeit** to concede

---

## Piece Reference

remains the same

## Notes

- Each tab maintains its own player identity via sessionStorage — tabs are independent
- Burner account keys are prefunded on local Katana only — they won't work on Slot/Sepolia
- If the board gets stuck, refresh both tabs and restart from Terminal 1