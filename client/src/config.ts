export const WORLD_ADDRESS  = import.meta.env.VITE_WORLD_ADDRESS  as string;
export const ACTIONS_ADDRESS = import.meta.env.VITE_ACTIONS_ADDRESS as string;
export const RPC_URL = import.meta.env.VITE_RPC_URL as string;
export const TORII_URL = import.meta.env.VITE_TORII_URL as string;

// Piece definitions
export const PIECES = [
  { id: 0,  rank: 0,  name: "Flag",    symbol: "⚑",  abbr: "F"  },
  { id: 1,  rank: 1,  name: "Spy",     symbol: "◆",  abbr: "S"  },
  { id: 2,  rank: 2,  name: "Scout",   symbol: "◎",  abbr: "2"  },
  { id: 3,  rank: 3,  name: "Miner",   symbol: "⛏",  abbr: "3"  },
  { id: 4,  rank: 6,  name: "Captain", symbol: "✦",  abbr: "6"  },
  { id: 5,  rank: 7,  name: "Major",   symbol: "★",  abbr: "7"  },
  { id: 6,  rank: 8,  name: "Colonel", symbol: "◈",  abbr: "8"  },
  { id: 7,  rank: 9,  name: "General", symbol: "❖",  abbr: "9"  },
  { id: 8,  rank: 10, name: "Marshal", symbol: "♔",  abbr: "10" },
  { id: 9,  rank: 11, name: "Bomb",    symbol: "◉",  abbr: "B"  },
];

// P2 pieces offset by 10
export const P2_PIECES = PIECES.map(p => ({ ...p, id: p.id + 10 }));

export const RANK_NAME: Record<number, string> = {
  0: "Flag", 1: "Spy", 2: "Scout", 3: "Miner",
  6: "Captain", 7: "Major", 8: "Colonel", 9: "General",
  10: "Marshal", 11: "Bomb"
};

export const RANK_ABBR: Record<number, string> = {
  0: "F", 1: "S", 2: "2", 3: "3",
  6: "6", 7: "7", 8: "8", 9: "9",
  10: "10", 11: "B"
};

// Status constants
export const STATUS_LOBBY    = 0;
export const STATUS_PLACING  = 1;
export const STATUS_ACTIVE   = 2;
export const STATUS_FINISHED = 3;

export const EMPTY = 255;
