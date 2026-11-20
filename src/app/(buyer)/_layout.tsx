import { Redirect, Stack } from "expo-router";
import { resolveBackendRole } from "@/core/auth/roleStore";
import { useAuth } from "@/features/auth/hooks/useAuth";

/** Buyer area guard: signed-in buyers only (sellers and brokers go elsewhere). */
export default function BuyerLayout() {
  const { session, status, isLoading } = useAuth();

  if (isLoading) return null;
  if (status === "signed-out" || status === "needs-terms") return <Redirect href="/" />;
  const role = resolveBackendRole(session?.user);
  if (role === "seller") return <Redirect href="/requirements" />;
  if (role === "broker") return <Redirect href="/broker" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
