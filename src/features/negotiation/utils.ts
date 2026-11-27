import {
  MAX_COUNTER_OFFERS,
  MIN_OFFER_RATIO,
  OFFER_CUTOFF_HOUR,
  STATUS_LABELS,
} from "@/features/negotiation/constants";
import { bagsLabel, priceLabel } from "@/core/utils/format";
import { ApiError } from "@/core/api/client";
import type { NegotiationThread } from "@/types/domain";

export interface PartialFillInfo {
  available: number;
  /** Bag count the buyer asked for, for the prototype's qty-mismatch dialog. */
  requested?: number;
  price?: number;
}

const PARTIAL_FILL_CODES = new Set(["PARTIAL_FILL_REQUIRED", "NOT_ENOUGH_BAGS"]);

/**
 * Server shortfalls like:
 * `{ code: "NOT_ENOUGH_BAGS", details: { available: 10 } }`
 */
export function getPartialFillInfo(error: unknown): PartialFillInfo | null {
  if (!(error instanceof ApiError) || !error.code || !PARTIAL_FILL_CODES.has(error.code)) {
    return null;
  }
  const details = error.details;
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const record = details as Record<string, unknown>;
  const readCount = (value: unknown): number | undefined => {
    const n = typeof value === "string" ? Number(value) : value;
    return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const available = readCount(
    record["available"] ?? record["availableBags"] ?? record["quantityBags"] ?? record["bags"],
  );
  if (!available) return null;
  const requested = readCount(
    record["requested"] ?? record["requestedBags"] ?? record["bagsRequested"],
  );
  const rawPrice = record["price"] ?? record["finalPrice"];
  const price = readCount(rawPrice);
  return {
    available,
    ...(requested ? { requested } : {}),
    ...(price ? { price } : {}),
  };
}

/** Prototype rule: an offer cannot be below 90% of the listed price. */
export function offerFloor(listedPrice: number): number {
  return Math.ceil(listedPrice * MIN_OFFER_RATIO);
}

export type NegotiationRole = "buyer" | "seller";

/**
 * Buyers cannot bid above the listed price; sellers quoting against a buyer's
 * target may ask for more, while both still respect the 90% floor.
 */
export function validateOfferPrice(
  raw: string,
  listedPrice: number,
  role: NegotiationRole = "buyer",
): string | null {
  const value = Number(raw.trim().replace(/,/g, ""));
  if (!raw.trim() || !Number.isFinite(value) || value <= 0) {
    return "Enter your offer price per bag.";
  }
  // §22D: when a BUY requirement has no target price, the seller's first
  // price is open — any positive price is valid; there is no ₹0 floor.
  if (role === "seller" && listedPrice <= 0) return null;
  const floor = offerFloor(listedPrice);
  if (value < floor) {
    return `Offer must be at least ${priceLabel(floor)} (90% of listed price).`;
  }
  if (role === "buyer" && value > listedPrice) {
    return `Offer cannot exceed the listed price of ${priceLabel(listedPrice)}.`;
  }
  return null;
}

export function validateBags(raw: string, availableBags: number): string | null {
  const value = Number(raw.trim());
  if (!raw.trim() || !Number.isInteger(value) || value <= 0) {
    return "Enter the number of bags you need.";
  }
  if (availableBags > 0 && value > availableBags) {
    return `Only ${bagsLabel(availableBags)} are available.`;
  }
  return null;
}

/** `forceClosed` lets a route demo the prototype's "offers closed" state. */
export function isOfferWindowOpen(now = new Date(), forceClosed = false): boolean {
  if (forceClosed) return false;
  return now.getHours() < OFFER_CUTOFF_HOUR;
}

/** Most recent offer in the thread, regardless of who made it. */
export function latestOfferPrice(thread: NegotiationThread): number {
  for (let i = thread.messages.length - 1; i >= 0; i -= 1) {
    const message = thread.messages[i];
    if (message.kind === "offer" && message.price != null) return message.price;
  }
  return thread.listedPrice;
}

/** Most recent offer from the counterparty (the one you can accept). */
export function latestCounterPrice(thread: NegotiationThread): number | null {
  for (let i = thread.messages.length - 1; i >= 0; i -= 1) {
    const message = thread.messages[i];
    if (message.kind === "offer" && message.author === "them" && message.price != null) {
      return message.price;
    }
  }
  return null;
}

export function countersRemaining(thread: NegotiationThread): number {
  const serverLeft = thread.counters?.[thread.role]?.left;
  return serverLeft != null
    ? Math.max(0, serverLeft)
    : Math.max(0, (thread.counters?.max ?? MAX_COUNTER_OFFERS) - thread.counterCount);
}

export function statusLabel(thread: NegotiationThread): string {
  return STATUS_LABELS[thread.status][thread.role];
}

/**
 * Completed Trades includes accepted trades awaiting broker choice (`confirmed`)
 * and backend rows that only carry `trade`/`confirmedAt` evidence.
 */
export function isCompletedTradeStatus(thread: NegotiationThread): boolean {
  return (
    thread.status === "completed" ||
    thread.status === "confirmed" ||
    thread.status === "cancelled" ||
    Boolean(thread.trade) ||
    Boolean(thread.confirmedAt)
  );
}

export function isActiveStatus(thread: NegotiationThread): boolean {
  return !isCompletedTradeStatus(thread);
}

/**
 * One place that decides what a user may do next in a thread.
 *
 * Backend turn fields win over cached status text: after a decline the thread
 * can stay open with the turn handed back to the offerer. Treating every
 * `declined` status as terminal is what leaves one or both sides with no way
 * to continue the negotiation.
 */
export type NegotiationPhase =
  | "completed"
  | "confirmed"
  | "withdrawn"
  | "cancelled"
  | "closed"
  | "respond"
  | "offer"
  | "waiting";

export interface ThreadState {
  phase: NegotiationPhase;
  /** Backend says this user is the next actor. */
  myTurn: boolean;
  /** Chat stays available for any non-terminal thread, regardless of turn. */
  canChat: boolean;
  /** The same-thread counter endpoint is valid for this user (§22D). */
  canCounter: boolean;
  /** Server-reported counters left for the current role. */
  countersLeft: number;
  completedTrade: boolean;
  /** A declined offer exists in a non-terminal thread. */
  declinedNotice: boolean;
}

export function threadState(thread: NegotiationThread): ThreadState {
  const lastOffer = [...thread.messages]
    .reverse()
    .find((message) => message.kind === "offer");
  const declinedNotice =
    thread.status === "declined" ||
    lastOffer?.status === "declined" ||
    thread.messages.some(
      (message) =>
        message.kind === "system" && /declined/i.test(message.text ?? ""),
    );
  const completedTrade =
    thread.status === "completed" ||
    thread.status === "confirmed" ||
    Boolean(thread.trade) ||
    Boolean(thread.confirmedAt) ||
    thread.messages.some(
      (message) =>
        message.kind === "system" &&
        /trade[\s_-]*(completed|confirmed)/i.test(message.text ?? ""),
    );
  const withdrawn =
    thread.status === "withdrawn" || thread.closeReason === "WITHDRAWN";
  const cancelled =
    thread.status === "cancelled" ||
    thread.closeReason === "QUANTITY_MISMATCH" ||
    thread.uiStatus === "CANCELLED";
  const myTurn =
    thread.isMyTurn === true ||
    (thread.isMyTurn === undefined && thread.status === "your_turn");
  const countersLeft = countersRemaining(thread);
  const hasTurn = myTurn || Boolean(thread.turnUserId);
  const open =
    !completedTrade &&
    !withdrawn &&
    !cancelled &&
    (thread.status === "your_turn" ||
      thread.status === "waiting" ||
      hasTurn ||
      Boolean(thread.pendingOffer));

  let phase: NegotiationPhase;
  if (completedTrade) {
    phase =
      thread.status === "confirmed" || thread.brokerPending || thread.buyerCanChooseBroker
        ? "confirmed"
        : "completed";
  } else if (withdrawn) {
    phase = "withdrawn";
  } else if (cancelled) {
    phase = "cancelled";
  } else if (!open) {
    phase = "closed";
  } else if (thread.pendingOffer?.author === "them" && myTurn) {
    phase = "respond";
  } else if (myTurn) {
    phase = "offer";
  } else {
    phase = "waiting";
  }

  return {
    phase,
    myTurn,
    canChat: open,
    // §22D: only the party whose turn it is may counter, and only while they
    // have counters left. After a decline the turn returns to the OFFERER;
    // the decliner must not be shown an offer button.
    canCounter: (phase === "respond" || phase === "offer") && countersLeft > 0,
    countersLeft,
    completedTrade,
    declinedNotice: declinedNotice && !completedTrade && !withdrawn && !cancelled,
  };
}

/**
 * §22D NEGOTIATION_EXISTS carries `details.negotiationId`. The safe recovery is
 * to open that thread instead of trying to create a second open negotiation.
 */
export function existingNegotiationId(error: unknown): string | undefined {
  if (!(error instanceof ApiError) || error.code !== "NEGOTIATION_EXISTS") return undefined;
  const details = error.details;
  if (!details || typeof details !== "object" || Array.isArray(details)) return undefined;
  const id = (details as Record<string, unknown>)["negotiationId"];
  return typeof id === "string" && id.trim() ? id : undefined;
}

/** Short time label for a newly created message. */
export function clockLabel(now = new Date()): string {
  return now
    .toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s/g, " ");
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Nov 23, 2026" — matches the prototypes' completed-trade labels. */
export function todayLabel(now = new Date()): string {
  return `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

/** Expo Router params can be strings or arrays — take the first value. */
export function stringParam(
  value: string | string[] | undefined | null,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

export function numberParam(
  value: string | string[] | undefined | null,
  fallback = 0,
): number {
  const parsed = Number(stringParam(value));
  return stringParam(value) && Number.isFinite(parsed) ? parsed : fallback;
}
