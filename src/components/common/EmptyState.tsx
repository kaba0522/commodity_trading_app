import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

interface EmptyStateProps {
  title: string;
  message: string;
  /** Optional centered action button. */
  action?: {
    label: string;
    onPress: () => void;
  };
}

/**
 * Shared empty-state placeholder (no data / error / coming-soon).
 * Replaces TabPlaceholder for real screens that have loaded but have
 * nothing to show — the tab bar still comes from the tab navigator.
 */
export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {action ? (
          <Text
            style={styles.action}
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            {action.label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
    maxWidth: 320,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: "center",
  },
  action: {
    marginTop: spacing.xs,
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
});