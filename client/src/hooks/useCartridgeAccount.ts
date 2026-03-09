import { useState, useEffect } from "react";
import { RpcProvider } from "starknet";
import { cartridgeConnector } from "../cartridge";

export interface CartridgeSession {
  address: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  account: any; // Cartridge account object — used directly for execute
  isConnected: boolean;
}

const SESSION_KEY = "cipher_cartridge_address";

const provider = new RpcProvider({ nodeUrl: (import.meta.env as Record<string,string>).VITE_RPC_URL || "http://localhost:5050" });

export function useCartridgeAccount() {
  const [session, setSession] = useState<CartridgeSession | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Try to restore session on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      tryReconnect(saved);
    }
  }, []);

  async function tryReconnect(address: string) {
    try {
      await cartridgeConnector.connect();
      const account = await cartridgeConnector.account(provider);
      if (account) {
        setSession({ address, account, isConnected: true });
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      // Force fresh session — clears stale nonce
      await cartridgeConnector.disconnect().catch(() => {});
      await cartridgeConnector.connect();
      const account = await cartridgeConnector.account(provider);
      const address = account?.address || "";
      sessionStorage.setItem(SESSION_KEY, address);
      setSession({ address, account, isConnected: true });
    } catch (e: unknown) {
      setError((e as Error).message || "Failed to connect");
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    try {
      await cartridgeConnector.disconnect();
    } catch { /* ignore */ }
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  return { session, connect, disconnect, connecting, error };
}