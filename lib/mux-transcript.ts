// lib/mux-transcript.ts
import { db } from "@/lib/db";

// Minimal: list asset tracks from Mux Video API using basic auth (token:secret).
// Then download transcript via https://stream.mux.com/{PLAYBACK_ID}/text/{TRACK_ID}.txt
// Mux docs: you can also replace .txt with .vtt for WebVTT. :contentReference[oaicite:1]{index=1}

type MuxTrack = {
  id: string;
  type?: string; // often "text"
  status?: string; // "ready"
  text_type?: string; // "subtitles"
  name?: string;
  language_code?: string;
};

function muxAuthHeader() {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret)
    throw new Error("Missing MUX_TOKEN_ID / MUX_TOKEN_SECRET");
  const basic = Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64");
  return `Basic ${basic}`;
}

export async function getMuxTranscriptText({
  assetId,
  playbackId,
}: {
  assetId: string;
  playbackId: string;
}): Promise<string | null> {
  // 1) List tracks for the asset
  const tracksRes = await fetch(
    `https://api.mux.com/video/v1/assets/${assetId}/tracks`,
    {
      headers: { Authorization: muxAuthHeader() },
    },
  );

  if (!tracksRes.ok) return null;
  const tracksJson = await tracksRes.json();

  const tracks: MuxTrack[] = tracksJson?.data ?? [];

  // Prefer ready, auto-generated subtitles track (common case)
  const best = tracks.find((t) => t.status === "ready") ?? tracks[0];
  if (!best?.id) return null;

  // 2) Download transcript .txt
  // Mux docs show this URL shape and mention .txt -> .vtt swap. :contentReference[oaicite:2]{index=2}
  const transcriptUrl = `https://stream.mux.com/${playbackId}/text/${best.id}.txt`;

  const transcriptRes = await fetch(transcriptUrl);
  if (!transcriptRes.ok) return null;

  const text = await transcriptRes.text();
  // Keep it bounded; transcripts can be huge
  return text.slice(0, 50_000);
}
