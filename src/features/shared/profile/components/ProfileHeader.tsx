import { StyleSheet, View } from "react-native";
import { BackButton } from "@/components/common/BackButton";

/** Back link shared by profile detail screens. */
export function ProfileHeader() {
  return (
    <View style={styles.headRow}>
      <BackButton
        accessibilityLabel="Back to profile"
        fallback="/profile"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});
