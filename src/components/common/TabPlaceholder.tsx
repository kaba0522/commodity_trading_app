import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface TabPlaceholderProps {
  title: string;
  note?: string;
}

/**
 * Stand-in for tab screens whose slice hasn't landed yet.
 * Real screens replace this (the tab bar comes from the tabs layout).
 */
export function TabPlaceholder({
  title,
  note = "Arrives in the next slice — browse, negotiate and trade flows plug in here.",
}: TabPlaceholderProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.note}>{note}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  note: {
    fontSize: 14,
    color: colors.muted,
    marginTop: spacing.xs,
  },
});
