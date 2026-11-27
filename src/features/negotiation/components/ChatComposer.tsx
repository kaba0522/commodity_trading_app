import { MicIcon } from "@/components/common/TabIcons";
import { durationLabel } from "@/core/utils/format";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { VoiceNote } from "@/types/domain";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { VoiceNotePlayer } from "./VoiceNotePlayer";

interface ChatComposerProps {
  disabled?: boolean;
  onSendText: (text: string) => Promise<void> | void;
  onSendVoice: (voice: VoiceNote) => Promise<void> | void;
}

/** Text + voice note composer for the shared negotiation thread. */
export function ChatComposer({ disabled, onSendText, onSendVoice }: ChatComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useVoiceRecorder();

  async function sendText() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSendText(value);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  async function sendVoice() {
    const voice = recorder.draft;
    if (!voice || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSendVoice(voice);
      recorder.clear();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send voice note.");
    } finally {
      setSending(false);
    }
  }

  // Closed negotiations have a terminal action bar; no composer or closed note.
  if (disabled) return null;

  return (
    <View style={styles.wrapper}>
      {recorder.draft ? (
        <View style={styles.draftRow}>
          <View style={styles.draftPlayer}>
            <VoiceNotePlayer uri={recorder.draft.uri} durationMs={recorder.draft.durationMs} mine />
          </View>
          <Pressable
            onPress={() => void sendVoice()}
            disabled={sending}
            style={styles.sendButton}
            accessibilityRole="button"
            accessibilityLabel="Send voice note"
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </Pressable>
          <Pressable onPress={recorder.clear} style={styles.removeButton}>
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      ) : recorder.recording ? (
        <View style={styles.recordingRow}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>
            Recording… {durationLabel(recorder.durationMs)} / 3:00
          </Text>
          <Pressable onPress={() => void recorder.stop()} style={styles.stopButton}>
            <Text style={styles.stopText}>Stop</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Message…"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={1000}
            accessibilityLabel="Message"
          />
          <Pressable
            onPress={() => void recorder.start()}
            disabled={sending}
            style={styles.micButton}
            accessibilityRole="button"
            accessibilityLabel="Record voice note"
          >
            <MicIcon size={24} color="black" />
          </Pressable>
          <Pressable
            onPress={() => void sendText()}
            disabled={sending || !text.trim()}
            style={[styles.sendButton, !text.trim() && styles.sendDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </Pressable>
        </View>
      )}

      {error || recorder.error ? (
        <Text style={styles.error}>{error ?? recorder.error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  sendButton: {
    minWidth: 54,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primary,
  },
  sendDisabled: {
    opacity: 0.45,
  },
  sendText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  draftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  draftPlayer: {
    flex: 1,
    minWidth: 0,
  },
  removeButton: {
    paddingHorizontal: spacing.xs,
  },
  removeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.danger,
  },
  recordingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    borderRadius: 20,
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
  stopButton: {
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
  },
});
