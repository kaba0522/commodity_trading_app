import { Tabs } from "expo-router";
import { AppTabBar, SELLER_BAR } from "@/components/common/AppTabBar";

interface TabBarProps {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
}

function SellerBar({ state, navigation }: TabBarProps) {
  const route = state.routes[state.index]?.name ?? null;
  return (
    <AppTabBar
      items={SELLER_BAR}
      active={route}
      onPress={(target) => navigation.navigate(target)}
    />
  );
}

/**
 * Seller tabs. Browse (buyer requirements) is first + default.
 * The Add listing tab serves the My Listings dashboard (prototype
 * `backHome`); the form is a Stack screen above tabs
 * (`../add-listing-form`) so back navigation returns to the dashboard.
 * Profile is the last tab (`seller-profile` keeps its URL distinct from
 * the root-level `(shared)/profile` screen).
 */
export default function SellerTabsLayout() {
  return (
    <Tabs
      initialRouteName="requirements"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <SellerBar {...props} />}
    >
      <Tabs.Screen name="requirements" options={{ title: "Browse" }} />
      <Tabs.Screen name="orders" options={{ title: "Trades" }} />
      <Tabs.Screen name="add-listing" options={{ title: "My Listings" }} />
      <Tabs.Screen name="transport" options={{ title: "Freight" }} />
      <Tabs.Screen name="seller-profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
