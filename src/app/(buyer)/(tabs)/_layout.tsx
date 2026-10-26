import { router, Tabs } from "expo-router";
import { AppTabBar, BUYER_BAR } from "@/components/common/AppTabBar";

interface TabBarProps {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
}

function BuyerBar({ state, navigation }: TabBarProps) {
  const active = state.routes[state.index]?.name ?? null;
  return (
    <AppTabBar
      items={BUYER_BAR}
      active={active}
      onPress={(target) => {
        if (target === "profile") {
          router.push("/profile");
          return;
        }
        navigation.navigate(target);
      }}
    />
  );
}

/** Buyer tabs (shared navbar on every main screen). Browse is first + default. */
export default function BuyerTabsLayout() {
  return (
    <Tabs
      initialRouteName="browse"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BuyerBar {...props} />}
    >
      <Tabs.Screen name="browse" options={{ title: "Browse" }} />
      <Tabs.Screen name="trades" options={{ title: "Trades" }} />
      <Tabs.Screen name="post-req" options={{ title: "Post req" }} />
      <Tabs.Screen name="freight" options={{ title: "Freight" }} />
    </Tabs>
  );
}
