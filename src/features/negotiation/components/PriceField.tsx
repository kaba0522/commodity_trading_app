import { spacing } from "@/theme/spacing";
import { colors } from "@/theme/colors";
import { StyleSheet, Text, TextInput, View } from "react-native";

interface PriceFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  large?: boolean;
}

/** Numeric rupee input shared by the offer and counter sheets. */
export function PriceField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  large = false,
}: PriceFieldProps) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, error ? styles.boxError : null]}>
        <Text style={styles.currency}>₹</Text>
        <TextInput
          style={large ? styles.inputLarge : styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          accessibilityLabel={label}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  box: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
  },
  boxError: {
    borderColor: colors.danger,
  },
  currency: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.muted,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  inputLarge: {
    flex: 1,
    fontSize: 19,
    fontWeight: "700",
    color: colors.text,
  },
  error: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
  },
});
