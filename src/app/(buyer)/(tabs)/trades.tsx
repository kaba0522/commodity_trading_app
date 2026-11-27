import { NegotiationListScreen } from "@/features/negotiation/screens/NegotiationListScreen";
import { stringParam } from "@/features/negotiation/utils";
import { useLocalSearchParams } from "expo-router";

/** Buyer Trades tab — active negotiations and completed trades. */
export default function BuyerTradesRoute() {
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const tab = stringParam(params.tab) === "completed" ? "completed" : "active";
  return <NegotiationListScreen role="buyer" initialTab={tab} />;
}
