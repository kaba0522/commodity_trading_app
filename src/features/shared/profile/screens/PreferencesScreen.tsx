import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ProfileHeader } from "@/features/shared/profile/components/ProfileHeader";
import { ProfileTabBar } from "@/features/shared/profile/components/ProfileTabBar";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { fonts } from "@/theme/typography";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type PreferenceKey = "push" | "whatsapp" | "sms";

const OPTIONS: { key: PreferenceKey; label: string; defaultOn: boolean }[] = [
  { key: "push", label: "Push notifications", defaultOn: true },
  { key: "whatsapp", label: "WhatsApp updates", defaultOn: true },
  { key: "sms", label: "SMS alerts", defaultOn: false },
];

/**
 * Preferences screen (Profile → Preferences): notification toggles.
 * Local-only until the backend preferences contract exists.
 */
export function PreferencesScreen() {
  const insets = useSafeAreaInsets();
  const [enabled, setEnabled] = useState<Record<PreferenceKey, boolean>>({
    push: true,
    whatsapp: true,
    sms: false,
  });

  function toggle(key: PreferenceKey) {
    setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + spacing.md, 62),
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
      >
        <ProfileHeader />

        <Text style={styles.title}>Preferences</Text>

        <View style={styles.card}>
          {OPTIONS.map(({ key, label }) => {
            const on = enabled[key];
            return (
              <Pressable
                key={key}
                style={styles.row}
                onPress={() => toggle(key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={label}
              >
                <View style={[styles.box, on && styles.boxChecked]}>
                  {on ? <Text style={styles.check}>✓</Text> : null}
                </View>
                <Text style={styles.rowLabel}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <ProfileTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 27,
    fontWeight: "800",
    color: colors.text,
  },
  card: {
    gap: spacing.sm,
    backgroundColor: colors.primaryTint,
    borderRadius: 16,
    padding: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  boxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  check: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onPrimary,
  },
  rowLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
});
