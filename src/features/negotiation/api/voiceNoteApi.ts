import { cloudinaryUploadFile } from "@/core/api/cloudinary";
import type { VoiceNote } from "@/types/domain";

/** §20 — voice notes are Cloudinary `video`-resource uploads signed as audio. */
export const MAX_VOICE_NOTE_MS = 3 * 60 * 1000;

export async function uploadVoiceNote(voice: VoiceNote, token: string): Promise<string> {
  if (voice.durationMs > MAX_VOICE_NOTE_MS) {
    throw new Error("Voice notes must be 3 minutes or less.");
  }

  const rawName = voice.uri.split(/[?#]/, 1)[0].split("/").pop() ?? "voice-note.m4a";
  const extension = rawName.includes(".") ? rawName.split(".").pop() : "m4a";
  const fileName = `voice-note-${Date.now()}.${extension}`;

  const uploaded = await cloudinaryUploadFile(
    {
      uri: voice.uri,
      fileName,
      mimeType: `audio/${extension === "m4a" ? "mp4" : extension}`,
    },
    "audio",
    token,
  );
  return uploaded.secure_url;
}
