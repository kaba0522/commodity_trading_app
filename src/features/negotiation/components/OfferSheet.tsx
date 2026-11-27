import { Button } from "@/components/ui/Button";
import { bagsLabel, priceLabel } from "@/core/utils/format";
import { useVoiceRecorder } from "@/features/negotiation/hooks/useVoiceRecorder";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { VoiceNote } from "@/types/domain";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { PriceField } from "./PriceField";
import { Sheet } from "./Sheet";
import { VoiceNoteButton } from "./VoiceNoteButton";
import { offerFloor, validateBags, validateOfferPrice } from "../utils";

export interface OfferDraft {
  price: number;
  bags: number;
  note?: string;
  voiceNote?: VoiceNote;
}

interface OfferSheetProps {
  visible: boolean;
  role: "buyer" | "seller";
  listedPrice: number;
  availableBags: number;
  requestedBags?: number;
  onClose: () => void;
  onSubmit: (draft: OfferDraft) => void;
}

/** Make-offer bottom sheet — shared by buyer listings and seller requirements. */
export function OfferSheet({
  visible,
  role,
  listedPrice,
  availableBags,
  requestedBags,
  onClose,
  onSubmit,
}: OfferSheetProps) {
  const [price, setPrice] = useState(() =>
    String(role === "buyer" ? Math.round(listedPrice * 0.95) : listedPrice),
  );
  const [bags, setBags] = useState(() =>
    String(requestedBags || Math.min(availableBags || 50, 50) || 50),
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const {
    recording,
    durationMs,
    draft: voiceNote,
    error: voiceError,
    start,
    stop,
    clear,
  } = useVoiceRecorder();

  const priceIssue = validateOfferPrice(price, listedPrice, role);
  const bagsIssue = availableBags > 0 ? validateBags(bags, availableBags) : null;

  function submit() {
    const nextError = priceIssue ?? bagsIssue;
    setError(nextError);
    if (nextError) return;

    onSubmit({
      price: Number(price.replace(/,/g, "")),
      bags: Number(bags),
      note: note.trim() || undefined,
      voiceNote: voiceNote ?? undefined,
    });
  }

  const priceLabelText = role === "buyer" ? "Your offer price" : "Your selling price";
  const voiceNoteLabel =
    role === "buyer" ? "Send voice note to seller" : "Send voice note to buyer";

  return (
    <Sheet visible={visible} title="Make an offer" onClose={onClose}>
      <View style={styles.listedCard}>
        <Text style={styles.listedKicker}>
          {role === "buyer" ? "Listed price" : "Buyer's target"}
        </Text>
        <Text style={styles.listedPrice}>{priceLabel(listedPrice)}</Text>
        <Text style={styles.listedHint}>
          Minimum {priceLabel(offerFloor(listedPrice))} (90% of listed price)
        </Text>
      </View>

      <PriceField
        label={priceLabelText}
        value={price}
        onChangeText={(value) => {
          setPrice(value.replace(/[^0-9,]/g, ""));
          setError(null);
        }}
        placeholder={`${priceLabel(offerFloor(listedPrice))} – ${priceLabel(listedPrice)}`}
        error={error ? priceIssue : null}
        large
      />

      <View>
        <Text style={styles.label}>Bags needed</Text>
        <TextInput
          style={[styles.input, error && bagsIssue ? styles.inputError : null]}
          value={bags}
          onChangeText={(value) => {
            setBags(value.replace(/\D/g, ""));
            setError(null);
          }}
          placeholder="e.g. 50"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          accessibilityLabel="Bags needed"
        />
        <Text style={styles.hint}>
          {availableBags > 0
            ? `Available: ${bagsLabel(availableBags)}`
            : "Availability unconfirmed"}
        </Text>
      </View>

      <View>
        <Text style={styles.label}>Message (optional)</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder={
            role === "buyer" ? "Add a note to the seller..." : "Add a note to the buyer..."
          }
          placeholderTextColor={colors.muted}
          multiline
          accessibilityLabel="Optional message"
        />
      </View>

      <VoiceNoteButton
        label={voiceNoteLabel}
        recording={recording}
        durationMs={durationMs}
        draft={voiceNote}
        error={voiceError}
        onStart={() => void start()}
        onStop={() => void stop()}
        onClear={clear}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Send Offer" onPress={submit} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  listedCard: {
    gap: 2,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.primaryTint,
  },
  listedKicker: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  listedPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primaryDark,
  },
  listedHint: {
    fontSize: 11.5,
    color: colors.muted,
  },
  label: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.danger,
  },
  noteInput: {
    minHeight: 66,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: "top",
  },
  hint: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 4,
  },
  error: {
    fontSize: 12,
    color: colors.danger,
  },
});
