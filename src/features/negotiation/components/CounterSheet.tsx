import { Button } from "@/components/ui/Button";
import { priceLabel } from "@/core/utils/format";
import { useVoiceRecorder } from "@/features/negotiation/hooks/useVoiceRecorder";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { VoiceNote } from "@/types/domain";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { PriceField } from "./PriceField";
import { Sheet } from "./Sheet";
import { VoiceNoteButton } from "./VoiceNoteButton";
import { validateOfferPrice, type NegotiationRole } from "../utils";

interface CounterSheetProps {
  visible: boolean;
  role: NegotiationRole;
  listedPrice: number;
  theirOffer: number;
  remaining: number;
  max?: number;
  onClose: () => void;
  onSubmit: (price: number, note?: string, voice?: VoiceNote) => void;
}

/** Counter-offer bottom sheet with the prototype's max-two-counter limit. */
export function CounterSheet({
  visible,
  role,
  listedPrice,
  theirOffer,
  remaining,
  max = 2,
  onClose,
  onSubmit,
}: CounterSheetProps) {
  const [price, setPrice] = useState(() =>
    String(Math.round((theirOffer + listedPrice) / 2)),
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

  function submit() {
    if (priceIssue) {
      setError(priceIssue);
      return;
    }
    onSubmit(
      Number(price.replace(/,/g, "")),
      note.trim() || undefined,
      voiceNote ?? undefined,
    );
  }

  return (
    <Sheet visible={visible} title="Counter Offer" onClose={onClose}>
      <View style={styles.summary}>
        <View>
          <Text style={styles.summaryLabel}>Their offer</Text>
          <Text style={styles.summaryValue}>{priceLabel(theirOffer)}</Text>
        </View>
        <View style={styles.summaryRight}>
          <Text style={styles.summaryLabel}>Listed price</Text>
          <Text style={styles.summaryListed}>{priceLabel(listedPrice)}</Text>
        </View>
      </View>

      <PriceField
        label="Your counter price"
        value={price}
        onChangeText={(value) => {
          setPrice(value.replace(/[^0-9,]/g, ""));
          setError(null);
        }}
        error={error ? priceIssue : null}
        large
      />

      <View>
        <Text style={styles.label}>Message (optional)</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="Add a note…"
          placeholderTextColor={colors.muted}
          multiline
          accessibilityLabel="Optional message"
        />
      </View>

      <VoiceNoteButton
        recording={recording}
        durationMs={durationMs}
        draft={voiceNote}
        error={voiceError}
        onStart={() => void start()}
        onStop={() => void stop()}
        onClear={clear}
      />

      <Text style={styles.remaining}>
        {remaining > 0
          ? `${remaining} counter offer${remaining === 1 ? "" : "s"} remaining`
          : `Counter limit reached (${max}/${max})`}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Send Offer" onPress={submit} disabled={remaining <= 0} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  summaryRight: {
    alignItems: "flex-end",
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.muted,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.counterparty,
  },
  summaryListed: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.muted,
  },
  label: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: spacing.xs,
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
  remaining: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
  },
  error: {
    fontSize: 12,
    color: colors.danger,
    textAlign: "center",
  },
});
