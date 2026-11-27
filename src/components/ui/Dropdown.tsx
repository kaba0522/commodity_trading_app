import { colors } from "@/theme/colors";
import { useRef, useState } from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface DropdownProps {
  /** Optional because some selects (for example the prototype broker select) are unlabeled. */
  label?: string;
  placeholder?: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  error?: string | null;
}

interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MENU_MAX_HEIGHT = 280;
const MENU_GAP = 6;

/**
 * Anchored dropdown: the menu floats directly under the field in a
 * `Modal` overlay, so it never pushes form content down and never
 * appears as a bottom sheet.
 */
export function Dropdown({ label, placeholder = "Select", value, options, onChange, error }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const anchorRef = useRef<View>(null);
  const display = value || placeholder;

  const close = () => setOpen(false);

  const openMenu = () => {
    const node = anchorRef.current;
    if (node) {
      node.measureInWindow((x: number, y: number, width: number, height: number) => {
        setAnchor({ x, y, width, height });
        setOpen(true);
      });
    } else {
      setOpen(true);
    }
  };

  const screenHeight = Dimensions.get("window").height;
  let menuTop = 0;
  let menuMaxHeight = MENU_MAX_HEIGHT;
  let menuWidth: number | undefined;
  if (anchor) {
    const spaceBelow = screenHeight - (anchor.y + anchor.height + MENU_GAP + 16);
    const spaceAbove = anchor.y - MENU_GAP - 16;
    menuWidth = anchor.width;
    if (spaceBelow >= 180 || spaceBelow >= spaceAbove) {
      menuTop = anchor.y + anchor.height + MENU_GAP;
      menuMaxHeight = Math.max(120, Math.min(MENU_MAX_HEIGHT, spaceBelow));
    } else {
      menuMaxHeight = Math.max(120, Math.min(MENU_MAX_HEIGHT, spaceAbove));
      menuTop = anchor.y - menuMaxHeight - MENU_GAP;
    }
  }

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View ref={anchorRef} collapsable={false}>
        <Pressable
          style={[styles.box, open ? styles.boxOpen : null, error ? styles.boxError : null]}
          onPress={() => (open ? close() : openMenu())}
          accessibilityRole="button"
          accessibilityLabel={label ?? placeholder ?? "Select"}
          accessibilityState={{ expanded: open }}
        >
          <Text style={[styles.boxText, value ? null : styles.placeholder]} numberOfLines={1}>
            {display}
          </Text>
          <Text style={[styles.chevron, open ? styles.chevronOpen : null]}>▼</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={close} accessibilityRole="button" accessibilityLabel="Close" />
          <View
            style={[
              styles.menu,
              menuWidth != null ? { top: menuTop, left: anchor?.x ?? 0, width: menuWidth, maxHeight: menuMaxHeight } : styles.menuFallback,
            ]}
          >
            <ScrollView keyboardShouldPersistTaps="handled" persistentScrollbar>
              {options.map((option) => {
                const selected = option === value;
                return (
                  <Pressable
                    key={option}
                    style={[styles.option, selected ? styles.optionSelected : null]}
                    onPress={() => {
                      onChange(option);
                      close();
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.optionText, selected ? styles.optionTextSelected : null]}>
                      {option}
                    </Text>
                    {selected ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  box: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  boxOpen: {
    borderColor: colors.primary,
  },
  boxError: {
    borderColor: colors.danger,
  },
  boxText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  placeholder: {
    color: colors.muted,
  },
  chevron: {
    fontSize: 12,
    color: colors.muted,
  },
  chevronOpen: {
    color: colors.primary,
  },
  error: {
    fontSize: 12.5,
    color: colors.danger,
    marginTop: 4,
  },
  overlay: {
    flex: 1,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
  },
  menu: {
    position: "absolute",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  menuFallback: {
    top: 120,
    left: 24,
    right: 24,
    maxHeight: MENU_MAX_HEIGHT,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionSelected: {
    backgroundColor: colors.primaryTint,
  },
  optionText: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  optionTextSelected: {
    fontWeight: "700",
    color: colors.primaryDark,
  },
  check: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.primaryDark,
    marginLeft: 12,
  },
});
