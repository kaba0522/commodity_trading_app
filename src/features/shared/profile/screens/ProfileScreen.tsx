import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { BackButton } from "@/components/common/BackButton";
import { Button } from "@/components/ui/Button";
import { FormStatus } from "@/components/ui/FormStatus";
import { resolveBackendRole } from "@/core/auth/roleStore";
import { ProfileRow } from "@/features/shared/profile/components/ProfileRow";
import { ProfileTabBar } from "@/features/shared/profile/components/ProfileTabBar";
import { useProfile, type ProfileRow as Row } from "@/features/shared/profile/hooks/useProfile";
import { profileToSessionPartial } from "@/features/shared/profile/hooks/useMyProfile";
import { profileApi } from "@/features/shared/profile/api/profileApi";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { formatPhoneDisplay } from "@/core/utils/validation";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Common profile (`isProfile` in both prototypes), parameterized by role. */
interface ProfileScreenProps {
  /** Render the back button (false when the screen is a tab). */
  showBack?: boolean;
  /** Render the shared bottom bar (false when the tab navigator already does). */
  showTabBar?: boolean;
}

export function ProfileScreen({
  showBack = true,
  showTabBar = true,
}: ProfileScreenProps = {}) {
  const { session, signOut, runWithAuth, mergeSessionUser } = useAuth();
  const role = resolveBackendRole(session?.user);
  const { main, share, legal } = useProfile(role);
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Refresh the cached profile when returning from an edit screen
  // (Account, Payment terms…) so the identity header stays current.
  // Silent: the cached session still renders when offline.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const fresh = await runWithAuth((token) => profileApi.getMe(token));
          if (!cancelled) await mergeSessionUser(profileToSessionPartial(fresh));
        } catch {
          // Offline/transient — keep the cached session.
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [runWithAuth, mergeSessionUser]),
  );

  const name = session?.user.firmName || session?.user.name || "Account";
  const initial = name.slice(0, 1).toUpperCase();

  /** Tab screens live in the tab navigators — replace avoids stacking a tab over profile. */
  const TAB_HREFS: ReadonlySet<string> = new Set(["/orders", "/trades", "/add-listing"]);

  function handleRow(row: Row) {
    if (row.href) {
      if (TAB_HREFS.has(row.href)) {
        router.replace(row.href);
      } else {
        router.push(row.href);
      }
      return;
    }
    setNotice(`${row.label} arrives in the next slice.`);
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  }

  // Profile lives in the root-level `(shared)` stack (outside the tab
  // navigators), so render the role's bottom bar here to keep it visible.
  return (
    <View style={styles.screen}>
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: showBack
            ? Math.max(insets.top + spacing.md, 62)
            : insets.top + spacing.md,
          paddingBottom: showTabBar
            ? insets.bottom + spacing.xl
            : spacing.xl,
        },
      ]}
    >
      {showBack ? <BackButton /> : null}

      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.identityText}>
          <Text style={styles.name}>{name}</Text>
          {session ? (
            <Text style={styles.phone}>{formatPhoneDisplay(session.user.phone)}</Text>
          ) : null}
          {role ? (
            <View style={styles.roleTag}>
              <Text style={styles.roleText}>{role.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {notice ? <FormStatus kind="info" title="Next slice" message={notice} /> : null}

      <View style={styles.card}>
        {main.map((row, i) => (
          <ProfileRow key={row.key} row={row} last={i === main.length - 1} onPress={handleRow} />
        ))}
      </View>

      <View style={styles.card}>
        {share.map((row, i) => (
          <ProfileRow key={row.key} row={row} last={i === share.length - 1} onPress={handleRow} />
        ))}
      </View>

      <View style={styles.card}>
        {legal.map((row, i) => (
          <ProfileRow key={row.key} row={row} last={i === legal.length - 1} onPress={handleRow} />
        ))}
      </View>

      <Button title={signingOut ? "Signing out…" : "Sign out"} variant="ghost" onPress={handleSignOut} />
    </ScrollView>
      {showTabBar ? <ProfileTabBar /> : null}
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
    paddingTop: 62,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
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
  avatarText: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.onPrimary,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  phone: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  roleTag: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryTint,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 6,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.04,
    color: colors.primaryDark,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
  },
});
