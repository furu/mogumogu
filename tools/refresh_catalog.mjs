// Builds data/catalog.json from the YouTube RSS feed of each curated channel.
// RSS needs no API key and returns each channel's 15 most recent uploads.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { channels, keywords, animalKeywords } = JSON.parse(await readFile(join(root, "channels.json"), "utf8"));

const FEED = (id) => `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;

function decode(s) {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function parseEntries(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, entry]) => {
    const pick = (tag) => decode(entry.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1]?.trim() ?? "");
    return {
      videoId: pick("yt:videoId"),
      title: pick("title"),
      published: pick("published"),
      vertical: /#shorts|＃shorts/i.test(pick("title")),
      views: Number(entry.match(/<media:statistics views="(\d+)"/)?.[1] ?? 0),
    };
  });
}

const hasAny = (title, list) => {
  const lower = title.toLowerCase();
  return list.some((k) => lower.includes(k.toLowerCase()));
};

// Channels flagged `mixed` also post non-pet content, so their titles must name
// the animal as well as the meal.
const keepVideo = (title, channel) =>
  hasAny(title, keywords) && (!channel.mixed || hasAny(title, animalKeywords));

const results = await Promise.all(
  channels.map(async (channel) => {
    try {
      const res = await fetch(FEED(channel.id), { headers: { "user-agent": "mogumogu-channel/1.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const entries = parseEntries(await res.text())
        .filter((e) => e.videoId && keepVideo(e.title, channel))
        .map((e) => ({ ...e, channel: channel.name, channelId: channel.id, kind: channel.kind }));
      console.log(`${channel.name}: ${entries.length} clips`);
      return entries;
    } catch (err) {
      console.warn(`${channel.name}: skipped (${err.message})`);
      return [];
    }
  })
);

// Feeds only expose the 15 newest uploads, so the catalog accumulates across runs.
let previous = [];
try {
  previous = JSON.parse(await readFile(join(root, "data", "catalog.json"), "utf8")).clips ?? [];
} catch {
  previous = [];
}

const byId = new Map(previous.map((c) => [c.videoId, c]));
for (const clip of results.flat()) byId.set(clip.videoId, clip);
const clips = [...byId.values()].sort((a, b) => b.published.localeCompare(a.published));

await mkdir(join(root, "data"), { recursive: true });
await writeFile(
  join(root, "data", "catalog.json"),
  JSON.stringify({ updatedAt: new Date().toISOString(), clips }, null, 2)
);
console.log(`total ${clips.length} clips (${clips.length - previous.length} new)`);
