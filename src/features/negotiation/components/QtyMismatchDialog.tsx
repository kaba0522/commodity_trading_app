import { Button } from "@/components/ui/Button";
import { bagsLabel, priceLabel } from "@/core/utils/format";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { StyleSheet, Text, View } from "react-native";
import { Dialog } from "./Dialog";

interface QtyMismatchDialogProps {
  visible: boolean;
  requestedBags: number;
  availableBags: number;
  price: number;
  onCancel: () => void;
  onConfirm: () => void;
}

/** FE doc §7 — centered "Partial Availability" dialog before a buy / accept. */
export function QtyMismatchDialog({
  visible,
  requestedBags,
  availableBags,
  price,
  onCancel,
  onConfirm,
}: QtyMismatchDialogProps) {
  return (
    <Dialog visible={visible} title="Partial Availability" onClose={onCancel}>
      <View style={styles.center}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>!</Text>
        </View>
        <Text style={styles.message}>
          You requested {bagsLabel(requestedBags)} but only{" "}
          {bagsLabel(availableBags)} are available.
        </Text>
      </View>

      <View style={styles.offer}>
        <Text style={styles.offerLabel}>Buy {bagsLabel(availableBags)} at</Text>
        <Text style={styles.offerPrice}>{priceLabel(price)}</Text>
      </View>

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title="Cancel" variant="secondary" onPress={onCancel} />
        </View>
        <View style={styles.action}>
          <Button title="Confirm" onPress={onConfirm} />
        </View>
      </View>
    </Dialog>
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
    fontWeight: "800",
    color: colors.warning,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    textAlign: "center",
  },
  offer: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  offerLabel: {
    fontSize: 12.5,
    color: colors.muted,
  },
  offerPrice: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
});
