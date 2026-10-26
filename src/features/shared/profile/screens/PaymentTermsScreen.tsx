import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { FormStatus } from "@/components/ui/FormStatus";
import { resolveBackendRole } from "@/core/auth/roleStore";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { ProfileHeader } from "@/features/shared/profile/components/ProfileHeader";
import { ProfileTabBar } from "@/features/shared/profile/components/ProfileTabBar";
import { useMyProfile } from "@/features/shared/profile/hooks/useMyProfile";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { fonts } from "@/theme/typography";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Payment terms screen (Profile → Payment terms): the seller's default
 * terms in days across listings. Saved via `PATCH /users/me`
 * (`defaultPaymentTerms`, a non-negative integer); per-listing overrides
 * already send via listingsApi.
 */
export function PaymentTermsScreen() {
  const { session } = useAuth();
  const role = resolveBackendRole(session?.user);
  const isSeller = role === "seller";
  const insets = useSafeAreaInsets();
  const { profile, save, isSaving, saveError, saved } = useMyProfile();
  const [days, setDays] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const syncedFromServer = useRef(false);
  useEffect(() => {
    if (profile && !syncedFromServer.current) {
      syncedFromServer.current = true;
      setDays(
        profile.defaultPaymentTerms !== null
          ? String(profile.defaultPaymentTerms)
          : "",
      );
    }
  }, [profile]);

  const name = session?.user.firmName || session?.user.name || "Account";

  async function handleSave() {
    const trimmed = days.trim();
    if (trimmed === "") {
      if (isSeller) {
        setLocalError("Sellers must keep default payment terms set.");
        return;
      }
      // Clears the default server-side (per-listing terms still apply).
      setLocalError(null);
      await save({ defaultPaymentTerms: null });
      return;
    }
    if (!/^\d+$/.test(trimmed)) {
      setLocalError("Enter whole days (e.g. 15), or clear to remove.");
      return;
    }
    setLocalError(null);
    await save({ defaultPaymentTerms: Number(trimmed) });
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
        <ProfileHeader initial={name.slice(0, 1).toUpperCase()} />

        <Text style={styles.title}>Payment terms</Text>

        <View style={styles.card}>
          <Text style={styles.helper}>
            Your default payment terms in days across listings. Override per
            listing when needed.
            {isSeller ? " Sellers must keep a default set." : ""}
          </Text>
          <TextInput
            style={styles.input}
            value={days}
            onChangeText={(v) => {
              setDays(v);
              setLocalError(null);
            }}
            placeholder={isSeller ? "Required for sellers, e.g. 15" : "e.g. 15"}
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            accessibilityLabel="Default payment terms in days"
          />
          {localError ? <Text style={styles.error}>{localError}</Text> : null}
          {saveError ? (
            <FormStatus kind="error" title="Could not save" message={saveError} />
          ) : null}
          {saved ? (
            <FormStatus
              kind="success"
              title="Saved"
              message="Your default payment terms are up to date."
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
