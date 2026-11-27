import { resolveBackendRole } from "@/core/auth/roleStore";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useCallback } from "react";
import type { NegotiationThread, VoiceNote } from "@/types/domain";
import { negotiationApi, type AcceptResult } from "../api/negotiationApi";
import { uploadVoiceNote } from "../api/voiceNoteApi";
import { existingNegotiationId, type NegotiationRole } from "../utils";

export interface StartOfferInput {
  listingId: string;
  price: number;
  bagsRequested: number;
  note?: string;
  voice?: VoiceNote;
}

export interface BuyNowInput {
  listingId: string;
  bagsRequested: number;
  acceptPartial?: boolean;
}

/** POST /negotiations and POST /negotiations/buy-now with voice upload. */
export function useStartNegotiation() {
  const { runWithAuth, session } = useAuth();
  const currentUserId = session?.user.id;
  const backendRole = resolveBackendRole(session?.user);
  const defaultRole: NegotiationRole = backendRole === "seller" ? "seller" : "buyer";

  const start = useCallback(
    async (input: StartOfferInput): Promise<NegotiationThread> =>
      runWithAuth(async (token) => {
        const voiceNoteUrl = input.voice ? await uploadVoiceNote(input.voice, token) : undefined;
        try {
          return await negotiationApi.start(
            {
              listingId: input.listingId,
              price: input.price,
              bagsRequested: input.bagsRequested,
              ...(input.note ? { messageText: input.note } : {}),
              ...(voiceNoteUrl ? { voiceNoteUrl } : {}),
            },
            token,
            currentUserId,
            defaultRole,
          );
        } catch (error) {
          // §22D: NEGOTIATION_EXISTS tells us which thread is already open.
          // Re-open it instead of surfacing "already have an open negotiation".
          const existingId = existingNegotiationId(error);
          if (existingId) {
            return negotiationApi.getById(existingId, token, currentUserId, defaultRole);
          }
          throw error;
        }
      }),
    [runWithAuth, currentUserId, defaultRole],
  );

  const buyNow = useCallback(
    async (input: BuyNowInput): Promise<AcceptResult> =>
      runWithAuth((token) =>
        negotiationApi.buyNow(
          input.listingId,
          input.bagsRequested,
          token,
          currentUserId,
          input.acceptPartial ?? false,
        ),
      ),
    [runWithAuth, currentUserId],
  );

  return { start, buyNow };
}
