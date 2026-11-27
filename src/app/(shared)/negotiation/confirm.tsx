import { TradeConfirmationScreen } from "@/features/negotiation/screens/TradeConfirmationScreen";
import { stringParam } from "@/features/negotiation/utils";
import { useLocalSearchParams } from "expo-router";

/** Thin route — broker selection for an agreed trade. */
export default function TradeConfirmationRoute() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  return <TradeConfirmationScreen id={stringParam(params.id)} />;
}
