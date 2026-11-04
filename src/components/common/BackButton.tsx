import { router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { ChevronIcon } from "@/components/common/ChevronIcon";
import { colors } from "@/theme/colors";

interface BackButtonProps {
  /** Screen-reader label, e.g. "Back to dashboard". Defaults to "Back". */
  accessibilityLabel?: string;
  /** Where to go when opened via deep link with no history to pop. */
  fallback?: Parameters<typeof router.replace>[0];
  /** Custom handler for multi-step flows (e.g. back to scan step). */
  onPress?: () => void;
}

/**
 * Shared icon-only back button: pops the navigation stack, falling back to
 * `fallback` when there is no history (deep link).
 */
export function BackButton({
  accessibilityLabel = "Back",
  fallback,
  onPress,
}: BackButtonProps) {
  function handlePress() {
    if (onPress) {
      onPress();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (fallback) {
      router.replace(fallback);
      return;
    }
    router.back();
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
    >
      <ChevronIcon direction="left" color={colors.primaryDark} size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  pressed: {
    opacity: 0.55,
  },
});
