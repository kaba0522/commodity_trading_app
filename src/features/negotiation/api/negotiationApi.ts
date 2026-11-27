import { ApiError, apiFetch } from "@/core/api/client";
import { NEGOTIATION_ENDPOINTS, apiUrl } from "@/core/api/endpoints";
import { formatDateLabel } from "@/core/utils/format";
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

function systemMessage(content: string): NegotiationMessage {
  return {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: "system",
    author: "system",
    text: content,
    time: "",
  };
}

function authorOf(senderId: string, currentUserId?: string): "you" | "them" {
  return currentUserId && senderId ? (senderId === currentUserId ? "you" : "them") : "them";
}

/** Backend offer → offer card (plus an optional voice-note bubble). */
function offerMessages(offer: Obj, currentUserId?: string): NegotiationMessage[] {
  const id = text(offer, "id");
  const price = number(offer, "price");
  if (!id || price === null) return [];
  const senderId = text(offer, "byUserId");
  const author = authorOf(senderId, currentUserId);
  const time = timeLabel(text(offer, "createdAt", "updatedAt"));
  const state = text(offer, "status").toLowerCase();
  const note = text(offer, "messageText");
  const voiceUrl = text(offer, "voiceNoteUrl");
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
      voice: { uri: voiceUrl, durationMs: 0 },
      time,
      onBehalf: offer["onBehalf"] === true,
    });
  }
  return result;
}

/** Backend chat message / system event → conversation row. */
function chatMessage(raw: Obj, currentUserId?: string): NegotiationMessage | null {
  const id = text(raw, "id");
  if (!id) return null;
  const type = text(raw, "type").toLowerCase();
  if (type === "offer_card") return null; // offers are mapped separately
  const senderId = text(raw, "senderId");
  const content = text(raw, "content", "messageText");
  const time = timeLabel(text(raw, "createdAt", "updatedAt"));
  if (type.includes("voice") || type === "audio") {
    return {
      id,
      kind: "voice",
      author: authorOf(senderId, currentUserId),
      voice: {
        uri: content || text(raw, "voiceNoteUrl", "url", "fileUrl"),
        durationMs: number(raw, "durationMs") ?? 0,
      },
      time,
      onBehalf: raw["onBehalf"] === true,
    };
  }
  if (type === "system" || type === "event" || type === "status") {
    return {
      id,
      kind: "system",
      author: "system",
      text: content || type.replace(/_/g, " ").toLowerCase(),
      time: "",
    };
  }
  return {
    id,
    kind: "text",
    author: authorOf(senderId, currentUserId),
    text: content,
    time,
    onBehalf: raw["onBehalf"] === true,
  };
}

function counterSide(raw: unknown): { used: number; left: number } {
  const side = obj(raw);
  return {
    used: number(side, "used") ?? 0,
    left: number(side, "left") ?? 0,
  };
}

function threadStatus(raw: Obj, hasTrade: boolean): NegotiationStatus {
  const state = text(raw, "status").toLowerCase();
  const reason = text(raw, "closeReason").toUpperCase();
  const uiStatus = text(raw, "uiStatus").toUpperCase();

  if (reason === "WITHDRAWN" || state === "withdrawn") return "withdrawn";
  if (
    reason === "QUANTITY_MISMATCH" ||
    state === "cancelled" ||
    uiStatus === "CANCELLED"
  ) {
    return "cancelled";
  }
  if (hasTrade) {
    return raw["brokerPending"] === true ||
      raw["buyerCanChooseBroker"] === true
      ? "confirmed"
      : "completed";
  }
  if (state === "trade_confirmed") return "completed";
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
  const roleValue = text(record, "myRole").toLowerCase();
  const role: NegotiationRole =
    roleValue === "seller" || roleValue === "buyer" ? roleValue : defaultRole;
  const trade = obj(record["trade"]);
  const hasTrade = Boolean(text(trade, "id"));

  const rawOffers = array(record, "offers");
  const offers = rawOffers.flatMap((offer) => offerMessages(offer, currentUserId));
  const latest = obj(record["latestOffer"]);
  if (offers.length === 0 && text(latest, "id")) {
    offers.push(...offerMessages(latest, currentUserId));
  }
  const chat = array(record, "messages")
    .map((message) => chatMessage(message, currentUserId))
    .filter((message): message is NegotiationMessage => message !== null);

  const closeReason = text(record, "closeReason") || undefined;
  const messages = [...offers, ...chat];
  if (closeReason === "WITHDRAWN") {
    messages.push(systemMessage("You withdrew this negotiation"));
  } else if (closeReason === "QUANTITY_MISMATCH") {
    messages.push(systemMessage("Cancelled — quantity mismatch"));
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
  const requestedBags =
    number(record, "bagsRequested") ??
    number(latest, "bagsRequested") ??
    number(rawOffers[rawOffers.length - 1], "bagsRequested", "bags") ??
    number(rawOffers[0], "bagsRequested", "bags") ??
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
  const tradePrice = number(trade, "finalPrice");
  const tradeBags = number(trade, "quantityBags");
  const brokerPending =
    trade["brokerPending"] === true || trade["buyerCanChooseBroker"] === true;

  return {
    id,
    role,
    listingId: text(listing, "id") || text(record, "listingId") || undefined,
    tradeId: text(trade, "id") || text(record, "tradeId") || undefined,
    counterparty:
      partyName(otherParty, buyer, seller, counterParty) ||
      text(record, "counterparty", "otherPartyName") ||
      (role === "buyer" ? "Seller" : "Buyer"),
    item:
      text(record, "item", "itemName") ||
      text(listing, "itemName", "item", "name") ||
      "Negotiation",
    category:
      text(obj(listing["category"]), "name") ||
      text(record, "category", "categoryName") ||
      "Uncategorized",
    listedPrice,
    availableBags,
    requestedBags,
    weightKg: number(listing, "weightKg") ?? undefined,
    paymentTerms:
      text(listing, "paymentTerms") || String(number(listing, "paymentTerms") ?? ""),
    status: threadStatus({ ...record, brokerPending }, hasTrade),
    messages,
    counterCount: counterUsed,
    updatedAt: confirmedAt ? formatDateLabel(confirmedAt) : "Just now",
    agreedPrice: tradePrice ?? undefined,
    trade:
      hasTrade && tradePrice !== null
        ? {
            price: tradePrice,
            bags: tradeBags ?? requestedBags,
            broker:
              trade["isSelf"] === true
                ? "Self"
                : text(obj(trade["broker"]), "name") || "Broker",
            date: confirmedAt ? formatDateLabel(confirmedAt) : "",
          }
        : undefined,
    counters,
    expiresAt: text(record, "expiresAt") || null,
    closeReason: closeReason ?? null,
    uiStatus: text(record, "uiStatus") as NegotiationThread["uiStatus"],
    reasonLabel: text(record, "reasonLabel") || undefined,
    brokerPending,
    buyerCanChooseBroker: trade["buyerCanChooseBroker"] === true,
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
  const threadRaw = obj(envelope["negotiation"]);
  const thread =
    normalizeThread(withTrade(threadRaw, trade), tokenUserId) ??
    normalizeThread(withTrade(raw, trade), tokenUserId);
  if (!thread) {
    throw new ApiError(502, "The server returned an unsupported negotiation format.");
  }
  if (status === "partial_fill_proposed") {
    const systemOffer = obj(envelope["offer"]);
    const extra = offerMessages(systemOffer, tokenUserId);
    extra.forEach((message) => {
      if (!thread.messages.some((current) => current.id === message.id)) {
        thread.messages.push(message);
      }
    });
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
