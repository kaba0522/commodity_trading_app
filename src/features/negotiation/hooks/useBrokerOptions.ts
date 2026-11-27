import { getFriendlyApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useCallback, useEffect, useState } from "react";
import { brokersApi, type BrokerOption } from "../api/brokersApi";

/** GET /brokers/options — broker picker on the trade-confirmation screen. */
export function useBrokerOptions() {
  const { runWithAuth } = useAuth();
  const [options, setOptions] = useState<BrokerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setOptions(await runWithAuth((token) => brokersApi.options(token)));
    } catch (e) {
      setError(getFriendlyApiError(e, "Could not load brokers"));
      setOptions([]);
    } finally {
      setIsLoading(false);
    }
  }, [runWithAuth]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return { options, isLoading, error, retry: load };
}
