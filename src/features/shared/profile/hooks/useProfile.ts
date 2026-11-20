import type { Role } from "@/types/domain";

export interface ProfileRow {
  key: string;
  label: string;
  /** Href of an implemented route, if any. */
  href?:
    | "/account"
    | "/payment-terms"
    | "/firm-terms"
    | "/platform-terms"
    | "/privacy-policy"
    | "/orders"
    | "/trades"
    | "/preferences"
    | "/bag-weight"
    | "/add-listing";
  /** Small tag shown before the chevron (e.g. ToS status). */
  tag?: string;
  /** Non-interactive row (e.g. "Coming soon"). */
  disabled?: boolean;
}

/**
 * Common profile rows (`isProfile` in both prototypes — one screen,
 * parameterized by role; only the role-specific rows differ).
 */
export function useProfile(role: Role | null) {
  if (role === "broker") {
    const main: ProfileRow[] = [
      { key: "account", label: "Account", href: "/account" },
      { key: "trades", label: "My trades", href: "/trades" },
      { key: "preferences", label: "Preferences", href: "/preferences" },
    ];
    const share: ProfileRow[] = [
      { key: "share", label: "Share with your friends" },
    ];
    const legal: ProfileRow[] = [
      { key: "privacy", label: "Privacy policy", href: "/privacy-policy" },
      { key: "terms", label: "Terms of Service", href: "/platform-terms" },
    ];
    return { main, share, legal };
  }

  const main: ProfileRow[] = [
    { key: "account", label: "Account", href: "/account" },
    { key: "payment", label: "Payment terms", href: "/payment-terms" },
    { key: "terms-status", label: "Terms of Service", href: "/firm-terms" },
    {
      key: "trades",
      label: "Past trades",
      href: role === "seller" ? "/orders" : "/trades",
    },
    ...(role === "seller"
      ? [
          { key: "listings", label: "My listings", href: "/add-listing" as const },
          { key: "bagweight", label: "Bag weight", href: "/bag-weight" as const },
        ]
      : [{ key: "requirements", label: "My requirements" }]),
    { key: "preferences", label: "Preferences", href: "/preferences" },
  ];

  const share: ProfileRow[] = [
    { key: "share", label: "Share with your friends" },
  ];

  const legal: ProfileRow[] = [
    { key: "privacy", label: "Privacy policy", href: "/privacy-policy" },
    { key: "terms", label: "Terms of Service", href: "/platform-terms" },
  ];

  return { main, share, legal };
}
