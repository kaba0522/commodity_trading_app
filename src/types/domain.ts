/** Domain types ported from the Buyer/Seller HTML prototypes. */

export type Role = "buyer" | "seller" | "broker";

export type Category =
  | "Besan"
  | "Dal"
  | "Matar"
  | "Chana"
  | "Rajma"
  | "Rice"
  | "Uncategorized";

/**
 * Backend listing lifecycle. Service filter values (`listing.service
 * VALID_STATUSES`): active, price_expired, na, withdrawn, traded; the Prisma
 * schema additionally defines `sold_out` (never set by the service today,
 * accepted here so such rows degrade to the Expired tab instead of vanishing).
 */
export type ListingStatus =
  | "active"
  | "price_expired"
  | "na"
  | "withdrawn"
  | "traded"
  | "sold_out";

/** Market listing (buyer browse/home). Price is per-bag rupees. */
export interface Listing {
  id: number | string;
  categoryId?: string;
  commodityId?: string;
  category: Category;
  item: string;
  quality?: string;
  sellerQuality?: string;
  qualityId?: string | null;
  weight: string;
  weightKg?: number | null;
  seller: string;
  price: number;
  /** Backend `quantityBags` — how many bags the seller listed in total. */
  bags?: number;
  /** Backend `availabilityBags` — bags still buyable after earlier trades. */
  availableBags?: number;
  moisture?: string;
  color?: string;
  size?: string;
  notes?: string;
  /** Per-listing payment terms in days; copied from the seller's profile on create. */
  paymentTerms?: number | null;
  /** Backend-configured expiry for the current price, serialized as an ISO date. */
  priceValidUntil?: string | null;
  /** Backend `status`; undefined when the payload omits it (price fallback applies). */
  status?: ListingStatus;
  /** Owner/seller user id when the payload carries it — used to scope the seller dashboard to own listings. */
  sellerId?: string;
  /** Cloudinary secure URLs for listing photos (max 5). Filled by /media/sign upload flow. */
  photoUrls?: string[];
  /** Cloudinary secure URL for listing sample video (max 1). Filled by /media/sign upload flow. */
  videoUrls?: string[];
}

/** Seller's own listing (dashboard). `price: null` = awaiting today's price. */
export interface SellerListing {
  id: number;
  category: Category;
  item: string;
  weight: string;
  price: number | null;
  featured: boolean;
}

/** Buyer's own posted requirement (buyer home). */
export interface Requirement {
  id: number;
  category: Category;
  item: string;
  weight: string;
  targetPrice: number;
  bags: number;
  status: "Open" | "Closed";
}

/** Buyer requirement as seen by sellers (seller requirements slice). */
export interface BuyerRequirement {
  /** Backend UUID (string) or legacy numeric id — never coerce to number. */
  id: string | number;
  categoryId?: string;
  commodityId?: string;
  category: Category;
  item: string;
  buyer: string;
  paymentTerms: string;
  targetPrice: number;
  bags: number;
  quality?: string;
  sellerQuality?: string;
  weightKg?: number;
  location?: string;
  notes?: string;
  status?: ListingStatus;
  createdAt?: string;
}

/** Completed/past trade. */
export interface Order {
  id: string;
  item: string;
  seller: string;
  bags: number;
  price: number;
  date: string;
  status: string;
}

/** Backend trade record (§22C) — richer than the legacy `Order` card shape. */
export interface TradeRecord {
  id: string;
  negotiationId?: string;
  listingId?: string;
  buyerId?: string;
  sellerId?: string;
  buyer: string;
  seller: string;
  item: string;
  category?: string;
  price: number;
  bags: number;
  status: string;
  brokerId?: string;
  brokerName?: string;
  brokerPending: boolean;
  buyerCanChooseBroker: boolean;
  confirmedAt?: string;
  createdAt?: string;
  /** Backend commission, when the broker is involved. */
  commission?: number;
  commissionRate?: number;
}

export interface Offer {
  by: "you" | "them";
  price: number;
  opening?: boolean;
}

/** Active negotiation thread (buyer + seller views). */
export interface Negotiation {
  id: number;
  item: string;
  /** Buyer side links to a listing; seller side links to a requirement. */
  listingId?: number;
  reqId?: number;
  seller?: string;
  buyer?: string;
  statusLabel: string;
  offers: Offer[];
}

/** Lifecycle of an offer thread (ported from both negotiation prototypes). */
export type NegotiationStatus =
  | "your_turn"
  | "waiting"
  | "withdrawn"
  | "declined"
  | "cancelled"
  | "confirmed"
  | "completed";

/** Recorded voice note attached to an offer or sent as a chat message. */
export interface VoiceNote {
  /** Local file URI returned by `expo-audio` after recording. */
  uri: string;
  durationMs: number;
}

/** One row in the negotiation conversation (offer card, chat bubble, system note). */
export interface NegotiationMessage {
  id: string;
  kind: "system" | "offer" | "text" | "voice";
  /** `you` = the signed-in role, `them` = the counterparty. */
  author: "you" | "them" | "system";
  price?: number;
  /** Copy for system notices and plain chat bubbles. */
  text?: string;
  /** Optional note attached to an offer card. */
  note?: string;
  /** Playable recording for `kind: "voice"`. Legacy mocks may omit it. */
  voice?: VoiceNote;
  time: string;
  status?: "declined" | "withdrawn" | "accepted";
  /** Backend offer id — required by POST /negotiations/offers/:id/accept|decline. */
  offerId?: string;
  /** Backend sender id, used to normalise author. */
  byUserId?: string;
  /** Admin acted on behalf of this party. */
  onBehalf?: boolean;
  /** Backend timestamp used only to interleave offers and chat chronologically. */
  sortAt?: number;
}

/** Captured when both sides agree and the broker has been chosen. */
export interface TradeDetails {
  price: number;
  bags: number;
  broker: string;
  date: string;
}

/**
 * Role-aware negotiation thread. Buyer threads point at a listing/seller,
 * seller threads point at a requirement/buyer — the same state machine drives
 * both, only the labels and counterparty change.
 */
export interface NegotiationThread {
  id: string;
  role: "buyer" | "seller";
  /** Seller name (buyer view) or buyer name (seller view). */
  counterparty: string;
  /** "Rajma · Disco · Bold" style display label. */
  item: string;
  category: string;
  /** Quality/grade for the listing or requirement, when the backend sends it. */
  quality?: string;
  /** Listing price (buyer) or buyer's target price (seller). */
  listedPrice: number;
  availableBags: number;
  requestedBags: number;
  weightKg?: number;
  paymentTerms?: string;
  status: NegotiationStatus;
  messages: NegotiationMessage[];
  /** Agreed price waiting for broker selection on the trade-confirm screen. */
  agreedPrice?: number;
  /** Number of counter offers already sent — server limit defaults to two. */
  counterCount: number;
  /** Short relative label used on the trades list ("2m ago"). */
  updatedAt: string;
  /** Raw trade confirmation timestamp for the completed-trade summary. */
  confirmedAt?: string;
  trade?: TradeDetails;

  /* ---- Backend negotiation fields (§22D) ---- */
  /** Listing/requirement UUID the negotiation is about. */
  listingId?: string;
  /** Trade UUID once an offer has been accepted. */
  tradeId?: string;
  /** Backend turn/counter counters — overrides the local MAX_COUNTER_OFFERS. */
  counters?: {
    max: number;
    buyer: { used: number; left: number };
    seller: { used: number; left: number };
  };
  /** When the pending offer expires (server setting offer_expiry_time). */
  expiresAt?: string | null;
  closeReason?: string | null;
  /** Backend Trades-tab status, e.g. RESPOND or CANCELLED. */
  uiStatus?: "RESPOND" | "WAITING" | "COMPLETED" | "CANCELLED";
  /** Human label for backend cancellations ("Withdrawn", "Quantity mismatch"). */
  reasonLabel?: string;
  /** Buyer still has to pick a broker on the resulting trade. */
  brokerPending?: boolean;
  buyerCanChooseBroker?: boolean;

  /* ---- §22D turn / pending-offer workflow ---- */
  /** Backend `turnUserId` — used when `isMyTurn` is not sent. */
  turnUserId?: string;
  /** True when this user must accept, decline or counter next. */
  isMyTurn?: boolean;
  /** Latest pending offer from the backend `offers[]` array. */
  pendingOffer?: {
    id: string;
    author: "you" | "them";
    price: number;
    bags: number;
    isSystem: boolean;
  };
}
