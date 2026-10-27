import { BackButton } from "@/components/common/BackButton";
import { Button } from "@/components/ui/Button";
import { FormStatus } from "@/components/ui/FormStatus";
import { useNegotiation } from "@/features/seller/negotiation/hooks/useNegotiation";
import { bagsLabel, priceLabel } from "@/core/utils/format";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Seller Negotiate (Seller App.html `isNegotiate`): opened by tapping a
 * buyer-requirement card. Shows the requirement, the buyer's target price
 * with accept, and the seller's counter-offer input.
 */
export function NegotiateScreen() {
  const insets = useSafeAreaInsets();
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
  const {
    requirement,
    isLoading,
    error,
    retry,
    offer,
    setOffer,
    offerError,
    status,
    acceptTarget,
    sendOffer,
  } = useNegotiation({
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

  function viewAllFromBuyer() {
    if (!requirement) return;
    router.push({
      pathname: "/requirements",
      params: { buyer: requirement.buyer },
    });
  }

  const target = requirement?.targetPrice ?? 0;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.md },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topRow}>
        <BackButton
          accessibilityLabel="Back to buyer requirements"
          fallback="/requirements"
        />
      </View>
      <Text style={styles.title}>Negotiate</Text>

      {isLoading && !requirement ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.muted}>Loading requirement…</Text>
        </View>
      ) : error && !requirement ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" variant="secondary" onPress={retry} />
        </View>
      ) : requirement ? (
        <>
          <View style={styles.card}>
            <Text style={styles.kicker}>Buyer requirement</Text>
            <Text style={styles.item}>{requirement.item}</Text>
            <Text style={styles.muted}>
              {requirement.buyer} · targeting{" "}
              {target > 0 ? `${priceLabel(target)} per bag` : "open offer"} ·{" "}
              {bagsLabel(requirement.bags)}
            </Text>
            <View style={styles.termsTag}>
              <Text style={styles.termsTagText}>
                Payment terms:{" "}
                {requirement.paymentTerms || "Terms on request"}
              </Text>
            </View>
            {requirement.quality ? (
              <Text style={styles.muted}>Quality grade: {requirement.quality}</Text>
            ) : null}
            {requirement.weightKg != null ? (
              <Text style={styles.muted}>Weight per bag: {requirement.weightKg} kg</Text>
            ) : null}
            {requirement.location ? (
              <Text style={styles.muted}>Delivery location: {requirement.location}</Text>
            ) : null}
            {requirement.notes ? (
              <Text style={styles.muted}>Notes: {requirement.notes}</Text>
            ) : null}
            <Pressable
              onPress={viewAllFromBuyer}
              style={styles.buyerBox}
              accessibilityRole="button"
              accessibilityLabel={`View all requirements from ${requirement.buyer}`}
            >
              <Text style={styles.buyerBoxLeft}>
                View all requirements from
              </Text>
              <Text style={styles.buyerBoxRight} numberOfLines={2}>
                {requirement.buyer}
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.kicker}>Buyer&apos;s target</Text>
            <Text style={styles.bigPrice}>
              {target > 0 ? priceLabel(target) : "Open"}{" "}
              <Text style={styles.perBag}>/bag</Text>
            </Text>
            <Text style={styles.targetLine}>
              {target > 0
                ? `Buyer's target is ${priceLabel(target)}`
                : "Buyer is open to offers"}
            </Text>
            <Text style={styles.muted}>
              Accept it, or send your own offer below.
            </Text>
            <Button title="Accept target price" onPress={acceptTarget} />
          </View>

          <View>
            <Text style={styles.label}>Offer to sell at (₹ per bag)</Text>
            <View style={styles.offerRow}>
              <TextInput
                style={[
                  styles.input,
                  offerError ? styles.inputError : null,
                ]}
                value={offer}
                onChangeText={setOffer}
                placeholder="e.g. 8100"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                accessibilityLabel="Offer to sell at, rupees per bag"
              />
              <View style={styles.sendButton}>
                <Button title="Send" onPress={sendOffer} />
              </View>
            </View>
            {offerError ? (
              <Text style={styles.fieldError}>{offerError}</Text>
            ) : null}
          </View>

          {status ? (
            <FormStatus kind={status.kind} message={status.message} />
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  card: {
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.muted,
  },
  item: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  muted: {
    fontSize: 12.5,
    color: colors.muted,
  },
  termsTag: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent2Tint,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  termsTagText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.accent2Dark,
  },
  buyerBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    marginTop: 4,
    overflow: "hidden",
  },
  buyerBoxLeft: {
    flex: 1,
    fontSize: 12,
    color: colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  buyerBoxRight: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bigPrice: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
  },
  perBag: {
    fontSize: 15,
    fontWeight: "400",
    color: colors.muted,
  },
  targetLine: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    color: colors.text,
  },
  offerRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.danger,
  },
  fieldError: {
    fontSize: 12.5,
    color: colors.danger,
    marginTop: 4,
  },
  sendButton: {
    minWidth: 110,
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  errorText: {
    fontSize: 13.5,
    color: colors.danger,
    textAlign: "center",
  },
});
