import { Redirect } from "expo-router";

/** Broker area landing — the tab navigator owns the actual Browse screen. */
export default function BrokerIndex() {
  return <Redirect href="/broker/browse" />;
}
