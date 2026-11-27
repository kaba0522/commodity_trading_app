import { ApiError, apiFetch } from "@/core/api/client";
import { NEGOTIATION_ENDPOINTS, apiUrl } from "@/core/api/endpoints";
import {
  bagsLabel,
  formatDateLabel,
  formatTradeDateLabel,
  priceLabel,
} from "@/core/utils/format";
import type {
  NegotiationMessage,
  NegotiationStatus,
  NegotiationThread,
} from "@/types/domain";
import { clockLabel } from "../utils";

type NegotiationRole = NegotiationThread["role"];

/**
 * §22D Negotiation API → the app's `NegotiationThread` domain shape.
 * The backend envelope is `{ success, data }`; every response is normalised
 * here so screens never branch on raw payload variants.
 */

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function obj(value: unknown): Obj {
  return isObj(value) ? value : {};
}

function text(record: Obj, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function number(record: Obj, ...keys: string[]): number | null {
  for (const key of keys) {
    const raw = record[key];
    const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function array(record: Obj, ...keys: string[]): Obj[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value.filter(isObj);
  }
  return [];
}

/** Accept `{ success, data }` and the few nested shapes the backend uses. */
function payload(raw: unknown): Obj {
  if (!isObj(raw)) return {};
  const inner = raw["data"];
  if (isObj(inner)) {
    // Keep sibling offers/messages/status when the backend nests the thread.
    for (const key of ["negotiation", "thread", "item"]) {
      if (isObj(inner[key])) return { ...inner, ...obj(inner[key]) };
    }
    return inner;
  }
  return raw;
}

function dataEnvelope(raw: unknown): Obj {
  if (!isObj(raw)) return {};
  return isObj(raw["data"]) ? obj(raw["data"]) : raw;
}

function partyName(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (!isObj(value)) continue;
    const name = text(value, "firmName", "name", "fullName", "buyerName", "sellerName");
    if (name) return name;
  }
  return "";
}

function timeLabel(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : clockLabel(date);
}

/** Sortable timestamp, accepting ISO strings and Unix seconds/milliseconds. */
function sortAtOf(record: Obj, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw < 1_000_000_000_000 ? raw * 1000 : raw;
    }
    if (typeof raw === "string" && raw.trim()) {
      const numeric = Number(raw);
      if (Number.isFinite(numeric) && numeric > 0) {
        return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
      }
      const parsed = Date.parse(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function systemMessage(content: string, sortAt?: number): NegotiationMessage {
  return {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: "system",
    author: "system",
    text: content,
    time: "",
    ...(sortAt !== undefined ? { sortAt } : {}),
  };
}

/** Interleave backend offers and chat into one chronological conversation. */
function chronological(messages: NegotiationMessage[]): NegotiationMessage[] {
  return messages
    .map((message, index) => ({ message, index }))
    .sort((left, right) => {
      const a = left.message.sortAt;
      const b = right.message.sortAt;
      if (a === undefined && b === undefined) return left.index - right.index;
      if (a === undefined) return 1;
      if (b === undefined) return -1;
      return a - b || left.index - right.index;
    })
    .map(({ message }) => message);
}

function isOfferDeclinedLabel(value: string): boolean {
  return /offer[\s_-]*declined/i.test(value);
}

function isTradeCompletionLabel(value: string): boolean {
  return /trade[\s_-]*(confirmed|completed)/i.test(value);
}

function positiveNumber(value: unknown): number | null {
  const raw = typeof value === "string" ? Number(value.replace(/[,₹\s]/g, "")) : value;
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null;
}

/** Price/bag values sometimes live on the system event rather than `trade`. */
function completionValues(record: Obj): { price: number | null; bags: number | null } {
  const nested = obj(
    record["metadata"] ??
      record["meta"] ??
      record["payload"] ??
      record["data"] ??
      record["trade"],
  );
  return {
    price:
      positiveNumber(record["finalPrice"] ?? record["tradePrice"] ?? record["price"]) ??
      positiveNumber(
        nested["finalPrice"] ?? nested["tradePrice"] ?? nested["price"] ?? nested["amount"],
      ),
    bags:
      positiveNumber(
        record["quantityBags"] ?? record["tradeBags"] ?? record["bags"] ?? record["bagsRequested"],
      ) ??
      positiveNumber(
        nested["quantityBags"] ?? nested["bags"] ?? nested["bagsRequested"] ?? nested["quantity"],
      ),
  };
}

/** Last resort: read values already rendered inside a backend message string. */
function completionValuesFromText(value: string): {
  price: number | null;
  bags: number | null;
} {
  const priceMatch =
    value.match(/(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d+)?)/i) ??
    value.match(/\b(?:price|amount|total)\b[^\d₹]*([\d,]+(?:\.\d+)?)/i);
  const bagsMatch =
    value.match(/([\d,]+)\s*bags?\b/i) ??
    value.match(/\bbags?\b[^\d]*([\d,]+)/i);
  return {
    price: priceMatch ? positiveNumber(priceMatch[1]) : null,
    bags: bagsMatch ? positiveNumber(bagsMatch[1]) : null,
  };
}

/** Prototype wording: `Trade completed · ₹12,200 × 50 bags`. */
function formatTradeSummary(price: number | null, bags: number | null): string {
  if (price === null && (bags === null || bags <= 0)) return "";
  const pricePart = price !== null ? priceLabel(price) : "₹—";
  const bagsPart = bags !== null && bags > 0 ? ` × ${bagsLabel(bags)}` : "";
  return ` · ${pricePart}${bagsPart}`;
}

function tradeSummaryOf(
  raw: Obj,
  fallbackPrice: number | null,
  fallbackBags: number | null,
): string {
  const content = text(raw, "content", "messageText");
  const own = completionValues(raw);
  const parsed = completionValuesFromText(content);
  return formatTradeSummary(
    own.price ?? parsed.price ?? fallbackPrice,
    own.bags ?? parsed.bags ?? fallbackBags,
  );
}

/** Replace raw backend event labels with the prototype's user-facing wording. */
function displayedSystemText(
  type: string,
  content: string,
  tradeSummary = "",
): string {
  const label = content || type.replace(/[_-]+/g, " ").toLowerCase();
  if (isOfferDeclinedLabel(label) || isOfferDeclinedLabel(type)) {
    return "You declined this offer";
  }
  if (isTradeCompletionLabel(label) || isTradeCompletionLabel(type)) {
    return `Trade completed${tradeSummary}`;
  }
  return label;
}

function authorOf(senderId: string, currentUserId?: string): "you" | "them" {
  return currentUserId && senderId ? (senderId === currentUserId ? "you" : "them") : "them";
}

/**
 * §22D says the pending offer lives in `offers[]` with `status: "pending"`.
 * Never infer it from rendered chat bubbles: after a decline the turn goes
 * back to the offerer, whose own offer is not accept/declineable by them.
 */
function pendingOfferOf(
  offers: Obj[],
  currentUserId?: string,
): NegotiationThread["pendingOffer"] | undefined {
  for (let i = offers.length - 1; i >= 0; i -= 1) {
    const offer = offers[i];
    const id = text(offer, "id");
    const price = number(offer, "price");
    const state = text(offer, "status").toLowerCase();
    if (!id || price === null || (state && state !== "pending")) continue;
    return {
      id,
      author: authorOf(text(offer, "byUserId"), currentUserId),
      price,
      bags: number(offer, "bagsRequested", "bags") ?? 0,
      isSystem: offer["isSystem"] === true,
    };
  }
  return undefined;
}

function nestedMedia(record: Obj): Obj {
  return obj(record["voiceNote"] ?? record["voice"] ?? record["audio"] ?? record["content"]);
}

/** Find the playable URL across the voice/message shapes the backend returns. */
function voiceUrlOf(record: Obj): string {
  const direct = text(
    record,
    "voiceNoteUrl",
    "voiceUrl",
    "audioUrl",
    "mediaUrl",
    "fileUrl",
    "url",
  );
  if (direct) return direct;

  const nested = nestedMedia(record);
  const nestedUrl = text(nested, "url", "secureUrl", "secure_url", "uri", "fileUrl");
  if (nestedUrl) return nestedUrl;

  // A voice note may be posted as `{ type: "voice_note", content: "<url>" }`.
  const content = text(record, "content", "messageText");
  if (
    /^https?:\/\//i.test(content) &&
    /\.(m4a|mp3|aac|ogg|webm|wav|mp4)([?#]|$)/i.test(content)
  ) {
    return content;
  }
  return "";
}

function senderIdOf(record: Obj): string {
  const direct = text(
    record,
    "senderId",
    "userId",
    "byUserId",
    "senderUserId",
    "authorId",
  );
  if (direct) return direct;
  return text(obj(record["sender"] ?? record["user"] ?? record["author"]), "id");
}

function durationMsOf(record: Obj): number {
  const nested = nestedMedia(record);
  const raw =
    number(record, "durationMs", "voiceDurationMs", "duration") ??
    number(nested, "durationMs", "duration");
  if (raw === null || raw <= 0) return 0;
  // Some endpoints send seconds instead of milliseconds.
  return raw < 1000 ? raw * 1000 : raw;
}

/** Backend offer → offer card (plus an optional voice-note bubble). */
function offerMessages(offer: Obj, currentUserId?: string): NegotiationMessage[] {
  const id = text(offer, "id");
  const price = number(offer, "price");
  if (!id || price === null) return [];
  const senderId = text(offer, "byUserId");
  const author = authorOf(senderId, currentUserId);
  const time = timeLabel(text(offer, "createdAt", "updatedAt"));
  const sortAt = sortAtOf(offer, "createdAt", "updatedAt");
  const state = text(offer, "status").toLowerCase();
  const note = text(offer, "messageText");
  const voiceUrl = voiceUrlOf(offer);
  const message: NegotiationMessage = {
    id,
    offerId: id,
    kind: "offer",
    author,
    price,
    note: note || undefined,
    time,
    byUserId: senderId || undefined,
    onBehalf: offer["onBehalf"] === true,
    ...(sortAt !== undefined ? { sortAt } : {}),
    status:
      state === "declined" || state === "accepted" || state === "withdrawn"
        ? state
        : undefined,
  };
  const result = [message];
  if (voiceUrl) {
    result.push({
      id: `${id}-voice`,
      kind: "voice",
      author,
      voice: { uri: voiceUrl, durationMs: durationMsOf(offer) },
      time,
      onBehalf: offer["onBehalf"] === true,
      ...(sortAt !== undefined ? { sortAt } : {}),
    });
  }
  return result;
}

/** Backend chat message / system event → conversation row. */
function chatMessage(
  raw: Obj,
  currentUserId?: string,
  fallbackPrice: number | null = null,
  fallbackBags: number | null = null,
): NegotiationMessage | null {
  const id = text(raw, "id");
  if (!id) return null;
  const type = text(raw, "type", "messageType", "kind").toLowerCase();
  if (type === "offer_card") return null; // offers are mapped separately
  const senderId = senderIdOf(raw);
  const content = text(raw, "content", "messageText");
  const time = timeLabel(text(raw, "createdAt", "updatedAt"));
  const sortAt = sortAtOf(raw, "createdAt", "updatedAt", "sentAt", "timestamp");
  const voiceUrl = voiceUrlOf(raw);
  const isVoice =
    type.includes("voice") ||
    type.includes("audio") ||
    Boolean(voiceUrl);
  if (isVoice) {
    return {
      id,
      kind: "voice",
      author: authorOf(senderId, currentUserId),
      voice: {
        uri: voiceUrl || content,
        durationMs: durationMsOf(raw),
      },
      time,
      onBehalf: raw["onBehalf"] === true,
      ...(sortAt !== undefined ? { sortAt } : {}),
    };
  }
  const systemTypes = new Set([
    "system",
    "event",
    "status",
    "trade_confirmed",
    "trade_completed",
    "offer_declined",
    "offer_retracted",
    "negotiation_withdrawn",
    "negotiation_expired",
    "partial_fill_proposed",
    "quantity_mismatch",
    "offer_price_lowered",
    "acted_on_your_behalf",
    "trade_cancelled",
  ]);
  if (systemTypes.has(type) || type.includes("system") || type.includes("event")) {
    const isTradeEvent = isTradeCompletionLabel(type) || isTradeCompletionLabel(content);
    return {
      id,
      kind: "system",
      author: "system",
      text: displayedSystemText(
        type,
        content,
        isTradeEvent ? tradeSummaryOf(raw, fallbackPrice, fallbackBags) : "",
      ),
      time: "",
      ...(sortAt !== undefined ? { sortAt } : {}),
    };
  }
  return {
    id,
    kind: "text",
    author: authorOf(senderId, currentUserId),
    text: content,
    time,
    onBehalf: raw["onBehalf"] === true,
    ...(sortAt !== undefined ? { sortAt } : {}),
  };
}

function counterSide(raw: unknown): { used: number; left: number } {
  const side = obj(raw);
  return {
    used: number(side, "used") ?? 0,
    left: number(side, "left") ?? 0,
  };
}

function threadStatus(
  raw: Obj,
  hasTrade: boolean,
  hasCompletionEvidence = false,
): NegotiationStatus {
  const state = text(raw, "status").toLowerCase();
  const reason = text(raw, "closeReason").toUpperCase();
  const uiStatus = text(raw, "uiStatus").toUpperCase();
  const completedStatus = (): NegotiationStatus =>
    raw["brokerPending"] === true || raw["buyerCanChooseBroker"] === true
      ? "confirmed"
      : "completed";

  if (reason === "WITHDRAWN" || state === "withdrawn") return "withdrawn";
  // An accepted offer is a completed trade, even if the backend closes the
  // negotiation with a generic ACCEPTED/CANCELLED status afterwards.
  const explicitCompletion =
    reason === "TRADE_COMPLETED" ||
    reason === "TRADE_CONFIRMED" ||
    state === "accepted" ||
    state === "trade_confirmed" ||
    /completed|confirmed/i.test(uiStatus);
  if (explicitCompletion) return completedStatus();
  if (
    reason === "QUANTITY_MISMATCH" ||
    state === "cancelled" ||
    uiStatus === "CANCELLED"
  ) {
    return "cancelled";
  }
  // A list row can omit `trade` and `closeReason` but still include a trade
  // event or `tradeId`; that is enough to file it under Completed Trades.
  if (hasCompletionEvidence || hasTrade) return completedStatus();
  if (state === "open") {
    if (uiStatus === "RESPOND") return "your_turn";
    if (uiStatus === "WAITING") return "waiting";
    return raw["isMyTurn"] === true ? "your_turn" : "waiting";
  }
  if (state === "expired") return "declined";
  return "declined";
}

/** Map the backend thread (or a Trades-tab row) onto the app's thread shape. */
export function normalizeThread(
  raw: unknown,
  currentUserId?: string,
  defaultRole: NegotiationRole = "buyer",
): NegotiationThread | null {
  const record = payload(raw);
  const id = text(record, "id");
  if (!id) return null;

  const listing = obj(record["listing"]);
  const otherParty = obj(record["otherParty"]);
  const buyer = obj(record["buyer"]);
  const seller = obj(record["seller"]);
  const counterParty = obj(record["counterparty"]);
  const listingSeller = obj(listing["seller"]);
  const listingUser = obj(listing["user"]);
  const requirement = obj(record["requirement"]);
  const requirementBuyer = obj(requirement["user"]);
  const roleValue = text(record, "myRole").toLowerCase();
  const role: NegotiationRole =
    roleValue === "seller" || roleValue === "buyer" ? roleValue : defaultRole;
  const trade = obj(record["trade"]);
  // List rows may carry only `tradeId` instead of the full `trade` object.
  const hasTrade = Boolean(text(trade, "id") || text(record, "tradeId"));

  const rawOffers = array(record, "offers");
  const latest = obj(record["latestOffer"]);
  const offerRecords = rawOffers.length > 0 ? rawOffers : text(latest, "id") ? [latest] : [];
  const pendingOffer = pendingOfferOf(offerRecords, currentUserId);
  const acceptedState = /^(accepted|confirmed|completed)$/i;
  const acceptedOffer =
    rawOffers.find((offer) => acceptedState.test(text(offer, "status"))) ??
    (acceptedState.test(text(latest, "status")) ? latest : undefined);

  const rawMessages = array(record, "messages");
  const completionEvents = rawMessages.filter(
    (message) =>
      isTradeCompletionLabel(text(message, "type", "messageType", "kind")) ||
      isTradeCompletionLabel(text(message, "content", "messageText")),
  );
  const eventValues = completionEvents.map((message) => {
    const own = completionValues(message);
    const parsed = completionValuesFromText(text(message, "content", "messageText"));
    return { price: own.price ?? parsed.price, bags: own.bags ?? parsed.bags };
  });
  const eventPrice = eventValues.map((value) => value.price).find((price) => price !== null) ?? null;
  const eventBags = eventValues.map((value) => value.bags).find((bags) => bags !== null) ?? null;

  const offers = rawOffers.flatMap((offer) => offerMessages(offer, currentUserId));
  if (offers.length === 0 && text(latest, "id")) {
    offers.push(...offerMessages(latest, currentUserId));
  }

  const fallbackRequestedBags =
    number(record, "bagsRequested") ??
    number(latest, "bagsRequested") ??
    number(obj(rawOffers[rawOffers.length - 1]), "bagsRequested", "bags") ??
    number(obj(rawOffers[0]), "bagsRequested", "bags") ??
    0;
  const requestedBags =
    pendingOffer && pendingOffer.bags > 0 ? pendingOffer.bags : fallbackRequestedBags;
  const closeReasonCode = text(record, "closeReason").toUpperCase();
  const hasCompletionEvidence =
    hasTrade ||
    completionEvents.length > 0 ||
    text(record, "status").toLowerCase() === "accepted" ||
    closeReasonCode === "TRADE_COMPLETED" ||
    closeReasonCode === "TRADE_CONFIRMED" ||
    /completed|confirmed/i.test(text(record, "uiStatus"));
  const tradePrice =
    number(trade, "finalPrice", "price", "tradePrice", "agreedPrice") ??
    number(obj(acceptedOffer), "finalPrice", "price", "agreedPrice") ??
    number(record, "agreedPrice", "tradePrice", "finalPrice") ??
    eventPrice ??
    (hasCompletionEvidence ? number(listing, "price", "targetPrice") : null);
  const tradeBags =
    number(trade, "quantityBags", "bags", "bagsRequested", "quantity") ??
    number(obj(acceptedOffer), "bagsRequested", "bags", "quantityBags") ??
    number(record, "quantityBags", "bags", "bagsRequested") ??
    eventBags ??
    (hasCompletionEvidence ? requestedBags : 0);

  // Pass the same fallback numbers to every system event so the completion
  // notice always shows `Trade completed · ₹… × … bags`, even when the event
  // payload itself has no price/quantity fields.
  const chat = rawMessages
    .map((message) => chatMessage(message, currentUserId, tradePrice, tradeBags))
    .filter((message): message is NegotiationMessage => message !== null);

  const closeReason = text(record, "closeReason") || undefined;
  const messages = [...offers, ...chat];
  const closeSortAt = sortAtOf(record, "closedAt", "updatedAt", "createdAt");
  if (closeReason === "WITHDRAWN") {
    messages.push(systemMessage("You withdrew this negotiation", closeSortAt));
  } else if (closeReason === "QUANTITY_MISMATCH") {
    messages.push(systemMessage("Cancelled — quantity mismatch", closeSortAt));
  }

  const firstOffer = offers.find((message) => message.kind === "offer");
  const listedPrice =
    number(record, "listedPrice", "targetPrice") ??
    number(listing, "price", "targetPrice") ??
    firstOffer?.price ??
    0;
  const availableBags =
    number(record, "availableBags") ??
    number(listing, "availabilityBags") ??
    number(listing, "quantityBags") ??
    0;
  const counterObj = obj(record["counters"]);
  const counters = text(counterObj, "max")
    ? {
        max: number(counterObj, "max") ?? 2,
        buyer: counterSide(counterObj["buyer"]),
        seller: counterSide(counterObj["seller"]),
      }
    : undefined;
  const counterUsed = counters?.[role].used ?? 0;
  const confirmedAt = text(trade, "confirmedAt", "createdAt");
  const fallbackSummary = hasCompletionEvidence
    ? formatTradeSummary(tradePrice, tradeBags)
    : "";
  const brokerPending =
    trade["brokerPending"] === true || trade["buyerCanChooseBroker"] === true;
  // §22D sends both `isMyTurn` and `turnUserId`; a list row may only send the
  // latter. Honour either so the chat never shows actions for the wrong side.
  const isMyTurn =
    typeof record["isMyTurn"] === "boolean"
      ? record["isMyTurn"]
      : Boolean(currentUserId && text(record, "turnUserId") === currentUserId);
  const backendStatus = threadStatus(
    { ...record, brokerPending, isMyTurn },
    hasTrade,
    hasCompletionEvidence,
  );
  const hasCompletionNotice = messages.some(
    (message) =>
      message.kind === "system" &&
      /trade[\s_-]*(completed|confirmed)/i.test(message.text ?? ""),
  );
  // A backend `closed`/`declined` state after acceptance is still a completed
  // trade when the thread carries a TRADE_CONFIRMED event.
  const status =
    backendStatus === "declined" &&
    hasCompletionNotice &&
    closeReason !== "WITHDRAWN" &&
    closeReason !== "QUANTITY_MISMATCH"
      ? "completed"
      : backendStatus;
  // Prototype completion notice in the thread, above the compact success box.
  if (
    (status === "completed" || status === "confirmed") &&
    fallbackSummary &&
    !hasCompletionNotice
  ) {
    messages.push(
      systemMessage(
        `Trade completed${fallbackSummary}`,
        sortAtOf(record, "closedAt", "updatedAt", "confirmedAt"),
      ),
    );
  }

  // Backend events often arrive as raw labels (`OFFER_DECLINED`,
  // `TRADE_CONFIRMED`). Show the prototype wording with trade details.
  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    if (message.kind !== "system") continue;
    const value = message.text ?? "";
    if (isOfferDeclinedLabel(value)) {
      messages[i] = { ...message, text: "You declined this offer" };
    } else if (isTradeCompletionLabel(value) && !value.includes("·")) {
      messages[i] = { ...message, text: `Trade completed${fallbackSummary}` };
    }
  }

  const orderedMessages = chronological(messages);

  const quality =
    text(record, "quality", "sellerQuality", "qualityName", "grade") ||
    text(listing, "quality", "sellerQuality", "qualityName", "grade") ||
    text(requirement, "quality", "qualityName", "grade");

  // The backend may include both buyer and seller. Pick the side opposite the
  // signed-in role so a buyer sees the seller (not their own buyer name).
  const namedCounterparty =
    role === "buyer"
      ? partyName(seller, listingSeller, listingUser, otherParty, counterParty)
      : partyName(buyer, requirementBuyer, otherParty, counterParty);
  const counterparty =
    namedCounterparty ||
    text(
      record,
      role === "buyer" ? "sellerName" : "buyerName",
      "counterparty",
      "otherPartyName",
    ) ||
    (role === "buyer" ? "Seller" : "Buyer");

  return {
    id,
    role,
    listingId: text(listing, "id") || text(record, "listingId") || undefined,
    tradeId: text(trade, "id") || text(record, "tradeId") || undefined,
    counterparty,
    item:
      text(record, "item", "itemName") ||
      text(listing, "itemName", "item", "name") ||
      "Negotiation",
    category:
      text(obj(listing["category"]), "name") ||
      text(record, "category", "categoryName") ||
      "Uncategorized",
    ...(quality ? { quality } : {}),
    listedPrice,
    availableBags,
    requestedBags,
    weightKg: number(listing, "weightKg") ?? undefined,
    paymentTerms:
      text(listing, "paymentTerms") || String(number(listing, "paymentTerms") ?? ""),
    status,
    messages: orderedMessages,
    counterCount: counterUsed,
    updatedAt: confirmedAt ? formatDateLabel(confirmedAt) : "Just now",
    confirmedAt: confirmedAt || undefined,
    agreedPrice: tradePrice ?? undefined,
    trade:
      (hasTrade || hasCompletionNotice || status === "completed" || status === "confirmed") &&
      tradePrice !== null
        ? {
            price: tradePrice,
            bags: tradeBags || requestedBags,
            broker:
              trade["isSelf"] === true
                ? "Self"
                : text(obj(trade["broker"]), "name") || "Broker",
            date: confirmedAt ? formatTradeDateLabel(confirmedAt) : "",
          }
        : undefined,
    counters,
    expiresAt: text(record, "expiresAt") || null,
    closeReason: closeReason ?? null,
    uiStatus: text(record, "uiStatus") as NegotiationThread["uiStatus"],
    reasonLabel: text(record, "reasonLabel") || undefined,
    brokerPending,
    buyerCanChooseBroker: trade["buyerCanChooseBroker"] === true,
    turnUserId: text(record, "turnUserId") || undefined,
    isMyTurn,
    pendingOffer,
  };
}

export interface StartNegotiationInput {
  listingId: string;
  price: number;
  bagsRequested: number;
  messageText?: string;
  voiceNoteUrl?: string;
}

export interface CounterInput {
  price: number;
  messageText?: string;
  voiceNoteUrl?: string;
}

export interface ChatMessageInput {
  type: "text" | "voice_note";
  content: string;
  /** Some backend versions read the URL from this field instead of `content`. */
  voiceNoteUrl?: string;
  durationMs?: number;
}

export interface AcceptResult {
  status: string;
  thread: NegotiationThread;
  tradeId?: string;
  tradePrice?: number;
  tradeBags?: number;
}

function withTrade(threadRaw: unknown, trade: unknown): unknown {
  if (!isObj(trade) || !text(trade, "id")) return threadRaw;
  if (isObj(threadRaw)) return { ...threadRaw, trade };
  return { trade };
}

function toAcceptResult(raw: unknown, tokenUserId?: string): AcceptResult {
  const envelope = dataEnvelope(raw);
  const status = text(envelope, "status") || "ok";
  const trade = obj(envelope["trade"]);
  let threadRaw = obj(envelope["negotiation"]);
  if (status === "partial_fill_proposed") {
    // §22D returns the system offer next to the thread. Feed it through the
    // normal offer mapper so `pendingOffer` and the chat card stay in sync.
    const systemOffer = obj(envelope["offer"]);
    const systemOfferId = text(systemOffer, "id");
    if (systemOfferId) {
      const offers = array(threadRaw, "offers");
      if (!offers.some((offer) => text(offer, "id") === systemOfferId)) {
        threadRaw = { ...threadRaw, offers: [...offers, systemOffer] };
      }
    }
  }
  const thread =
    normalizeThread(withTrade(threadRaw, trade), tokenUserId) ??
    normalizeThread(withTrade(raw, trade), tokenUserId);
  if (!thread) {
    throw new ApiError(502, "The server returned an unsupported negotiation format.");
  }
  return {
    status,
    thread,
    tradeId: text(trade, "id") || undefined,
    tradePrice: number(trade, "finalPrice") ?? undefined,
    tradeBags: number(trade, "quantityBags") ?? undefined,
  };
}

function threadFrom(
  raw: unknown,
  currentUserId?: string,
  defaultRole: NegotiationRole = "buyer",
): NegotiationThread {
  const thread = normalizeThread(raw, currentUserId, defaultRole);
  if (!thread) {
    throw new ApiError(502, "The server returned an unsupported negotiation format.");
  }
  return thread;
}

export const negotiationApi = {
  /** POST /negotiations — buyer on SELL, seller on BUY. */
  async start(
    input: StartNegotiationInput,
    token: string,
    currentUserId?: string,
    defaultRole: NegotiationRole = "buyer",
  ): Promise<NegotiationThread> {
    const body: Obj = {
      listingId: input.listingId,
      price: input.price,
      bagsRequested: input.bagsRequested,
    };
    if (input.messageText) body["messageText"] = input.messageText;
    if (input.voiceNoteUrl) body["voiceNoteUrl"] = input.voiceNoteUrl;
    const raw = await apiFetch<unknown>(apiUrl(NEGOTIATION_ENDPOINTS.start), {
      method: "POST",
      token,
      body,
    });
    return threadFrom(raw, currentUserId, defaultRole);
  },

  /** POST /negotiations/buy-now — buyer only, direct trade at listed price. */
  async buyNow(
    listingId: string,
    bagsRequested: number,
    token: string,
    currentUserId?: string,
    acceptPartial = false,
  ): Promise<AcceptResult> {
    const raw = await apiFetch<unknown>(apiUrl(NEGOTIATION_ENDPOINTS.buyNow), {
      method: "POST",
      token,
      body: { listingId, bagsRequested, ...(acceptPartial ? { acceptPartial } : {}) },
    });
    return toAcceptResult(raw, currentUserId);
  },

  /** GET /negotiations/:id — full thread with offers and messages. */
  async getById(
    id: string,
    token: string,
    currentUserId?: string,
    defaultRole: NegotiationRole = "buyer",
  ): Promise<NegotiationThread> {
    const raw = await apiFetch<unknown>(apiUrl(NEGOTIATION_ENDPOINTS.byId(id)), {
      token,
    });
    return normalizeThread(raw, currentUserId, defaultRole) ?? threadFrom(raw, currentUserId);
  },

  /** GET /negotiations?tab=active|completed — the Trades tab lists. */
  async list(
    tab: "active" | "completed",
    token: string,
    currentUserId?: string,
    defaultRole: NegotiationRole = "buyer",
  ): Promise<NegotiationThread[]> {
    const raw = await apiFetch<unknown>(
      apiUrl(NEGOTIATION_ENDPOINTS.list({ tab, limit: 100 })),
      { token },
    );
    const inner = dataEnvelope(raw);
    const rows = Array.isArray(inner["data"])
      ? inner["data"].filter(isObj)
      : Array.isArray(inner["rows"])
        ? inner["rows"].filter(isObj)
        : array(inner, "items", "results", "negotiations");
    return rows
      .map((row) => normalizeThread(row, currentUserId, defaultRole))
      .filter((thread): thread is NegotiationThread => thread !== null);
  },

  /** POST /negotiations/:id/counter — only the party whose turn it is. */
  async counter(
    id: string,
    input: CounterInput,
    token: string,
    currentUserId?: string,
  ): Promise<NegotiationThread> {
    const raw = await apiFetch<unknown>(
      apiUrl(NEGOTIATION_ENDPOINTS.counter(id)),
      {
        method: "POST",
        token,
        body: { ...input },
      },
    );
    return threadFrom(raw, currentUserId);
  },

  /** POST /negotiations/offers/:offerId/accept — creates a trade. */
  async accept(
    offerId: string,
    token: string,
    currentUserId?: string,
    acceptPartial = false,
  ): Promise<AcceptResult> {
    const raw = await apiFetch<unknown>(apiUrl(NEGOTIATION_ENDPOINTS.accept(offerId)), {
      method: "POST",
      token,
      body: { acceptPartial },
    });
    return toAcceptResult(raw, currentUserId);
  },

  /** POST /negotiations/offers/:offerId/decline — no counter spent. */
  async decline(
    offerId: string,
    token: string,
    currentUserId?: string,
  ): Promise<NegotiationThread> {
    const raw = await apiFetch<unknown>(
      apiUrl(NEGOTIATION_ENDPOINTS.decline(offerId)),
      { method: "POST", token },
    );
    return threadFrom(raw, currentUserId);
  },

  /** POST /negotiations/:id/withdraw — ends the whole thread. */
  async withdraw(
    id: string,
    token: string,
    currentUserId?: string,
  ): Promise<NegotiationThread> {
    const raw = await apiFetch<unknown>(apiUrl(NEGOTIATION_ENDPOINTS.withdraw(id)), {
      method: "POST",
      token,
    });
    return threadFrom(raw, currentUserId);
  },

  /** POST /negotiations/:id/messages — text or uploaded voice note URL. */
  async sendMessage(
    id: string,
    input: ChatMessageInput,
    token: string,
    currentUserId?: string,
  ): Promise<NegotiationThread> {
    const raw = await apiFetch<unknown>(apiUrl(NEGOTIATION_ENDPOINTS.messages(id)), {
      method: "POST",
      token,
      body: { ...input },
    });
    return threadFrom(raw, currentUserId);
  },

  /* Admin on-behalf twins — same party rules, actor is the admin. */

  async onBehalfStart(
    input: StartNegotiationInput & { onBehalfOfUserId: string },
    token: string,
  ): Promise<NegotiationThread> {
    const { onBehalfOfUserId, ...rest } = input;
    const raw = await apiFetch<unknown>(
      apiUrl(NEGOTIATION_ENDPOINTS.onBehalf.start),
      { method: "POST", token, body: { ...rest, onBehalfOfUserId } },
    );
    return threadFrom(raw, onBehalfOfUserId);
  },

  async onBehalfCounter(
    id: string,
    input: CounterInput & { onBehalfOfUserId: string },
    token: string,
  ): Promise<NegotiationThread> {
    const raw = await apiFetch<unknown>(
      apiUrl(NEGOTIATION_ENDPOINTS.onBehalf.counter(id)),
      { method: "POST", token, body: { ...input } },
    );
    return threadFrom(raw, input.onBehalfOfUserId);
  },

  async onBehalfAccept(
    offerId: string,
    onBehalfOfUserId: string,
    token: string,
  ): Promise<AcceptResult> {
    const raw = await apiFetch<unknown>(
      apiUrl(NEGOTIATION_ENDPOINTS.onBehalf.accept(offerId)),
      { method: "POST", token, body: { onBehalfOfUserId } },
    );
    return toAcceptResult(raw, onBehalfOfUserId);
  },

  async onBehalfDecline(
    offerId: string,
    onBehalfOfUserId: string,
    token: string,
  ): Promise<NegotiationThread> {
    const raw = await apiFetch<unknown>(
      apiUrl(NEGOTIATION_ENDPOINTS.onBehalf.decline(offerId)),
      { method: "POST", token, body: { onBehalfOfUserId } },
    );
    return threadFrom(raw, onBehalfOfUserId);
  },

  async onBehalfWithdraw(
    id: string,
    onBehalfOfUserId: string,
    token: string,
  ): Promise<NegotiationThread> {
    const raw = await apiFetch<unknown>(
      apiUrl(NEGOTIATION_ENDPOINTS.onBehalf.withdraw(id)),
      { method: "POST", token, body: { onBehalfOfUserId } },
    );
    return threadFrom(raw, onBehalfOfUserId);
  },

  async onBehalfMessage(
    id: string,
    input: ChatMessageInput & { onBehalfOfUserId: string },
    token: string,
  ): Promise<NegotiationThread> {
    const raw = await apiFetch<unknown>(
      apiUrl(NEGOTIATION_ENDPOINTS.onBehalf.messages(id)),
      { method: "POST", token, body: { ...input } },
    );
    return threadFrom(raw, input.onBehalfOfUserId);
  },
};
