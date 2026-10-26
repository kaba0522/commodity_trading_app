import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";

interface ModeToggleProps {
  first: string;
  second: string;
  value: "first" | "second";
  onChange: (value: "first" | "second") => void;
}

/**
 * Segmented By Commodity / By Seller (buyer) and By Commodity / By Buyer
 * (seller) switch, ported from both prototypes (same control, labels differ).
 */
export function ModeToggle({ first, second, value, onChange }: ModeToggleProps) {
  const options = [
    { key: "first" as const, label: first },
    { key: "second" as const, label: second },
  ];
  return (
    <View style={styles.wrap}>
      {options.map(({ key, label }) => {
        const active = value === key;
        return (
          <Pressable
            key={key}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  option: {
    flex: 1,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    paddingVertical: 10,
    alignItems: "center",
  },
  optionActive: {
    borderBottomColor: colors.primary,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  labelActive: {
    color: colors.primary,
  },
});
