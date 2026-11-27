import { durationLabel } from "@/core/utils/format";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { VoiceNote } from "@/types/domain";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { VoiceNotePlayer } from "./VoiceNotePlayer";

interface VoiceNoteButtonProps {
  label?: string;
  recording: boolean;
  durationMs: number;
  draft: VoiceNote | null;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
}

/** Dashed voice-note field with record, stop, preview and remove states. */
export function VoiceNoteButton({
  label = "Record voice note",
  recording,
  durationMs,
  draft,
  error,
  onStart,
  onStop,
  onClear,
}: VoiceNoteButtonProps) {
  return (
    <View style={styles.wrapper}>
      {draft ? (
        <View style={[styles.button, styles.recorded]}>
          <View style={styles.preview}>
            <VoiceNotePlayer uri={draft.uri} durationMs={draft.durationMs} mine />
          </View>
          <Pressable
            onPress={onClear}
            style={styles.remove}
            accessibilityRole="button"
            accessibilityLabel="Remove voice note"
          >
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      ) : recording ? (
        <View style={[styles.button, styles.recording]}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>
            Recording {durationLabel(durationMs)}
          </Text>
          <Pressable
            onPress={onStop}
            style={styles.stop}
            accessibilityRole="button"
            accessibilityLabel="Stop recording"
          >
            <Text style={styles.stopText}>Stop</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          <View style={styles.icon}>
            <Text style={styles.iconText}>♪</Text>
          </View>
          <Text style={styles.text}>{label}</Text>
        </Pressable>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  button: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.card,
  },
  pressed: {
    opacity: 0.6,
  },
  icon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryTint,
  },
  iconText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primary,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  recorded: {
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  preview: {
    flex: 1,
    minWidth: 0,
  },
  remove: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  removeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.danger,
  },
  recording: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  recordingDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },
  recordingText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: colors.danger,
  },
  stop: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.card,
  },
  stopText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.danger,
  },
  error: {
    fontSize: 11.5,
    color: colors.danger,
    textAlign: "center",
  },
});
