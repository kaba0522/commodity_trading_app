import {
  BrowseIcon,
  FreightIcon,
  PostReqIcon,
  ProfileIcon,
  TradesIcon,
} from "@/components/common/TabIcons";
import { colors } from "@/theme/colors";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface BarItem {
  /** Tab route name within its group. */
  target: string;
  label: string;
  Icon: (props: { color: string }) => React.ReactNode;
}

/** Buyer bar: prototype tabs (Browse, Trades, Post req, Freight). Browse is first + default. */
export const BUYER_BAR: BarItem[] = [
  { target: "browse", label: "Browse", Icon: BrowseIcon },
  { target: "trades", label: "Trades", Icon: TradesIcon },
  { target: "post-req", label: "Post req", Icon: PostReqIcon },
  { target: "freight", label: "Freight", Icon: FreightIcon },
];

/**
 * Seller bar: prototype tabs (Browse→requirements, Trades→orders,
 * My Listings→add-listing, Freight, Profile). The account icon no longer
 * sits in screen headers — Profile owns the last slot.
 */
export const SELLER_BAR: BarItem[] = [
  { target: "requirements", label: "Browse", Icon: BrowseIcon },
  { target: "orders", label: "Trades", Icon: TradesIcon },
  { target: "add-listing", label: "My Listings", Icon: PostReqIcon },
  { target: "transport", label: "Freight", Icon: FreightIcon },
  { target: "seller-profile", label: "Profile", Icon: ProfileIcon },
];

interface AppTabBarProps {
  items: BarItem[];
  active: string | null;
  onPress: (target: string) => void;
}

/**
 * Shared bottom navbar (ported from both prototypes — same bar, one
 * role-specific slot: Post req for buyers, Add listing for sellers).
 */
export function AppTabBar({ items, active, onPress }: AppTabBarProps) {
  const insets = useSafeAreaInsets();
  // Five-slot seller bar needs a slightly smaller label to stay on one line.
  const compact = items.length > 4;

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 20 }]}>
      {items.map(({ target, label, Icon }) => {
        const focused = target === active;
        const color = focused ? colors.primary : colors.muted;
        return (
          <Pressable
            key={target}
            style={styles.item}
            onPress={() => {
              if (!focused) onPress(target);
            }}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
          >
            <Icon color={color} />
            <Text
              style={[styles.label, compact && styles.labelCompact, { color }]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 20,
  },
  item: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
  },
  label: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  labelCompact: {
    fontSize: 10.5,
  },
});
