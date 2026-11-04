import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BackButton } from "@/components/common/BackButton";
import { Button } from "@/components/ui/Button";
import { getFriendlyApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { tosApi } from "@/features/auth/api/tosApi";
import type { TosVersion } from "@/features/auth/types/authTypes";
import { ProfileTabBar } from "@/features/shared/profile/components/ProfileTabBar";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { fonts } from "@/theme/typography";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type LegalDoc = "terms" | "privacy";

/**
 * Backend dates arrive as ISO strings ("2026-08-12T00:00:00.000Z") — render a
 * short readable date ("12 Aug 2026") instead of the raw timestamp.
 * Manual month names, no Intl dependency (unreliable on some Android builds).
 */
function formatEffectiveDate(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Platform legal viewer (Profile → bottom Privacy policy / Terms of Service).
 * Read-only: serves the platform document links from `GET /tos-versions/current`
 * (backend stores URLs, no inline body). This is NOT the seller's own firm
 * terms form (`FirmTermsScreen`) — that stays on the main Profile row above
 * Past trades.
 */
export function LegalScreen({ doc }: { doc: LegalDoc }) {
  const insets = useSafeAreaInsets();
  const { runWithAuth } = useAuth();
  const [tos, setTos] = useState<TosVersion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const title = doc === "terms" ? "Terms of Service" : "Privacy Policy";
  const url = tos
    ? doc === "terms"
      ? tos.termsUrl
      : tos.privacyUrl
    : null;
  const body =
    doc === "terms"
      ? "These are the platform's Terms of Service. They cover using the marketplace to list, negotiate, and trade."
      : "This is the platform's Privacy Policy. It covers what account and trade data we collect and how it is used.";

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setTos(await runWithAuth((token) => tosApi.current(token)));
    } catch (e) {
      setError(getFriendlyApiError(e, "Could not load this document"));
    } finally {
      setIsLoading(false);
    }
  }, [runWithAuth]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(spacing.md, 62 - insets.top),
            paddingBottom: spacing.xl,
          },
        ]}
      >
        <BackButton fallback="/profile" />

        <Text style={styles.title}>{title}</Text>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.muted}>Loading {title}…</Text>
          </View>
        ) : error || !tos ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>
              {error ?? "Document unavailable."}
            </Text>
            <Button title="Retry" variant="secondary" onPress={load} />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.helper}>{body}</Text>
            <Text style={styles.muted}>
              Version {tos.version}
              {tos.effectiveDate
                ? ` · effective ${formatEffectiveDate(tos.effectiveDate)}`
                : ""}
            </Text>
            {url ? (
              <Button
                title={`Open full ${title}`}
                onPress={() => void Linking.openURL(url)}
              />
            ) : (
              <Text style={styles.muted}>
                Document link not published yet — check back soon.
              </Text>
            )}
          </View>
        )}
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  helper: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.text,
  },
  muted: {
    fontSize: 13,
    color: colors.muted,
  },
  center: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  errorText: {
    fontSize: 13.5,
    color: colors.danger,
    textAlign: "center",
  },
});
