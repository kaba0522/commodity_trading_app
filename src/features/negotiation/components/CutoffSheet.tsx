import { Button } from "@/components/ui/Button";
import { OFFER_CUTOFF_HOUR } from "@/features/negotiation/constants";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { StyleSheet, Text, View } from "react-native";
import { Sheet } from "./Sheet";

interface CutoffSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** Offers are blocked after 10 PM local time, as in the buyer prototype. */
export function CutoffSheet({ visible, onClose }: CutoffSheetProps) {
  const cutoffLabel = `${OFFER_CUTOFF_HOUR % 12 || 12}:00 PM`;
  return (
    <Sheet visible={visible} title="Offers closed for today" onClose={onClose}>
      <View style={styles.center}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>◷</Text>
        </View>
        <Text style={styles.message}>
          New offers can&apos;t be submitted after {cutoffLabel}. Try again
          tomorrow morning.
        </Text>
      </View>
      <Button title="Got it" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    gap: spacing.md,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.warningTint,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.warning,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: "center",
  },
});
