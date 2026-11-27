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

export function isActiveStatus(thread: NegotiationThread): boolean {
  return thread.status !== "completed" && thread.status !== "cancelled";
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
