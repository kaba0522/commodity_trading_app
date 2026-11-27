import { getFriendlyApiError } from "@/core/api/client";
import { resolveBackendRole } from "@/core/auth/roleStore";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useCallback, useEffect, useState } from "react";
import type { NegotiationThread } from "@/types/domain";
import { negotiationApi } from "../api/negotiationApi";

/** GET /negotiations/:id — one live thread, refreshed on id/auth changes. */
export function useNegotiationThread(id?: string | null) {
  const { runWithAuth, session } = useAuth();
  const [thread, setThread] = useState<NegotiationThread | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);

  const currentUserId = session?.user.id;
  const backendRole = resolveBackendRole(session?.user);
  const defaultRole = backendRole === "seller" ? "seller" : "buyer";

  const load = useCallback(async () => {
    if (!id) {
      setThread(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setThread(
        await runWithAuth((token) =>
          negotiationApi.getById(id, token, currentUserId, defaultRole),
        ),
      );
    } catch (e) {
      setError(getFriendlyApiError(e, "Could not load this negotiation"));
      setThread(null);
    } finally {
      setIsLoading(false);
    }
  }, [id, runWithAuth, currentUserId, defaultRole]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return { thread, setThread, isLoading, error, retry: load };
}
