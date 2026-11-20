import { router } from "expo-router";
import { AppTabBar, BROKER_BAR } from "@/components/common/AppTabBar";

interface TabBarProps {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
}

/** Broker tab bar: Browse/My Trades are tab routes; Profile is a shared route. */
export function BrokerTabBar({ state, navigation }: TabBarProps) {
  const active = state.routes[state.index]?.name ?? null;

  return (
    <AppTabBar
      items={BROKER_BAR}
      active={active}
      onPress={(target) => {
        if (target === "profile") {
          router.replace("/profile");
          return;
        }
        navigation.navigate(target);
      }}
    />
  );
}
