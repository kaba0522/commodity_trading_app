import { useEffect, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getFriendlyApiError } from "@/core/api/client";
import { authService } from "@/core/auth/authService";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { TosVersion } from "@/features/auth/types/authTypes";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

/** Fallback copy when the server version has no document links yet. */
const FALLBACK_TOS_TEXT =
  "Please read the full Terms of Service and Privacy Policy before continuing.";

/**
 * Terms acceptance gate (Buyer App.html `isTos`).
 * First login (or a newly published version): serves `GET /tos/current`
 * and records `POST /tos/accept { version }`. Returning users with the
 * current version accepted never land here (`GET /tos/status` decides).
 */
export function TermsScreen() {
  const { session, acceptTerms } = useAuth();
  const [tos, setTos] = useState<TosVersion | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isAgreeing, setIsAgreeing] = useState(false);
  const [agreeError, setAgreeError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const current = await authService.fetchCurrentTos(session);
        if (!cancelled) setTos(current);
      } catch (e) {
        if (!cancelled) {
          setFetchError(
            getFriendlyApiError(e, "Could not load the Terms of Service"),
          );
        }
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function handleAgree() {
    if (!tos) return;
    setAgreeError(null);
    setIsAgreeing(true);
    try {
      await acceptTerms(tos.version);
      router.replace("/");
    } catch (e) {
      setAgreeError(getFriendlyApiError(e, "Could not save acceptance"));
    } finally {
      setIsAgreeing(false);
    }
  }

  function handleRetry() {
    setFetchError(null);
    setIsFetching(true);
    (async () => {
      try {
        if (!session) throw new Error("No active session");
        setTos(await authService.fetchCurrentTos(session));
      } catch (e) {
        setFetchError(
          getFriendlyApiError(e, "Could not load the Terms of Service"),
        );
      } finally {
        setIsFetching(false);
      }
    })();
  }

  if (isFetching) {
    return (
      <View style={[styles.safe, styles.center]}>
        <ActivityIndicator />
        <Text style={styles.note}>Loading Terms of Service…</Text>
      </View>
    );
  }

  if (fetchError || !tos) {
    return (
      <View
        style={[
          styles.safe,
          styles.center,
          {
            paddingHorizontal: spacing.lg,
            paddingBottom: 20,
          },
        ]}
      >
        <Text style={styles.title}>Terms of Service &amp; Privacy Policy</Text>
        <Text style={styles.error}>{fetchError ?? "Could not load terms."}</Text>
        <Pressable style={styles.btn} onPress={handleRetry}>
          <Text style={styles.btnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <View
        style={[
          styles.content,
          { paddingBottom: 20 },
        ]}
      >
        <View style={styles.tag}>
          <Text style={styles.tagText}>TERMS OF SERVICE</Text>
        </View>
        <Text style={styles.title}>Terms of Service &amp; Privacy Policy</Text>
        <ScrollView style={styles.card} contentContainerStyle={styles.cardContent}>
          <Text style={styles.body}>
            Version {tos.version}
            {tos.effectiveDate ? ` · effective ${tos.effectiveDate}` : ""}
          </Text>
          <Text style={styles.body}>{FALLBACK_TOS_TEXT}</Text>
        </ScrollView>
        <View style={styles.links}>
          {tos.termsUrl ? (
            <Pressable onPress={() => void Linking.openURL(tos.termsUrl as string)}>
              <Text style={styles.link}>Terms of Service</Text>
            </Pressable>
          ) : null}
          {tos.privacyUrl ? (
            <Pressable
              onPress={() => void Linking.openURL(tos.privacyUrl as string)}
            >
              <Text style={styles.link}>Privacy Policy</Text>
            </Pressable>
          ) : null}
          {!tos.termsUrl && !tos.privacyUrl ? (
            <Text style={styles.note}>Document links not published yet.</Text>
          ) : null}
        </View>
        <Text style={styles.note}>
          By continuing, you agree to the Terms of Service and Privacy Policy
          (version {tos.version}).
        </Text>
        {agreeError ? <Text style={styles.error}>{agreeError}</Text> : null}
        <Pressable style={styles.btn} onPress={handleAgree} disabled={isAgreeing}>
          {isAgreeing ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.btnText}>Agree &amp; Continue</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: 20,
    gap: 14,
  },
  tag: {
    alignSelf: "flex-start",
    backgroundColor: colors.tagBuyerBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
    letterSpacing: 0.2,
    color: colors.tagBuyerText,
    fontWeight: "700",
  },
  title: {
    fontSize: 21,
    fontWeight: "800",
    color: colors.text,
  },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  cardContent: {
    padding: spacing.md,
  },
  body: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.text,
    opacity: 0.85,
  },
  links: {
    flexDirection: "row",
    gap: spacing.md,
  },
  link: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.accentBlue,
  },
  note: {
    fontSize: 12,
    color: colors.prototypeMuted,
  },
  error: {
    fontSize: 12,
    color: colors.danger,
    textAlign: "center",
  },
  btn: {
    height: 46,
    width: "100%",
    borderRadius: 999,
    backgroundColor: colors.accentBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.onPrimary,
  },
});
