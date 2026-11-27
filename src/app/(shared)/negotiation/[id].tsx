import { NegotiationChatScreen } from "@/features/negotiation/screens/NegotiationChatScreen";
import { useLocalSearchParams } from "expo-router";
import { stringParam } from "@/features/negotiation/utils";

/** Thin route — the thread itself decides buyer vs seller UI. */
export default function NegotiationChatRoute() {
  const params = useLocalSearchParams<{ id?: string | string[]; simulateCutoff?: string | string[] }>();
  return (
    <NegotiationChatScreen
      id={stringParam(params.id)}
      simulateCutoff={stringParam(params.simulateCutoff) === "1"}
    />
  );
}
