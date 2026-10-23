import { FormStatus } from "@/components/ui/FormStatus";
import { formatLocalPhoneInput } from "@/core/utils/validation";
import { useLogin } from "@/features/auth/hooks/useLogin";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

interface LoginFormProps {
  onCodeSent: (phone: string, expiresInSec?: number) => void;
}

/**
 * Buyer prototype login form (Buyer App.html `isLoginPhone`).
 * OTP-only login.
 */
export function LoginForm({ onCodeSent }: LoginFormProps) {
  const { phone, setPhone, error, success, isLoading, submit, reset } = useLogin();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fresh form every time this screen is shown (back from OTP, after logout…).
  useFocusEffect(
    useCallback(() => {
      reset();
    }, [reset]),
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function handleSubmit() {
    if (isLoading) return;
    const result = await submit();
    if (result) {
      // Let the user see the success response before navigating.
      const { phone: sentPhone, challenge } = result;
      timer.current = setTimeout(() => onCodeSent(sentPhone, challenge.expiresInSec), 800);
    }
  }

  return (
    <View>
      {/* <Text style={styles.label}>Phone number</Text> */}
      <View style={styles.row}>
        <View style={[styles.input, styles.prefix]}>
          <Text style={styles.prefixText}>+91</Text>
        </View>
        <TextInput
          style={[
            styles.input,
            styles.number,
            error ? styles.inputError : null,
          ]}
          value={formatLocalPhoneInput(phone)}
          onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))}
          placeholder="Enter your phone number"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          maxLength={11}
          autoCorrect={false}
          autoComplete="tel"
        />
      </View>
      {error ? <FormStatus kind="error" message={error} /> : null}
      {success ? <FormStatus kind="success" message={success} /> : null}
      <View style={styles.buttons}>
        <Pressable
          style={[styles.btn, styles.btnOtp]}
          onPress={() => handleSubmit()}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.btnText}>Login with OTP</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
    fontSize: 16,
    color: colors.text,
  },
  prefix: {
    width: 56,
    flex: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0,
  },
  prefixText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  number: {
    flex: 1,
    paddingHorizontal: 14,
  },
  inputError: {
    borderColor: colors.danger,
  },
  buttons: {
    marginTop: spacing.sm,
    gap: 0,
  },
  btn: {
    height: 46,
    width: "100%",
    marginTop: spacing.sm,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  btnOtp: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  btnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.onPrimary,
  },
});
