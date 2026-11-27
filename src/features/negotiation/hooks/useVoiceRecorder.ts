import {
  getRecordingPermissionsAsync,
  PermissionStatus,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import type { VoiceNote } from "@/types/domain";

/** Recordings are kept in the app document directory, not volatile cache. */
const RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: "document",
};

/** Once permission is denied, iOS/Android require the user to visit Settings. */
function showMicSettingsPrompt() {
  Alert.alert(
    "Microphone access needed",
    "Allow microphone access in Settings to record a voice note.",
    [
      { text: "Cancel", style: "cancel" },
      ...(Platform.OS === "web"
        ? []
        : [
            {
              text: "Open Settings",
              onPress: () => {
                void Linking.openSettings().catch(() => undefined);
              },
            },
          ]),
    ],
  );
}

/**
 * Shared record/stop/preview state for offer and counter voice notes.
 *
 * Duration is tracked in JS instead of `useAudioRecorderState`: that hook polls
 * `getStatus()` and can call the native recorder after a bottom sheet unmounts,
 * causing an Android "1st argument cannot be cast to AudioRecorder" crash.
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const [recording, setRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [draft, setDraft] = useState<VoiceNote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const recorderRef = useRef(recorder);

  useEffect(() => {
    recorderRef.current = recorder;
  }, [recorder]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      if (startedAtRef.current !== null) {
        setDurationMs(Date.now() - startedAtRef.current);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(
    () => () => {
      if (!recordingRef.current) return;
      recordingRef.current = false;
      try {
        void recorderRef.current.stop().catch(() => undefined);
      } catch {
        // Recorder may already be released during unmount.
      }
    },
    [],
  );

  async function start() {
    setError(null);
    try {
      const current = await getRecordingPermissionsAsync();
      const permission =
        current.status === PermissionStatus.GRANTED || !current.canAskAgain
          ? current
          : await requestRecordingPermissionsAsync();

      if (!permission.granted) {
        setError("Microphone access is blocked. Enable it in Settings.");
        showMicSettingsPrompt();
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
      setDraft(null);
      setDurationMs(0);
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAtRef.current = Date.now();
      recordingRef.current = true;
      setRecording(true);
    } catch {
      startedAtRef.current = null;
      recordingRef.current = false;
      setRecording(false);
      setError("Could not start recording on this device.");
    }
  }

  async function stop() {
    if (!recordingRef.current) return;
    setError(null);
    const elapsed = startedAtRef.current
      ? Date.now() - startedAtRef.current
      : 0;
    try {
      await recorder.stop();
      if (recorder.uri) {
        setDraft({
          uri: recorder.uri,
          durationMs: Math.max(1000, elapsed),
        });
      } else {
        setError("The recording could not be saved. Please try again.");
      }
    } catch {
      setError("Could not finish the recording. Please try again.");
    } finally {
      startedAtRef.current = null;
      recordingRef.current = false;
      setRecording(false);
    }
  }

  function clear() {
    setDraft(null);
    setError(null);
  }

  return {
    recording,
    durationMs,
    draft,
    error,
    start,
    stop,
    clear,
  };
}
