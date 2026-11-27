import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message: string;
  /** Confirm button label. Defaults to "Confirm". */
  confirmTitle?: string;
  /** Cancel button label. Defaults to "Keep". */
  cancelTitle?: string;
  /** Error to show inside the sheet (e.g. a failed confirm attempt). */
  error?: string | null;
  /** Shows a spinner on the confirm button + locks both buttons. */
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * In-app destructive-action confirmation (bottom sheet): a replacement for
 * the tiny native `Alert.alert` popup — large readable text and full-width
 * 52px buttons suited to older business users.
 */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmTitle = "Confirm",
  cancelTitle = "Keep",
  error,
  isBusy = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable
        style={styles.overlay}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        {/* Inner pressable swallows taps so the card itself never dismisses. */}
        <Pressable
          style={styles.card}
          onPress={() => {}}
          accessibilityRole="alert"
          accessibilityLabel={title}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.buttons}>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.cancelBtn,
                pressed && !isBusy && styles.pressed,
              ]}
              onPress={onCancel}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityLabel={cancelTitle}
            >
              <Text style={styles.cancelText}>{cancelTitle}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.confirmBtn,
                pressed && !isBusy && styles.pressed,
                isBusy && styles.btnBusy,
              ]}
              onPress={onConfirm}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityLabel={confirmTitle}
            >
              {isBusy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.confirmText}>{confirmTitle}</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  card: {
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
    textAlign: "center",
  },
  errorText: {
    fontSize: 13.5,
    color: colors.danger,
    textAlign: "center",
  },
  buttons: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  btn: {
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  cancelBtn: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  confirmBtn: {
    backgroundColor: colors.dangerText,
  },
  btnBusy: {
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.6,
  },
  cancelText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "700",
  },
  confirmText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
});
