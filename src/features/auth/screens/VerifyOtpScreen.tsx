import { router } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/common/BackButton";
import { FormStatus } from "@/components/ui/FormStatus";
import { OtpInput } from "@/features/auth/components/OtpInput";
import { useOtp } from "@/features/auth/hooks/useOtp";
import { formatPhoneDisplay } from "@/core/utils/validation";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

interface VerifyOtpScreenProps {
  phone: string;
  expiresInSec?: number;
}

export function VerifyOtpScreen({ phone, expiresInSec }: VerifyOtpScreenProps) {
  const { code, setCode, error, notice, isLoading, isResending, cooldown, verify, resend } =
    useOtp(phone);

  async function handleVerify() {
    const ok = await verify();
    if (!ok) return;
    // Entry route decides: first login (or new TOS version) → /terms,
    // otherwise straight to the role home.
    router.replace("/");
  }

  return (
    <View style={styles.safe}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: spacing.lg,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton fallback="/login" />
        <View style={styles.header}>
          <Text style={styles.title}>Enter the code</Text>
          <Text style={styles.subtitle}>
            Sent to {formatPhoneDisplay(phone)}
            {expiresInSec !== undefined ? ` — valid for ${expiresInSec}s` : ""}.
          </Text>
        </View>
        <OtpInput value={code} onChange={setCode} hasError={!!error} />
        {error ? (
          <FormStatus kind="error" title="Request failed" message={error} />
        ) : null}
        {notice ? <FormStatus kind="success" message={notice} /> : null}
        <View style={styles.buttonWrap}>
          <Button title="Verify & continue" onPress={handleVerify} loading={isLoading} />
          <View style={styles.resendWrap}>
            <Button
              title={
                isResending
                  ? "Sending…"
                  : cooldown > 0
                    ? `Resend code in ${cooldown}s`
                    : "Resend code"
              }
              variant="ghost"
              onPress={resend}
              disabled={cooldown > 0 || isResending}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: 20,
  },
  header: {
    marginTop: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  buttonWrap: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  resendWrap: {
    alignItems: "center",
  },
});
