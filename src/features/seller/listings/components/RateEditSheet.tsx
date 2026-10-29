import { priceLabel } from "@/core/utils/format";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface RateEditSheetProps {
  visible: boolean;
  category: string;
  weight: string;
  item: string;
  price: number | null;
  saving: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (price: number) => Promise<boolean>;
}

export function RateEditSheet({
  visible,
  category,
  weight,
  item,
  price,
  saving,
  error,
  onClose,
  onSave,
}: RateEditSheetProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(String(price !== null ? price : ""));
  const rateValue = Number(draft);
  const saveDisabled =
    !draft.trim() ||
    !Number.isFinite(rateValue) ||
    rateValue <= 0 ||
    saving;

  async function saveRate() {
    if (saveDisabled) return;
    if (await onSave(rateValue)) onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close rate editor"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + spacing.lg },
            ]}
          >
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.heading}>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {category} · {weight} bag
                </Text>
                <Text style={styles.title} numberOfLines={1}>
                  {item}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Cancel rate edit"
              >
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            </View>

            <View style={styles.amountBox}>
              <Text style={styles.currency}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={draft}
                onChangeText={(value) =>
                  setDraft(value.replace(/[^\d]/g, "").slice(0, 7))
                }
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.muted}
                maxLength={7}
                autoFocus
                accessibilityLabel={`Price per bag${draft ? ` ${priceLabel(Number(draft))}` : ""}`}
              />
              <Text style={styles.perBag}>per bag</Text>
            </View>

            {error ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            <Pressable
              style={[
                styles.saveButton,
                saveDisabled && styles.saveButtonDisabled,
              ]}
              onPress={() => void saveRate()}
              disabled={saveDisabled}
              accessibilityRole="button"
              accessibilityLabel="Save rate"
              accessibilityState={{ disabled: saveDisabled }}
            >
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.saveButtonText}>Save Rate</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(32,30,29,0.45)",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 14,
    paddingHorizontal: 20,
    gap: 14,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  heading: {
    flex: 1,
    minWidth: 0,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  cancel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    paddingVertical: 6,
  },
  amountBox: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 6,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  currency: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.text,
  },
  amountInput: {
    minWidth: 60,
    padding: 0,
    fontSize: 38,
    fontWeight: "700",
    textAlign: "center",
    color: colors.text,
  },
  perBag: {
    fontSize: 14,
    color: colors.muted,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
    textAlign: "center",
  },
  saveButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.onPrimary,
  },
});
