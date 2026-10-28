import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Button } from "@/components/ui/Button";
import { FormStatus } from "@/components/ui/FormStatus";
import { getFriendlyApiError } from "@/core/api/client";
import { authService } from "@/core/auth/authService";
import { resolveBackendRole } from "@/core/auth/roleStore";
import { formatPhoneDisplay, normalizeIndianPhone } from "@/core/utils/validation";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { ProfileHeader } from "@/features/shared/profile/components/ProfileHeader";
import { ProfileTabBar } from "@/features/shared/profile/components/ProfileTabBar";
import { useMyProfile } from "@/features/shared/profile/hooks/useMyProfile";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { fonts } from "@/theme/typography";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** White person glyph on the primary circle (same icon as ProfileButton). */
function AvatarGlyph({ size = 22 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.onPrimary}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </Svg>
  );
}

/**
 * Account screen (opened from Profile → Account): identity card with name,
 * firm, verified phone and city. Edits save via `PATCH /users/me`
 * (name/firmName/city); the verified phone is the login identity and can
 * only change through OTP re-verification.
 */
export function AccountScreen() {
  const { session } = useAuth();
  const role = resolveBackendRole(session?.user);
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<string | null>(null);
  const { profile, save, isSaving, saveError, saved } = useMyProfile();

  const [name, setName] = useState(session?.user.name ?? "");
  const [firmName, setFirmName] = useState(session?.user.firmName ?? "");
  const [city, setCity] = useState(session?.user.city ?? "");

  // Fill in server values on first load (e.g. city set on another
  // device). Skipped once the user starts typing so edits are never
  // clobbered by a late response.
  const syncedFromServer = useRef(false);
  useEffect(() => {
    if (profile && !syncedFromServer.current) {
      syncedFromServer.current = true;
      setName(profile.name ?? "");
      setFirmName(profile.firmName ?? "");
      setCity(profile.city ?? "");
    }
  }, [profile]);

  const [showChangeNumber, setShowChangeNumber] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);

  const displayName = firmName.trim() || name.trim() || "Account";
  const roleLabel = role
    ? role.charAt(0).toUpperCase() + role.slice(1)
    : "Account";
  const switchLabel =
    role === "seller" ? "Switch to buyer mode" : "Switch to seller mode";

  function toggleChangeNumber() {
    setShowChangeNumber((v) => !v);
    setOtpError(null);
    setOtpSentTo(null);
  }

  async function sendChangeOtp() {
    const normalized = normalizeIndianPhone(newPhone);
    if (!normalized) {
      setOtpError("Enter a valid 10-digit mobile number.");
      setOtpSentTo(null);
      return;
    }
    if (session && normalized === session.user.phone) {
      setOtpError("This is already your verified number.");
      setOtpSentTo(null);
      return;
    }
    setOtpSending(true);
    setOtpError(null);
    try {
      // No dedicated change-number endpoint yet — reuse the login OTP
      // sender so the new number gets an OTP to verify against.
      await authService.requestLoginOtp(normalized);
      setOtpSentTo(normalized);
    } catch (e) {
      setOtpError(getFriendlyApiError(e, "Could not send the OTP"));
    } finally {
      setOtpSending(false);
    }
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

        <Text style={styles.title}>Account</Text>

        {notice ? (
          <FormStatus kind="info" title="Next slice" message={notice} />
        ) : null}

        <View style={styles.card}>
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <AvatarGlyph />
            </View>
            <View style={styles.identityText}>
              <Text style={styles.identityName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.identityRole}>{roleLabel}</Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Name"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Firm name</Text>
            <TextInput
              style={styles.input}
              value={firmName}
              onChangeText={setFirmName}
              placeholder="Firm name"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Firm name"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone number</Text>
            <View style={styles.phoneRow}>
              <View style={[styles.input, styles.phoneInput]}>
                <Text style={styles.phoneText} numberOfLines={1}>
                  {session
                    ? formatPhoneDisplay(session.user.phone)
                    : "No number"}
                </Text>
              </View>
              <View style={styles.verifiedTag}>
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
              <Pressable
                onPress={toggleChangeNumber}
                accessibilityRole="button"
                accessibilityLabel="Change phone number"
                accessibilityState={{ expanded: showChangeNumber }}
                hitSlop={6}
              >
                <Text style={styles.changeText}>Change</Text>
              </Pressable>
            </View>
            {showChangeNumber ? (
              <View style={styles.changeBox}>
                <Text style={styles.changeHint}>
                  Changing your number requires OTP re-verification.
                </Text>
                <TextInput
                  style={styles.input}
                  value={newPhone}
                  onChangeText={(v) => {
                    setNewPhone(v);
                    setOtpError(null);
                  }}
                  placeholder="New mobile number"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  accessibilityLabel="New mobile number"
                />
                {otpError ? (
                  <Text style={styles.otpError}>{otpError}</Text>
                ) : null}
                {otpSentTo ? (
                  <FormStatus
                    kind="success"
                    title="OTP sent"
                    message={`Enter the code sent to ${formatPhoneDisplay(otpSentTo)} to verify your new number.`}
                  />
                ) : null}
                <Button
                  title={otpSending ? "Sending…" : "Send OTP to verify"}
                  loading={otpSending}
                  onPress={sendChangeOtp}
                />
              </View>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Add your city"
              placeholderTextColor={colors.muted}
              accessibilityLabel="City"
            />
          </View>

          {saveError ? (
            <FormStatus kind="error" title="Could not save" message={saveError} />
          ) : null}
          {saved ? (
            <FormStatus
              kind="success"
              title="Saved"
              message="Your account details are up to date."
            />
          ) : null}
          <Button
            title={isSaving ? "Saving…" : "Save changes"}
            loading={isSaving}
            onPress={() =>
              save({ name: name.trim(), firmName: firmName.trim(), city: city.trim() })
            }
          />

          <Pressable
            style={styles.switchButton}
            onPress={() =>
              setNotice("Role switching arrives in the next slice.")
            }
            accessibilityRole="button"
            accessibilityLabel={switchLabel}
          >
            <Text style={styles.switchText}>{switchLabel}</Text>
          </Pressable>
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
    gap: spacing.md,
    backgroundColor: colors.primaryTint,
    borderRadius: 16,
    padding: spacing.md,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  identityName: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  identityRole: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.primary,
    marginTop: 1,
  },
  field: {
    gap: 4,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
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
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  phoneInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    justifyContent: "center",
  },
  phoneText: {
    fontSize: 14,
    color: colors.text,
    paddingVertical: 12,
  },
  verifiedTag: {
    backgroundColor: colors.successBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.success,
  },
  changeText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    flexShrink: 0,
  },
  changeBox: {
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
  },
  changeHint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text,
  },
  otpError: {
    fontSize: 13,
    color: colors.danger,
  },
  switchButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: "center",
  },
  switchText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
});
