import { Redirect, Stack } from "expo-router";
import { resolveBackendRole } from "@/core/auth/roleStore";
import { useAuth } from "@/features/auth/hooks/useAuth";

/** Broker area guard: signed-in brokers only. */
export default function BrokerLayout() {
  const { session, status, isLoading } = useAuth();

  if (isLoading) return null;
  if (status === "signed-out" || status === "needs-terms") return <Redirect href="/" />;
  if (resolveBackendRole(session?.user) !== "broker") return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}