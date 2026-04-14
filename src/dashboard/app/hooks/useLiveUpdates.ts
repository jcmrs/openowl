import { useEffect } from "react";
import type { OwlClient } from "../lib/owl-client.js";

export function useLiveUpdates(
  client: OwlClient | null,
  type: string,
  callback: (msg: any) => void
): void {
  useEffect(() => {
    if (!client) return;
    return client.onMessage((msg) => {
      if (msg.type === type) callback(msg);
    });
  }, [client, type, callback]);
}
