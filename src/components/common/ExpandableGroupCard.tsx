import { ChevronIcon } from "@/components/common/ChevronIcon";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface ExpandableGroupCardProps {
  title: string;
  /** Optional short label shown next to the title (e.g. a listing count). */
  meta?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function ExpandableGroupCard({
  title,
  meta,
  expanded,
  onToggle,
  children,
}: ExpandableGroupCardProps) {
  return (
    <View style={styles.card}>
      <Pressable
        style={[styles.header, expanded && styles.headerExpanded]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={meta ? `${title}, ${meta}` : title}
        accessibilityState={{ expanded }}
      >
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        <ChevronIcon
          direction={expanded ? "down" : "right"}
          color={colors.primaryDark}
          size={18}
        />
      </Pressable>
      {expanded ? children : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  header: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
  },
  headerExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  meta: {
    flexShrink: 0,
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
  },
});
