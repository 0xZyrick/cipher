// Katana prefunded accounts
export const PLAYER1 = "0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec";
export const PLAYER2 = "0x13d9ee239f33fea4f8785b9e3870ade909e20a9599ae7cd62c1c292b73af1b7";

export const ACCOUNTS: Record<string, string> = {
  [PLAYER1]: "0xc5b2fcab997346f3ea1c00b002ecf6f382c5f9c9659a3894eb783c5320f912",
  [PLAYER2]: "0x1c9053c053edf324aec366a34c6901b1095b07af69495bffec7d7fe21effb1b",
};

// Per-tab identity stored in sessionStorage so each tab is independent
const SESSION_KEY = "cipher_active_player";

export function getActivePlayer(): string {
  return sessionStorage.getItem(SESSION_KEY) || PLAYER1;
}

export function setActivePlayer(address: string) {
  sessionStorage.setItem(SESSION_KEY, address);
}

// Legacy compat — reads from sessionStorage
export const ACTIVE_PLAYER = getActivePlayer();