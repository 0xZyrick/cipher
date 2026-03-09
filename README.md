# Cipher

> Hidden ranks. Onchain combat. Starknet.

Cipher is a two-player war game where nobody knows what they're walking into until combat forces a reveal. You place your army in secret. You move blind. When pieces clash, ranks are exposed onchain — the stronger piece survives, the weaker one is gone for good. Find and capture the enemy Flag to win.

Every move hits the chain. Every rank is locked in as a Poseidon hash commitment the moment you place your piece. You cannot change it. You cannot lie. Combat is the only moment truth is forced onchain.

---

## Play

**Live:** [playcipher.vercel.app](https://playcipher.vercel.app)

**Video:** [Watch Gameplay](https://youtu.be/zV9K-KGHW00)

Two players needed:

1. Open two browsers — connect a wallet on each using [Cartridge Controller](https://docs.cartridge.gg/controller)
2. Player one clicks **Create Game** — copy the Game ID
3. Player two clicks **Join Campaign** — paste the Game ID
4. Both players deploy their 10 pieces in their deployment zone
5. Take turns moving and attacking
6. Capture the enemy Flag to win

---

## How It Works

### Cryptographic Fog of War

Every piece placement stores a commitment onchain:

```
rank_commitment = poseidon_hash(rank, salt)
```

The actual rank never touches the chain until combat forces a reveal. When you attack, you reveal your rank and salt — the contract re-hashes and verifies it matches what you committed. You cannot change your piece's rank after placing it. The game is cheat-proof by design.

### Piece Ranks

| Piece | Rank | Special Rule |
|-------|------|--------------|
| Flag | 0 | Capture this to win |
| Bomb | — | Kills all attackers except Miner |
| Spy | 1 | Beats Marshal when attacking |
| Scout | 2 | Moves any distance |
| Miner | 3 | Defuses Bombs |
| Captain | 6 | — |
| Major | 7 | — |
| Colonel | 8 | — |
| General | 9 | — |
| Marshal | 10 | Highest rank |

### Combat Resolution

All combat resolves deterministically onchain:

- Higher rank wins
- Spy beats Marshal (attacker only)
- Miner defuses Bomb
- Flag capture = instant win
- Ties = mutual destruction

### Two-Phase Turn Structure

A move onto an occupied square suspends the game in `PendingCombat` state. Neither player can move until the defender calls `resolve_combat`. Turn count advances only after resolution.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Cairo + Dojo Engine 1.8.0 |
| World State | Dojo models (Game, Piece, Square, PendingCombat) |
| Realtime Sync | Torii indexer |
| Wallet | Cartridge Controller |
| Deployment | Slot / Starknet Sepolia |
| Frontend | React + TypeScript + Vite |

---

## Contract Architecture

```
src/
├── models.cairo        # Game, Piece, Square, PlayerGame, PendingCombat, GameCounter
├── lib.cairo           # World entry
└── systems/
    └── actions.cairo   # create_game, place_piece, ready, move_piece,
                        # resolve_combat, forfeit
```

### Key Models

- **Game** — tracks players, status, turn, piece counts
- **Piece** — stores rank_commitment, position, alive state
- **Square** — maps board positions to pieces
- **PendingCombat** — holds attacker/defender during combat phase
- **PlayerGame** — links wallet address to active game

---

## Development

### Prerequisites

- [Scarb](https://docs.swmansion.com/scarb/) 
- [Dojo](https://book.dojoengine.org/) 1.8.0
- [Node.js](https://nodejs.org/) 18+

### Setup

```bash
# Clone the repo
git clone https://github.com/0xZyrick/cipher
cd cipher
# GitHub: https://github.com/0xZyrick/cipher

# Build contracts
scarb build

# Start local chain
katana

# Start indexer (separate terminal)
torii

# Install frontend deps
cd client
npm install

# Start frontend
npm run dev
```

### Environment Variables

Create `client/.env.local`:

```env
VITE_WORLD_ADDRESS=
VITE_ACTIONS_ADDRESS=
VITE_RPC_URL=
VITE_TORII_URL=
```

### Deploy to Slot

```bash
sozo migrate --profile slot
```

---

## License

MIT