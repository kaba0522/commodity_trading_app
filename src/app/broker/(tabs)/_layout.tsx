import { Tabs } from "expo-router";
import { BrokerTabBar } from "@/features/broker/navigation/BrokerTabBar";

/** Broker tabs: Browse + My Trades only. */
export default function BrokerTabsLayout() {
  return (
    <Tabs
      initialRouteName="browse"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BrokerTabBar {...props} />}
    >
      <Tabs.Screen name="browse" options={{ title: "Browse" }} />
      <Tabs.Screen name="trades" options={{ title: "My Trades" }} />
    </Tabs>
  );
}