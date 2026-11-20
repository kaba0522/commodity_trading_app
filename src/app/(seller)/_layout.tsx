import { Redirect, Stack } from "expo-router";
import { resolveBackendRole } from "@/core/auth/roleStore";
import { useAuth } from "@/features/auth/hooks/useAuth";

/** Seller area guard: signed-in sellers only (buyers and brokers go elsewhere). */
export default function SellerLayout() {
  const { session, status, isLoading } = useAuth();

  if (isLoading) return null;
  if (status === "signed-out" || status === "needs-terms") return <Redirect href="/" />;
  const role = resolveBackendRole(session?.user);
  if (role !== "seller") return <Redirect href={role === "broker" ? "/broker" : "/browse"} />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
