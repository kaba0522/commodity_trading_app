import type { NegotiationStatus } from "@/types/domain";

/** Rules lifted directly from the negotiation prototypes. */
export const MIN_OFFER_RATIO = 0.9;
export const MAX_COUNTER_OFFERS = 2;
/** New offers are blocked after 10:00 PM local time. */
export const OFFER_CUTOFF_HOUR = 22;

export const FIRM_TERMS =
  "Goods must be outward within two days of order confirmation. Program received only before 5:00 PM. No tempo loading after 10 PM. Prices are subject to market conditions.";

export const STATUS_LABELS: Record<
  NegotiationStatus,
  { buyer: string; seller: string }
> = {
  your_turn: { buyer: "Your turn", seller: "Your turn" },
  waiting: { buyer: "Waiting", seller: "You countered" },
  withdrawn: { buyer: "Withdrawn", seller: "Withdrawn" },
  declined: { buyer: "Declined", seller: "Declined" },
  cancelled: { buyer: "Cancelled", seller: "Cancelled" },
  confirmed: { buyer: "Confirm trade", seller: "Confirm trade" },
  completed: { buyer: "Completed", seller: "Completed" },
};
