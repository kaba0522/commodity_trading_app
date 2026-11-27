import { cloudinaryUploadFile } from "@/core/api/cloudinary";
import type { VoiceNote } from "@/types/domain";
import { Platform } from "react-native";

/** §20 — backend accepts voice notes up to 3 minutes. */
export const MAX_VOICE_NOTE_MS = 3 * 60 * 1000;

/**
 * Native recordings are written as 16 kHz mono WAV so Cloudinary's audio
 * signature accepts the real bytes. Web still records WebM, which is also on
 * the audio allow-list. Both keep the sender-scoped audio upload folder.
 */
function voiceFileName(): { fileName: string; mimeType: string } {
  const extension = Platform.OS === "web" ? "webm" : "wav";
  return {
    fileName: `voice-note-${Date.now()}.${extension}`,
    mimeType: extension === "wav" ? "audio/wav" : "audio/webm",
  };
}

/**
 * Web recordings are `blob:` URLs, which `expo-file-system` cannot read.
 * Convert them to a real File so multipart upload works in the browser.
 */
async function webFile(
  uri: string,
  fileName: string,
  mimeType: string,
): Promise<Blob | undefined> {
  if (Platform.OS !== "web") return undefined;
  try {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Recording fetch failed (${response.status})`);
    }
    return new File([await response.blob()], fileName, { type: mimeType });
  } catch {
    throw new Error("Could not prepare the voice note. Please record it again.");
  }
}

/**
 * Cloudinary converts any uploaded video/audio to the format in the delivery
 * URL extension. Return an `.m4a` URL so the backend's audio validator (which
 * rejects `.mp4`) accepts the note and every player receives playable AAC.
 */
function voiceDeliveryUrl(secureUrl: string): string {
  const suffixIndex = secureUrl.search(/[?#]/);
  const base = suffixIndex === -1 ? secureUrl : secureUrl.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : secureUrl.slice(suffixIndex);
  const lastSlash = base.lastIndexOf("/");
  const lastDot = base.lastIndexOf(".");
  const withoutExtension = lastDot > lastSlash ? base.slice(0, lastDot) : base;
  return `${withoutExtension}.m4a${suffix}`;
}

export async function uploadVoiceNote(voice: VoiceNote, token: string): Promise<string> {
  if (voice.durationMs > MAX_VOICE_NOTE_MS) {
    throw new Error("Voice notes must be 3 minutes or less.");
  }

  const { fileName, mimeType } = voiceFileName();
  const file = await webFile(voice.uri, fileName, mimeType);
  // Sign as `audio` so the backend records the upload against this sender.
  // `cloudinaryUploadFile` still posts to /video/upload, where Cloudinary
  // stores all audio assets.
  const uploaded = await cloudinaryUploadFile(
    {
      uri: voice.uri,
      fileName,
      mimeType,
      ...(file ? { file } : {}),
    },
    "audio",
    token,
  );
  return voiceDeliveryUrl(uploaded.secure_url);
}
