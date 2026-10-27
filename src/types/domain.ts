/** Domain types ported from the Buyer/Seller HTML prototypes. */

export type Role = "buyer" | "seller";

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
  category: Category;
  item: string;
  quality: string;
  weight: string;
  seller: string;
  price: number;
  /** Backend `quantityBags` — how many bags the seller has on offer. */
  bags?: number;
  /** Per-listing payment terms in days; copied from the seller's profile on create. */
  paymentTerms?: number | null;
  /** Backend-configured expiry for the current price, serialized as an ISO date. */
  priceValidUntil?: string | null;
  /** Backend `status`; undefined when the payload omits it (price fallback applies). */
  status?: ListingStatus;
  /** Owner/seller user id when the payload carries it — used to scope the seller dashboard to own listings. */
  sellerId?: string;
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
  category: Category;
  item: string;
  buyer: string;
  paymentTerms: string;
  targetPrice: number;
  bags: number;
  quality?: string;
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
