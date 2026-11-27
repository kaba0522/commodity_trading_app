import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { StyleSheet, Text, View } from "react-native";

/** Lightweight in-app confirmation ("Offer sent!", "Counter sent!"). */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.toast} accessibilityLiveRegion="polite">
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    top: 12,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 50,
    borderRadius: 999,
    backgroundColor: colors.primaryDark,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    elevation: 4,
  },
  text: {
    color: colors.onPrimary,
    fontSize: 13.5,
    fontWeight: "700",
  },
});
