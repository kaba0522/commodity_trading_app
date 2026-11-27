import {
  getRecordingPermissionsAsync,
  PermissionStatus,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioStream,
  type AudioStreamBuffer,
  type RecordingOptions,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
import { useEffect, useRef, useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import type { VoiceNote } from "@/types/domain";
import { MAX_VOICE_NOTE_MS } from "../api/voiceNoteApi";

/**
 * Web keeps the MediaRecorder path because `useAudioStream` is a no-op on web.
 * Native captures PCM directly and writes WAV, which Cloudinary's audio
 * signature accepts; MP4/M4A containers are rejected by that signature.
 */
const WEB_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: "document",
};

/** 16 kHz mono WAV keeps a full 3-minute note under the backend's 8 MB limit. */
const PCM_SAMPLE_RATE = 16_000;
const PCM_CHANNELS = 1;
const BYTES_PER_SAMPLE = 2;

interface PcmMeta {
  sampleRate: number;
  channels: number;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

/** Downsample/interleave captured PCM into a standard 16-bit mono WAV file. */
function encodeWav(chunks: Uint8Array[], meta: PcmMeta): Uint8Array {
  const sourceRate = meta.sampleRate > 0 ? meta.sampleRate : PCM_SAMPLE_RATE;
  const sourceChannels = meta.channels > 0 ? meta.channels : PCM_CHANNELS;
  const targetRate = Math.min(sourceRate, PCM_SAMPLE_RATE);
  const bytesPerFrame = sourceChannels * BYTES_PER_SAMPLE;
  const sourceFrames = chunks.reduce(
    (total, chunk) => total + Math.floor(chunk.byteLength / bytesPerFrame),
    0,
  );
  const targetFrames = Math.floor((sourceFrames * targetRate) / sourceRate);
  const dataBytes = targetFrames * BYTES_PER_SAMPLE;
  const result = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(result);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size.
  view.setUint16(20, 1, true); // Uncompressed PCM.
  view.setUint16(22, PCM_CHANNELS, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * PCM_CHANNELS * BYTES_PER_SAMPLE, true);
  view.setUint16(32, PCM_CHANNELS * BYTES_PER_SAMPLE, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  let chunkIndex = 0;
  let chunkBase = 0;
  let outputOffset = 44;
  for (let frame = 0; frame < targetFrames; frame += 1) {
    const sourceFrame = Math.min(
      sourceFrames - 1,
      Math.floor((frame * sourceRate) / targetRate),
    );
    const sourceOffset = sourceFrame * bytesPerFrame;
    while (
      chunkIndex < chunks.length - 1 &&
      sourceOffset >= chunkBase + chunks[chunkIndex].byteLength
    ) {
      chunkBase += chunks[chunkIndex].byteLength;
      chunkIndex += 1;
    }
    const relative = sourceOffset - chunkBase;
    const sample = new DataView(
      chunks[chunkIndex].buffer,
      chunks[chunkIndex].byteOffset + relative,
      BYTES_PER_SAMPLE,
    ).getInt16(0, true);
    view.setInt16(outputOffset, sample, true);
    outputOffset += BYTES_PER_SAMPLE;
  }

  return new Uint8Array(result);
}

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
 * Shared record/stop/preview state for offer, counter, and chat voice notes.
 *
 * Duration is tracked in JS instead of `useAudioRecorderState`: that hook polls
 * native state and can call the recorder after a bottom sheet unmounts.
 */
export function useVoiceRecorder() {
  const recordingRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pcmChunksRef = useRef<Uint8Array[]>([]);
  const pcmMetaRef = useRef<PcmMeta>({
    sampleRate: PCM_SAMPLE_RATE,
    channels: PCM_CHANNELS,
  });

  const webRecorder = useAudioRecorder(WEB_RECORDING_OPTIONS);
  const audioStream = useAudioStream({
    sampleRate: PCM_SAMPLE_RATE,
    channels: PCM_CHANNELS,
    encoding: "int16",
    onBuffer: (buffer: AudioStreamBuffer) => {
      if (!recordingRef.current) return;
      if (pcmChunksRef.current.length === 0) {
        pcmMetaRef.current = {
          sampleRate: buffer.sampleRate || PCM_SAMPLE_RATE,
          channels: buffer.channels || PCM_CHANNELS,
        };
      }
      pcmChunksRef.current.push(new Uint8Array(buffer.data.slice(0)));
    },
  });

  const [recording, setRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [draft, setDraft] = useState<VoiceNote | null>(null);
  const [error, setError] = useState<string | null>(null);

  const webRecorderRef = useRef(webRecorder);
  const streamRef = useRef(audioStream.stream);

  useEffect(() => {
    webRecorderRef.current = webRecorder;
  }, [webRecorder]);

  useEffect(() => {
    streamRef.current = audioStream.stream;
  }, [audioStream.stream]);

  function clearAutoStop() {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  }

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
      clearAutoStop();
      if (!recordingRef.current) return;
      recordingRef.current = false;
      try {
        if (Platform.OS === "web") {
          void webRecorderRef.current.stop().catch(() => undefined);
        } else {
          streamRef.current?.stop();
        }
      } catch {
        // Recorder may already be released during unmount.
      }
    },
    [],
  );

  async function ensurePermission() {
    const current = await getRecordingPermissionsAsync();
    const permission =
      current.status === PermissionStatus.GRANTED || !current.canAskAgain
        ? current
        : await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError("Microphone access is blocked. Enable it in Settings.");
      showMicSettingsPrompt();
      return false;
    }
    return true;
  }

  async function start() {
    setError(null);
    clearAutoStop();
    try {
      if (!(await ensurePermission())) return;

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
      setDraft(null);
      setDurationMs(0);

      if (Platform.OS === "web") {
        await webRecorder.prepareToRecordAsync();
        webRecorder.record();
      } else {
        pcmChunksRef.current = [];
        pcmMetaRef.current = {
          sampleRate: PCM_SAMPLE_RATE,
          channels: PCM_CHANNELS,
        };
        const stream = streamRef.current;
        if (!stream) throw new Error("Voice recording is unavailable.");
        await stream.start();
      }

      startedAtRef.current = Date.now();
      recordingRef.current = true;
      setRecording(true);
      // Stop at the backend limit so the upload never fails on duration.
      autoStopRef.current = setTimeout(() => {
        void stop();
      }, MAX_VOICE_NOTE_MS);
    } catch {
      clearAutoStop();
      startedAtRef.current = null;
      recordingRef.current = false;
      setRecording(false);
      setError("Could not start recording on this device.");
    }
  }

  async function stop() {
    if (!recordingRef.current) return;
    clearAutoStop();
    setError(null);
    const elapsed = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    try {
      let uri: string | null = null;
      if (Platform.OS === "web") {
        await webRecorderRef.current.stop();
        uri = webRecorderRef.current.uri;
      } else {
        streamRef.current?.stop();
        if (pcmChunksRef.current.length === 0) {
          throw new Error("No audio was captured.");
        }
        const wav = encodeWav(pcmChunksRef.current, pcmMetaRef.current);
        const file = new File(Paths.document, `voice-note-${Date.now()}.wav`);
        if (file.exists) file.delete();
        file.create();
        file.write(wav);
        uri = file.uri;
      }

      if (uri) {
        setDraft({
          uri,
          durationMs: Math.max(1000, Math.min(elapsed, MAX_VOICE_NOTE_MS)),
        });
      } else {
        setError("The recording could not be saved. Please try again.");
      }
    } catch {
      setError("Could not finish the recording. Please try again.");
    } finally {
      pcmChunksRef.current = [];
      startedAtRef.current = null;
      recordingRef.current = false;
      setRecording(false);
    }
  }

  function clear() {
    if (draft && Platform.OS !== "web" && !draft.uri.startsWith("blob:")) {
      try {
        new File(draft.uri).delete();
      } catch {
        // Temporary recording cleanup is best effort.
      }
    }
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
