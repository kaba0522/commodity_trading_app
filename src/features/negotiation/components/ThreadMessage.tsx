import { priceLabel } from "@/core/utils/format";
import { VoiceNotePlayer } from "@/features/negotiation/components/VoiceNotePlayer";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { NegotiationMessage } from "@/types/domain";
import { StyleSheet, Text, View } from "react-native";

interface ThreadMessageProps {
  message: NegotiationMessage;
  role: "buyer" | "seller";
}

/** Offer cards, chat bubbles, voice notes and system notices in a thread. */
export function ThreadMessage({ message, role }: ThreadMessageProps) {
  if (message.kind === "system") {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{message.text}</Text>
      </View>
    );
  }

  const mine = message.author === "you";
  if (message.kind === "offer") {
    const declined = message.status === "declined";
    const label = mine
      ? "Your offer"
      : declined && role === "buyer"
        ? "Counter offer"
        : role === "buyer"
          ? "Seller's counter"
          : "Buyer's offer";
    return (
      <View style={[styles.row, mine ? styles.rowRight : styles.rowLeft]}>
        <View
          style={[
            styles.offerCard,
            declined ? styles.offerDeclined : styles.offerActive,
          ]}
        >
          <View style={styles.offerHeader}>
            <Text
              style={[
                styles.offerLabel,
                declined ? styles.labelDeclined : styles.labelActive,
              ]}
            >
              {label.toUpperCase()}
            </Text>
            <Text style={styles.time}>{message.time}</Text>
          </View>
          <Text
            style={[
              styles.offerPrice,
              declined ? styles.priceDeclined : styles.priceActive,
            ]}
          >
            {priceLabel(message.price ?? 0)}
          </Text>
          {message.note ? <Text style={styles.note}>{message.note}</Text> : null}
          {message.status ? (
            <View style={styles.statusTag}>
              <Text style={styles.statusText}>{message.status}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  if (message.kind === "voice") {
    return (
      <View style={[styles.row, mine ? styles.rowRight : styles.rowLeft]}>
        <View
          style={[
            styles.bubble,
            styles.voiceBubble,
            mine ? styles.bubbleMine : styles.bubbleTheirs,
          ]}
        >
          {message.voice?.uri ? (
            <VoiceNotePlayer
              uri={message.voice.uri}
              durationMs={message.voice.durationMs ?? 0}
              mine={mine}
            />
          ) : (
            <Text style={styles.bubbleText}>Voice note unavailable</Text>
          )}
          <Text style={styles.timeBubble}>{message.time}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, mine ? styles.rowRight : styles.rowLeft]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={styles.bubbleText}>{message.text ?? message.note}</Text>
        <Text style={styles.timeBubble}>{message.time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  systemRow: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  systemText: {
    fontSize: 11,
    color: colors.muted,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    marginVertical: 4,
  },
  rowRight: {
    justifyContent: "flex-end",
  },
  rowLeft: {
    justifyContent: "flex-start",
  },
  offerCard: {
    maxWidth: "88%",
    borderRadius: 14,
    padding: spacing.md,
    borderLeftWidth: 3,
    gap: 2,
  },
  /** Every active offer is blue; only declined offers use the orange accent. */
  offerActive: {
    backgroundColor: colors.primaryTint,
    borderLeftColor: colors.primary,
  },
  /** Prototype declined state: white card, orange accent, deep-red price. */
  offerDeclined: {
    backgroundColor: colors.card,
    borderLeftColor: colors.declinedAccent,
  },
  offerHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  offerLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  labelActive: { color: colors.primaryDark },
  labelDeclined: { color: colors.declinedAccent },
  offerPrice: {
    fontSize: 23,
    fontWeight: "800",
  },
  priceActive: { color: colors.primaryDark },
  priceDeclined: { color: colors.declinedPrice },
  note: {
    fontSize: 13,
    color: colors.text,
    marginTop: 2,
  },
  statusTag: {
    alignSelf: "flex-start",
    borderRadius: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "capitalize",
  },
  time: {
    fontSize: 10,
    color: colors.muted,
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: colors.primaryTint,
  },
  bubbleTheirs: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    fontSize: 14,
    color: colors.text,
  },
  timeBubble: {
    fontSize: 10,
    color: colors.muted,
    textAlign: "right",
    marginTop: 2,
  },
  voiceBubble: {
    minWidth: 220,
  },
});
