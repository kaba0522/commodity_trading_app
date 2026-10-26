import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Shared phone sign-in for buyer and seller accounts. */
export function LoginScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.safe}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>INVITE-ONLY NETWORK</Text>
          <Text style={styles.title}>Commodity Trading</Text>
          <Text style={styles.subtitle}>
            Sign in to view market prices and manage your business.
          </Text>
        </View>
        <LoginForm
          onCodeSent={(phone, expiresInSec) =>
            router.push({
              pathname: "/verify-otp",
              params: {
                phone,
                ...(expiresInSec !== undefined
                  ? { expiresInSec: String(expiresInSec) }
                  : {}),
              },
            })
          }
        />
        <View style={styles.footer}>
          <Text style={styles.invite}>
            Only invited users can sign in. Contact your broker for access.
          </Text>
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
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  hero: {
    marginTop: spacing.xl,
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    color: colors.primaryDark,
    backgroundColor: colors.primaryTint,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  footer: {
    marginTop: "auto",
    paddingTop: spacing.xl,
    alignItems: "center",
  },
  invite: {
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.muted,
    textAlign: "center",
  },
});
