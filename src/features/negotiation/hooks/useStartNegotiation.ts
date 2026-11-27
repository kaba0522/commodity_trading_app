import { useAuth } from "@/features/auth/hooks/useAuth";
import { useCallback } from "react";
import type { NegotiationThread, VoiceNote } from "@/types/domain";
import { negotiationApi, type AcceptResult } from "../api/negotiationApi";
import { uploadVoiceNote } from "../api/voiceNoteApi";

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

  const start = useCallback(
    async (input: StartOfferInput): Promise<NegotiationThread> =>
      runWithAuth(async (token) => {
        const voiceNoteUrl = input.voice ? await uploadVoiceNote(input.voice, token) : undefined;
        return negotiationApi.start(
          {
            listingId: input.listingId,
            price: input.price,
            bagsRequested: input.bagsRequested,
            ...(input.note ? { messageText: input.note } : {}),
            ...(voiceNoteUrl ? { voiceNoteUrl } : {}),
          },
          token,
          currentUserId,
        );
      }),
    [runWithAuth, currentUserId],
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
