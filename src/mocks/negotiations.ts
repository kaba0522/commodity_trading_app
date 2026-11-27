import type { NegotiationThread } from "@/types/domain";

/**
 * Mock negotiation threads ported from `Buyer Negotiation.html` and the
 * seller prototype's `ACTIVE_NEGOTIATIONS`. Screens render these until the
 * offers/trades API exists; swapping to fetch happens in the store, not in UI.
 */

export const MOCK_BUYER_THREADS: NegotiationThread[] = [
  {
    id: "n1",
    role: "buyer",
    counterparty: "Rajat SP Co",
    item: "Rajma · Disco · Bold",
    category: "Rajma",
    listedPrice: 12600,
    availableBags: 100,
    requestedBags: 50,
    weightKg: 30,
    paymentTerms: "Advance",
    status: "your_turn",
    counterCount: 0,
    updatedAt: "2m ago",
    messages: [
      {
        id: "n1-1",
        kind: "system",
        author: "system",
        time: "",
        text: "Nov 19, 2026 · Rajma Disco Bold",
      },
      {
        id: "n1-2",
        kind: "offer",
        author: "you",
        price: 12000,
        time: "10:30 AM",
      },
      {
        id: "n1-3",
        kind: "text",
        author: "you",
        note: "Can you do 12k for 50 bags?",
        time: "10:30 AM",
      },
      {
        id: "n1-4",
        kind: "offer",
        author: "them",
        price: 12200,
        time: "10:42 AM",
      },
      {
        id: "n1-5",
        kind: "text",
        author: "them",
        note: "Best I can do, market rate is 12,400",
        time: "10:42 AM",
      },
      {
        id: "n1-6",
        kind: "voice",
        author: "them",
        time: "10:43 AM",
      },
    ],
  },
  {
    id: "n2",
    role: "buyer",
    counterparty: "Parkash Food Ind.",
    item: "Besan · Rajdhani Mota",
    category: "Besan",
    listedPrice: 2200,
    availableBags: 200,
    requestedBags: 50,
    weightKg: 30,
    status: "waiting",
    counterCount: 1,
    updatedAt: "1h ago",
    messages: [
      {
        id: "n2-1",
        kind: "offer",
        author: "you",
        price: 2100,
        note: "50 bags needed",
        time: "9:40 AM",
      },
    ],
  },
  {
    id: "n3",
    role: "buyer",
    counterparty: "JD Enterprises",
    item: "Moong · Dhowa · Bold",
    category: "Dal",
    listedPrice: 8600,
    availableBags: 60,
    requestedBags: 40,
    weightKg: 30,
    status: "completed",
    counterCount: 0,
    updatedAt: "Yesterday",
    messages: [
      { id: "n3-1", kind: "offer", author: "you", price: 8400, time: "4:10 PM" },
      { id: "n3-2", kind: "offer", author: "them", price: 8500, time: "4:22 PM" },
      {
        id: "n3-3",
        kind: "system",
        author: "system",
        time: "",
        text: "Trade completed · ₹8,500 × 40 bags",
      },
    ],
    trade: {
      price: 8500,
      bags: 40,
      broker: "Suresh Agarwal",
      date: "Nov 18, 2026",
    },
  },
  {
    id: "n4",
    role: "buyer",
    counterparty: "HSN Overseas",
    item: "Rajma · Red Madras",
    category: "Rajma",
    listedPrice: 7800,
    availableBags: 80,
    requestedBags: 30,
    status: "cancelled",
    counterCount: 0,
    updatedAt: "Yesterday",
    messages: [
      {
        id: "n4-1",
        kind: "system",
        author: "system",
        time: "",
        text: "Cancelled",
      },
    ],
  },
  {
    id: "n6",
    role: "buyer",
    counterparty: "Sharma Pulses",
    item: "Toor Dal · Polished",
    category: "Dal",
    listedPrice: 9200,
    availableBags: 120,
    requestedBags: 60,
    status: "withdrawn",
    counterCount: 0,
    updatedAt: "3h ago",
    messages: [
      {
        id: "n6-1",
        kind: "system",
        author: "system",
        time: "",
        text: "Offer has been withdrawn",
      },
    ],
  },
];

export const MOCK_SELLER_THREADS: NegotiationThread[] = [
  {
    id: "s1",
    role: "seller",
    counterparty: "GH Mohi-ud-Din Mir & Co",
    item: "Matar White · Standard",
    category: "Matar",
    listedPrice: 4700,
    availableBags: 70,
    requestedBags: 50,
    weightKg: 30,
    status: "waiting",
    counterCount: 1,
    updatedAt: "18m ago",
    messages: [
      { id: "s1-1", kind: "offer", author: "them", price: 4700, time: "9:15 AM" },
      { id: "s1-2", kind: "offer", author: "you", price: 4900, time: "9:32 AM" },
    ],
  },
  {
    id: "s2",
    role: "seller",
    counterparty: "Mohd Akbar Farooq Ahmad",
    item: "Kabli Chana · Bold",
    category: "Chana",
    listedPrice: 7800,
    availableBags: 90,
    requestedBags: 60,
    weightKg: 30,
    status: "your_turn",
    counterCount: 1,
    updatedAt: "1h ago",
    messages: [
      { id: "s2-1", kind: "offer", author: "them", price: 7800, time: "8:40 AM" },
      { id: "s2-2", kind: "offer", author: "you", price: 8000, time: "8:52 AM" },
      { id: "s2-3", kind: "offer", author: "them", price: 7900, time: "9:05 AM" },
    ],
  },
  {
    id: "s3",
    role: "seller",
    counterparty: "Ismail Enterprises",
    item: "Rajma · Disco · Bold",
    category: "Rajma",
    listedPrice: 12200,
    availableBags: 100,
    requestedBags: 50,
    status: "completed",
    counterCount: 1,
    updatedAt: "Yesterday",
    messages: [
      { id: "s3-1", kind: "offer", author: "them", price: 12000, time: "2:15 PM" },
      { id: "s3-2", kind: "offer", author: "you", price: 12200, time: "2:30 PM" },
    ],
    trade: {
      price: 12200,
      bags: 50,
      broker: "Ratan",
      date: "Nov 18, 2026",
    },
  },
];

/** Fresh copies so a hot reload or a new session starts from prototype data. */
export function mockThreadsForRole(role: "buyer" | "seller"): NegotiationThread[] {
  const source = role === "buyer" ? MOCK_BUYER_THREADS : MOCK_SELLER_THREADS;
  return source.map((thread) => ({
    ...thread,
    messages: thread.messages.map((message) => ({ ...message })),
    trade: thread.trade ? { ...thread.trade } : undefined,
  }));
}

export function allMockThreads(): NegotiationThread[] {
  return [...mockThreadsForRole("buyer"), ...mockThreadsForRole("seller")];
}
