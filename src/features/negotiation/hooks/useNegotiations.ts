import { resolveBackendRole } from "@/core/auth/roleStore";
import { getFriendlyApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
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

  /**
   * An active flag prevents an in-flight request from overwriting the list
   * after the Trades tab loses focus and a newer fetch has already started.
   */
  const load = useCallback(
    async (isActive: () => boolean = () => true) => {
      setIsLoading(true);
      setError(null);
      try {
        const rows = await runWithAuth((token) =>
          negotiationApi.list(tab, token, currentUserId, role),
        );
        if (isActive()) {
          setThreads(
            rows.filter((thread) => !roleOverride || thread.role === roleOverride),
          );
        }
      } catch (e) {
        if (isActive()) {
          setError(getFriendlyApiError(e, "Could not load negotiations"));
          setThreads([]);
        }
      } finally {
        if (isActive()) setIsLoading(false);
      }
    },
    [runWithAuth, currentUserId, role, roleOverride, tab],
  );

  // Every Trades tab visit (including the first mount and tab switches)
  // refreshes from the server instead of showing cached list state.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void load(() => active);
      return () => {
        active = false;
      };
    }, [load]),
  );

  return { threads, isLoading, error, retry: () => load() };
}
