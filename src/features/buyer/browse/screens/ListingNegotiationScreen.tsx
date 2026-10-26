import { BackButton } from "@/components/common/BackButton";
import { Button } from "@/components/ui/Button";
import { FormStatus } from "@/components/ui/FormStatus";
import { bagsLabel, priceLabel } from "@/core/utils/format";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Buyer offer screen (`Buyer App.html` negotiation flow). */
export function ListingNegotiationScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    item?: string;
    seller?: string;
    price?: string;
    weight?: string;
    bags?: string;
  }>();
  const [quantity, setQuantity] = useState("");
  const [offer, setOffer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const askingPrice = Number(params.price ?? 0);
  const availableBags = Number(params.bags ?? 0);
  const formattedPrice = Number.isFinite(askingPrice)
    ? priceLabel(askingPrice)
    : priceLabel(0);

  function acceptAskingPrice() {
    setError(null);
    setNotice(
      "The asking price is shown, but accepting or booking a trade is not available yet.",
    );
  }

  function sendOffer() {
    const bagCount = Number(quantity.trim());
    if (!Number.isInteger(bagCount) || bagCount <= 0) {
      setError("Enter the number of bags you want to buy.");
      setNotice(null);
      return;
    }
    if (availableBags > 0 && bagCount > availableBags) {
      setError(`This listing has ${bagsLabel(availableBags)} available.`);
      setNotice(null);
      return;
    }
    const offerPrice = Number(offer.trim());
    if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
      setError("Enter your offer price per bag.");
      setNotice(null);
      return;
    }
    setError(null);
    setNotice(
      "Your offer has not been sent because the backend negotiation service is not available yet.",
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <BackButton
        accessibilityLabel="Back to listing details"
        fallback="/browse"
      />
      <Text style={styles.title}>Negotiate</Text>

      <View style={styles.card}>
        <Text style={styles.kicker}>Listing</Text>
        <Text style={styles.item}>{params.item || "Listing"}</Text>
        <Text style={styles.muted}>
          {params.seller || "Seller"} · asking {formattedPrice}
          {params.weight ? ` per ${params.weight} bag` : " per bag"}
        </Text>
      </View>

      <View>
        <Text style={styles.label}>Quantity (bags)</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={(value) => {
            setQuantity(value.replace(/\D/g, ""));
            setError(null);
            setNotice(null);
          }}
          placeholder={
            availableBags > 0 ? `Up to ${availableBags} bags` : "Enter bags"
          }
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          accessibilityLabel="Quantity in bags"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.kicker}>Seller&apos;s ask</Text>
        <Text style={styles.bigPrice}>
          {formattedPrice}
          <Text style={styles.perBag}> /bag</Text>
        </Text>
      </View>

      <View style={styles.askCard}>
        <Text style={styles.askTitle}>Seller is asking {formattedPrice}</Text>
        <Text style={styles.muted}>
          Accept it, or send your own offer below.
        </Text>
        <Button title="Accept asking price" onPress={acceptAskingPrice} />
      </View>

      <View>
        <Text style={styles.label}>Send an offer (₹ per bag)</Text>
        <View style={styles.offerRow}>
          <TextInput
            style={[styles.input, styles.offerInput]}
            value={offer}
            onChangeText={(value) => {
              setOffer(value.replace(/[^0-9.]/g, ""));
              setError(null);
              setNotice(null);
            }}
            placeholder="Enter price per bag"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            accessibilityLabel="Offer price per bag"
          />
          <View style={styles.sendButton}>
            <Button title="Send" onPress={sendOffer} />
          </View>
        </View>
        {error ? <FormStatus kind="error" message={error} /> : null}
        {notice ? <FormStatus kind="info" message={notice} /> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
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
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.muted,
  },
  item: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  muted: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  bigPrice: {
    fontSize: 25,
    fontWeight: "800",
    color: colors.text,
  },
  perBag: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
  },
  askCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.primaryTint,
  },
  askTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  offerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  offerInput: {
    flex: 1,
    minWidth: 0,
  },
  sendButton: {
    minWidth: 84,
  },
});
