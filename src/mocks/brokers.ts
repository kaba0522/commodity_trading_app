/** Broker options ported from the buyer/seller negotiation prototypes. */

export const NO_BROKER = "No broker";

export const BUYER_BROKERS: readonly string[] = [
  "Vinod Sharma",
  "Suresh Agarwal",
  "Manoj Gupta",
  "Ravi Jain",
  NO_BROKER,
];

export const SELLER_BROKERS: readonly string[] = [
  "Ratan",
  "Sanjay",
  "Naveen",
  NO_BROKER,
];

export function brokersForRole(role: "buyer" | "seller"): readonly string[] {
  return role === "buyer" ? BUYER_BROKERS : SELLER_BROKERS;
}
