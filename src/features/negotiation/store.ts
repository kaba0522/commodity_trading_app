import { allMockThreads } from "@/mocks/negotiations";
import { bagsLabel, priceLabel } from "@/core/utils/format";
import type {
  NegotiationMessage,
  NegotiationThread,
  VoiceNote,
} from "@/types/domain";
import { useSyncExternalStore } from "react";
import { clockLabel, latestCounterPrice, latestOfferPrice, todayLabel } from "@/features/negotiation/utils";

/**
 * Tiny in-memory store for the mock-first negotiation flow. It keeps thread
 * state across route changes (trades list → chat → trade confirmation) and is
 * the single seam to replace with API-backed state when offers/trades land.
 */
let threads: NegotiationThread[] = allMockThreads();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): NegotiationThread[] {
  return threads;
}

function commit(next: NegotiationThread[]): void {
  threads = next;
  listeners.forEach((listener) => listener());
}

function patchThread(id: string, update: (thread: NegotiationThread) => NegotiationThread): void {
  commit(threads.map((thread) => (thread.id === id ? update(thread) : thread)));
}

function messageId(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function offerMessage(author: "you" | "them", price: number, note?: string): NegotiationMessage {
  return {
    id: messageId(),
    kind: "offer",
    author,
    price,
    note: note?.trim() ? note.trim() : undefined,
    time: clockLabel(),
  };
}

function systemMessage(text: string): NegotiationMessage {
  return { id: messageId(), kind: "system", author: "system", text, time: "" };
}

function voiceMessage(author: "you" | "them", voice: VoiceNote): NegotiationMessage {
  return {
    id: messageId(),
    kind: "voice",
    author,
    voice,
    time: clockLabel(),
  };
}

export function useNegotiationThreads(): NegotiationThread[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useNegotiationThread(id?: string | null): NegotiationThread | null {
  const all = useNegotiationThreads();
  if (!id) return null;
  return all.find((thread) => thread.id === id) ?? null;
}

export function getThread(id: string): NegotiationThread | null {
  return threads.find((thread) => thread.id === id) ?? null;
}

export interface StartThreadInput {
  role: "buyer" | "seller";
  counterparty: string;
  item: string;
  category: string;
  listedPrice: number;
  availableBags: number;
  requestedBags: number;
  price: number;
  bags: number;
  note?: string;
  voice?: VoiceNote;
  weightKg?: number;
  paymentTerms?: string;
}

/** Buyer sends an offer on a listing; seller sends an offer on a requirement. */
export function startOfferThread(input: StartThreadInput): string {
  const id = `t-${Date.now()}`;
  const thread: NegotiationThread = {
    id,
    role: input.role,
    counterparty: input.counterparty,
    item: input.item,
    category: input.category,
    listedPrice: input.listedPrice,
    availableBags: input.availableBags,
    requestedBags: input.bags,
    weightKg: input.weightKg,
    paymentTerms: input.paymentTerms,
    status: "waiting",
    counterCount: 0,
    updatedAt: "Just now",
    messages: [
      systemMessage(`${todayLabel()} · ${input.item}`),
      offerMessage("you", input.price, input.note),
      ...(input.voice ? [voiceMessage("you", input.voice)] : []),
    ],
  };
  commit([thread, ...threads]);
  return id;
}

/** Buy-now path: price agreed immediately, broker still to be selected. */
export function startDirectTradeThread(input: StartThreadInput): string {
  const id = `t-${Date.now()}`;
  const thread: NegotiationThread = {
    id,
    role: input.role,
    counterparty: input.counterparty,
    item: input.item,
    category: input.category,
    listedPrice: input.listedPrice,
    availableBags: input.availableBags,
    requestedBags: input.bags,
    weightKg: input.weightKg,
    paymentTerms: input.paymentTerms,
    status: "confirmed",
    agreedPrice: input.price,
    counterCount: 0,
    updatedAt: "Just now",
    messages: [
      systemMessage(`${todayLabel()} · ${input.item}`),
      offerMessage("you", input.price, input.note),
      ...(input.voice ? [voiceMessage("you", input.voice)] : []),
      systemMessage(`Trade agreed at ${priceLabel(input.price)} × ${input.bags} bags`),
    ],
  };
  commit([thread, ...threads]);
  return id;
}

export interface RequirementSeed {
  id?: string;
  buyer?: string;
  item?: string;
  category?: string;
  targetPrice?: string | number;
  bags?: string | number;
  weightKg?: string | number;
  paymentTerms?: string;
}

/** Seller tapping a buyer requirement lands in the same chat state machine. */
export function ensureSellerThread(seed: RequirementSeed): string | null {
  const targetPrice = Number(seed.targetPrice ?? 0);
  const bags = Number(seed.bags ?? 0);
  if (!seed.buyer || !seed.item || !Number.isFinite(targetPrice) || targetPrice <= 0) {
    return null;
  }

  const existing = threads.find(
    (thread) =>
      thread.role === "seller" &&
      thread.counterparty === seed.buyer &&
      thread.item.split(" · ")[0] === seed.item,
  );
  if (existing) return existing.id;

  const id = `s-${Date.now()}`;
  const thread: NegotiationThread = {
    id,
    role: "seller",
    counterparty: seed.buyer,
    item: seed.item,
    category: (seed.category as NegotiationThread["category"]) || "Uncategorized",
    listedPrice: targetPrice,
    availableBags: bags > 0 ? bags : 100,
    requestedBags: bags > 0 ? bags : 50,
    weightKg: Number(seed.weightKg ?? 0) || undefined,
    paymentTerms: seed.paymentTerms,
    status: "your_turn",
    counterCount: 0,
    updatedAt: "Just now",
    messages: [
      systemMessage(`${todayLabel()} · ${seed.item}`),
      offerMessage("them", targetPrice, "Buyer's target price"),
    ],
  };
  commit([thread, ...threads]);
  return id;
}

export function submitCounter(
  id: string,
  price: number,
  note?: string,
  voice?: VoiceNote,
): void {
  patchThread(id, (thread) => ({
    ...thread,
    status: "waiting",
    counterCount: thread.counterCount + 1,
    updatedAt: "Just now",
    messages: [
      ...thread.messages,
      offerMessage("you", price, note),
      ...(voice ? [voiceMessage("you", voice)] : []),
    ],
  }));
}

export function acceptOffer(id: string, bags?: number): void {
  patchThread(id, (thread) => {
    const price = latestCounterPrice(thread) ?? latestOfferPrice(thread);
    const agreedBags = bags && bags > 0 ? bags : thread.requestedBags;
    return {
      ...thread,
      requestedBags: agreedBags,
      status: "confirmed",
      agreedPrice: price,
      updatedAt: "Just now",
      messages: [
        ...thread.messages,
        systemMessage(`You accepted ${priceLabel(price)} for ${bagsLabel(agreedBags)}`),
      ],
    };
  });
}

export function declineOffer(id: string): void {
  patchThread(id, (thread) => ({
    ...thread,
    status: "declined",
    updatedAt: "Just now",
    messages: [...thread.messages, systemMessage("You declined this offer")],
  }));
}

export function withdrawOffer(id: string): void {
  patchThread(id, (thread) => ({
    ...thread,
    status: "withdrawn",
    updatedAt: "Just now",
    messages: [...thread.messages, systemMessage("Offer has been withdrawn")],
  }));
}

export function confirmTrade(id: string, broker: string, bags?: number): void {
  patchThread(id, (thread) => {
    const price = thread.agreedPrice ?? latestOfferPrice(thread);
    const tradeBags = bags && bags > 0 ? bags : thread.requestedBags;
    return {
      ...thread,
      requestedBags: tradeBags,
      status: "completed",
      updatedAt: "Just now",
      trade: {
        price,
        bags: tradeBags,
        broker,
        date: todayLabel(),
      },
      messages: [
        ...thread.messages,
        systemMessage(`Trade completed · ${priceLabel(price)} × ${bagsLabel(tradeBags)}`),
      ],
    };
  });
}
