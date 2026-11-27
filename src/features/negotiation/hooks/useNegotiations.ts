import { resolveBackendRole } from "@/core/auth/roleStore";
import { getFriendlyApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useCallback, useEffect, useState } from "react";
import { negotiationApi } from "../api/negotiationApi";
import type { NegotiationThread } from "@/types/domain";

export type NegotiationTab = "active" | "completed";

/** GET /negotiations?tab=… — server-owned Trades/Orders lists. */
export function useNegotiations(tab: NegotiationTab, roleOverride?: "buyer" | "seller") {
  const { runWithAuth, session } = useAuth();
  const [threads, setThreads] = useState<NegotiationThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUserId = session?.user.id;
  const backendRole = resolveBackendRole(session?.user);
  const role = roleOverride ?? (backendRole === "seller" ? "seller" : "buyer");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await runWithAuth((token) =>
        negotiationApi.list(tab, token, currentUserId, role),
      );
      setThreads(rows.filter((thread) => !roleOverride || thread.role === roleOverride));
    } catch (e) {
      setError(getFriendlyApiError(e, "Could not load negotiations"));
      setThreads([]);
    } finally {
      setIsLoading(false);
    }
  }, [runWithAuth, currentUserId, role, roleOverride, tab]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return { threads, isLoading, error, retry: load };
}
