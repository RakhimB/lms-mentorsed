// lib/mux-transcript.ts
import { db } from "@/lib/db";

// Minimal: list asset tracks from Mux Video API using basic auth (token:secret).
// Then download transcript via https://stream.mux.com/{PLAYBACK_ID}/text/{TRACK_ID}.txt
// Mux docs: you can also replace .txt with .vtt for WebVTT. :contentReference[oaicite:1]{index=1}

type MuxTrack = {
  id: string;
  type?: string;          // "text"
  status?: string;        // "ready"
  text_source?: string;   // "generated_vod" (this is what we want)
  language_code?: string; // "en", "tr", ...
  name?: string;
};

function muxAuthHeader() {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    throw new Error("Missing MUX_TOKEN_ID / MUX_TOKEN_SECRET");
  }
  const basic = Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64");
  return `Basic ${basic}`;
}

// 1) Find the generated captions track id (generated_vod) that is ready
export async function getGeneratedVodTextTrackId(opts: {
  assetId: string;
  preferredLanguage?: string; // e.g. "en", "tr"
}): Promise<string | null> {
  const { assetId, preferredLanguage } = opts;

  const res = await fetch(`https://api.mux.com/video/v1/assets/${assetId}/tracks`, {
    headers: { Authorization: muxAuthHeader() },
  });

  if (!res.ok) return null;

  const json = await res.json();
  const tracks: MuxTrack[] = json?.data ?? [];

  const candidates = tracks.filter(
    (t) => t.type === "text" && t.text_source === "generated_vod" && t.status === "ready"
  );

  if (!candidates.length) return null;

  if (preferredLanguage) {
    const exact = candidates.find(
      (t) => (t.language_code || "").toLowerCase() === preferredLanguage.toLowerCase()
    );
    if (exact?.id) return exact.id;
  }

  return candidates[0]?.id ?? null;
}

// 2) Fetch transcript using playbackId + trackId (Mux transcript URL shape)
export async function getMuxTranscriptText(opts: {
  playbackId: string;
  trackId: string;
  token?: string; // for signed playback (optional)
}): Promise<string | null> {
  const { playbackId, trackId, token } = opts;

  const url =
    `https://stream.mux.com/${playbackId}/text/${trackId}.txt` +
    (token ? `?token=${encodeURIComponent(token)}` : "");

  const res = await fetch(url);
  if (!res.ok) return null;

  const text = await res.text();
  // Keep bounded. (helps if transcript is huge)
  return text.slice(0, 50_000);
}
