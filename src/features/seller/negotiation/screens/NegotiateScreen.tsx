import { Button } from "@/components/ui/Button";
import { FormStatus } from "@/components/ui/FormStatus";
import { ListingOfferScreen, type OfferEntrySeed } from "@/features/negotiation/screens/ListingOfferScreen";
import { useNegotiation } from "@/features/seller/negotiation/hooks/useNegotiation";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

/**
 * Seller requirement entry. Keeps the live requirement refresh from
 * `useNegotiation`, then hands resolved values to the shared negotiation flow.
 */
export function NegotiateScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    category?: string;
    item?: string;
    buyer?: string;
    bags?: string;
    targetPrice?: string;
    paymentTerms?: string;
    quality?: string;
    weightKg?: string;
    location?: string;
    notes?: string;
  }>();
  const { requirement, isLoading, error, retry } = useNegotiation({
    id: typeof params.id === "string" ? params.id : undefined,
    category: params.category,
    item: params.item,
    buyer: params.buyer,
    bags: params.bags,
    targetPrice: params.targetPrice,
    paymentTerms: params.paymentTerms,
    quality: params.quality,
    weightKg: params.weightKg,
    location: params.location,
    notes: params.notes,
  });

  if (isLoading && !requirement) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.muted}>Loading requirement…</Text>
      </View>
    );
  }

  if (!requirement) {
    return (
      <View style={styles.center}>
        <FormStatus
          kind="error"
          message={error ?? "Could not load this requirement."}
        />
        <Button title="Retry" variant="secondary" onPress={retry} />
      </View>
    );
  }

  const seed: OfferEntrySeed = {
    id: String(requirement.id),
    item: requirement.item,
    counterparty: requirement.buyer,
    category: requirement.category,
    listedPrice: requirement.targetPrice,
    availableBags: requirement.bags,
    requestedBags: requirement.bags,
    weightKg: requirement.weightKg,
    paymentTerms: requirement.paymentTerms,
    quality: requirement.quality,
    location: requirement.location,
    notes: requirement.notes,
  };

  return <ListingOfferScreen role="seller" seed={seed} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  muted: {
    fontSize: 13,
    color: colors.muted,
  },
});
