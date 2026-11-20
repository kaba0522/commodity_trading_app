import { Stack } from "expo-router";

/**
 * Browse tab stack: list (`index`) + listing detail.
 * Nested in the broker tab so the bottom bar stays visible on both screens.
 */
export default function BrokerBrowseStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
