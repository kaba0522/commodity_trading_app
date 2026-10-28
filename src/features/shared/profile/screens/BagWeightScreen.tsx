import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { FormStatus } from "@/components/ui/FormStatus";
import { ProfileHeader } from "@/features/shared/profile/components/ProfileHeader";
import { ProfileTabBar } from "@/features/shared/profile/components/ProfileTabBar";
import { useMyProfile } from "@/features/shared/profile/hooks/useMyProfile";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { fonts } from "@/theme/typography";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Bag weight screen (Profile → Bag weight): the seller's default weight
 * in kg used when a listing doesn't specify one. Saved via
 * `PATCH /users/me` (`defaultWeightKg`, a non-negative integer).
 */
export function BagWeightScreen() {
  const insets = useSafeAreaInsets();
  const { profile, save, isSaving, saveError, saved } = useMyProfile();
  const [weight, setWeight] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const syncedFromServer = useRef(false);
  useEffect(() => {
    if (profile && !syncedFromServer.current) {
      syncedFromServer.current = true;
      setWeight(
        profile.defaultWeightKg !== null ? String(profile.defaultWeightKg) : "",
      );
    }
  }, [profile]);

  async function handleSave() {
    const trimmed = weight.trim();
    if (trimmed === "") {
      // Clears the default server-side (listings then carry no weight).
      setLocalError(null);
      await save({ defaultWeightKg: null });
      return;
    }
    if (!/^\d+$/.test(trimmed)) {
      setLocalError("Enter whole kg (e.g. 30), or clear to remove.");
      return;
    }
    setLocalError(null);
    await save({ defaultWeightKg: Number(trimmed) });
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

        <Text style={styles.title}>Bag weight</Text>

        <View style={styles.card}>
          <Text style={styles.helper}>
            Default weight in kg used when a listing doesn&apos;t specify one.
          </Text>
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={(v) => {
              setWeight(v);
              setLocalError(null);
            }}
            placeholder="e.g. 30"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            accessibilityLabel="Default bag weight in kg"
          />
          {localError ? <Text style={styles.error}>{localError}</Text> : null}
          {saveError ? (
            <FormStatus kind="error" title="Could not save" message={saveError} />
          ) : null}
          {saved ? (
            <FormStatus
              kind="success"
              title="Saved"
              message="Your default bag weight is up to date."
            />
          ) : null}
          <Button
            title={isSaving ? "Saving…" : "Save changes"}
            loading={isSaving}
            onPress={handleSave}
          />
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
  helper: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.text,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
});
