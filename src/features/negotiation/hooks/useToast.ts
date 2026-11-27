import { useEffect, useState } from "react";

/** Short-lived offer/counter confirmation used across negotiation screens. */
export function useToast(durationMs = 2200) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs]);

  return [message, setMessage] as const;
}
