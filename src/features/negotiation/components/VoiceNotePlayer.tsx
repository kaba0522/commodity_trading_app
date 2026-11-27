import { durationLabel } from "@/core/utils/format";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface VoiceNotePlayerProps {
  uri?: string;
  durationMs?: number;
  mine?: boolean;
}

/** Playable voice bubble. Legacy mock notes without a URI render as a static clip. */
export function VoiceNotePlayer({
  uri,
  durationMs = 0,
  mine = true,
}: VoiceNotePlayerProps) {
  const player = useAudioPlayer(uri ?? null);
  const status = useAudioPlayerStatus(player);

  const playbackSeconds = Number.isFinite(status.duration) ? status.duration : 0;
  const totalSeconds =
    playbackSeconds > 0 ? playbackSeconds : Math.max(0, durationMs / 1000);
  const currentSeconds = Number.isFinite(status.currentTime)
    ? status.currentTime
    : 0;
  const progress =
    totalSeconds > 0 ? Math.min(1, Math.max(0, currentSeconds / totalSeconds)) : 0;
  const duration = durationLabel(totalSeconds * 1000);

  async function toggle() {
    if (!uri) return;
    if (status.playing) {
      player.pause();
      return;
    }
    if (totalSeconds > 0 && currentSeconds >= totalSeconds - 0.05) {
      await player.seekTo(0);
    }
    player.play();
  }

  const playColor = mine ? colors.primary : colors.counterparty;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => void toggle()}
        disabled={!uri}
        style={[styles.play, { borderColor: playColor }]}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? "Pause voice note" : "Play voice note"}
      >
        <Text style={[styles.playText, { color: playColor }]}>
          {status.playing ? "❚❚" : "▶"}
        </Text>
      </Pressable>

      <View style={styles.wave}>
        <View
          style={[
            styles.waveFill,
            { width: `${Math.round(progress * 100)}%`, backgroundColor: playColor },
          ]}
        />
      </View>

      <Text style={styles.duration}>{duration}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minWidth: 170,
  },
  play: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  playText: {
    fontSize: 11,
    fontWeight: "800",
  },
  wave: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  waveFill: {
    height: 4,
    borderRadius: 2,
  },
  duration: {
    fontSize: 11,
    color: colors.muted,
    minWidth: 34,
    textAlign: "right",
  },
});
