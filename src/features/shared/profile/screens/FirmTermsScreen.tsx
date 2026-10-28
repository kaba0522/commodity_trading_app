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
 * Firm Terms of Service (Profile → Firm terms): the seller's own terms
 * shown to buyers on listings. Saved via `PATCH /users/me` (`firmNotes`,
 * up to 2000 characters server-side).
 */
export function FirmTermsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, save, isSaving, saveError, saved } = useMyProfile();
  const [terms, setTerms] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const syncedFromServer = useRef(false);
  useEffect(() => {
    if (profile && !syncedFromServer.current) {
      syncedFromServer.current = true;
      setTerms(profile.firmNotes ?? "");
    }
  }, [profile]);

  async function handleSave() {
    if (!terms.trim()) {
      setLocalError("Write your terms first.");
      return;
    }
    setLocalError(null);
    await save({ firmNotes: terms.trim() });
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

        <Text style={styles.title}>Terms of Service</Text>

        <View style={styles.card}>
          <Text style={styles.helper}>
            Add your Terms of Service. Shown to buyers on your listings.
          </Text>
          {saved ? (
            <FormStatus
              kind="success"
              title="Terms saved"
              message="Buyers will see these on your listings."
            />
          ) : null}
          {saveError ? (
            <FormStatus kind="error" title="Could not save" message={saveError} />
          ) : null}
          <TextInput
            style={[styles.input, styles.multiline]}
            value={terms}
            onChangeText={(v) => {
              setTerms(v);
              setLocalError(null);
            }}
            placeholder="enter your Terms of Service..."
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            accessibilityLabel="Firm Terms of Service"
          />
          {localError ? <Text style={styles.error}>{localError}</Text> : null}
          <Button
            title={isSaving ? "Saving…" : "Save Terms of Service"}
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
  multiline: {
    minHeight: 120,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
});
