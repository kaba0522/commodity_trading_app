import { useAuth } from "@/features/auth/hooks/useAuth";
import { useCallback } from "react";
import type { NegotiationThread, VoiceNote } from "@/types/domain";
import { negotiationApi, type AcceptResult } from "../api/negotiationApi";
import { uploadVoiceNote } from "../api/voiceNoteApi";

export interface CounterActionInput {
  price: number;
  note?: string;
  voice?: VoiceNote;
}

export interface ChatActionInput {
  text?: string;
  voice?: VoiceNote;
}

/** All mutating §22D calls, with voice upload and auth refresh centralised. */
export function useNegotiationActions() {
  const { runWithAuth, session } = useAuth();
  const currentUserId = session?.user.id;

  const counter = useCallback(
    async (threadId: string, input: CounterActionInput): Promise<NegotiationThread> =>
      runWithAuth(async (token) => {
        const voiceNoteUrl = input.voice ? await uploadVoiceNote(input.voice, token) : undefined;
        return negotiationApi.counter(
          threadId,
          {
            price: input.price,
            ...(input.note ? { messageText: input.note } : {}),
            ...(voiceNoteUrl ? { voiceNoteUrl } : {}),
          },
          token,
          currentUserId,
        );
      }),
    [runWithAuth, currentUserId],
  );

  const accept = useCallback(
    async (offerId: string, acceptPartial = false): Promise<AcceptResult> =>
      runWithAuth((token) => negotiationApi.accept(offerId, token, currentUserId, acceptPartial)),
    [runWithAuth, currentUserId],
  );

  const decline = useCallback(
    async (offerId: string): Promise<NegotiationThread> =>
      runWithAuth((token) => negotiationApi.decline(offerId, token, currentUserId)),
    [runWithAuth, currentUserId],
  );

  const withdraw = useCallback(
    async (threadId: string): Promise<NegotiationThread> =>
      runWithAuth((token) => negotiationApi.withdraw(threadId, token, currentUserId)),
    [runWithAuth, currentUserId],
  );

  const sendMessage = useCallback(
    async (threadId: string, input: ChatActionInput): Promise<NegotiationThread> =>
      runWithAuth(async (token) => {
        const voiceUrl = input.voice ? await uploadVoiceNote(input.voice, token) : undefined;
        if (voiceUrl) {
          return negotiationApi.sendMessage(
            threadId,
            { type: "voice_note", content: voiceUrl },
            token,
            currentUserId,
          );
        }
        if (!input.text?.trim()) throw new Error("Type a message or record a voice note.");
        return negotiationApi.sendMessage(
          threadId,
          { type: "text", content: input.text.trim() },
          token,
          currentUserId,
        );
      }),
    [runWithAuth, currentUserId],
  );

  return { counter, accept, decline, withdraw, sendMessage };
}
