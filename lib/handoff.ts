import { parseCareShare, type CareShare } from "./sharing";
import type { Log } from "./types";

/**
 * Hand-off links carry a care snapshot after the "#", which browsers never
 * send to any website, so the data goes from phone to phone without a server.
 * Notes are left out. Anyone with the link can read it.
 */
export const HANDOFF_PATH = "/handoff/";
const PREFIX = "c1.";
/** Links up to this length are also offered as a QR code that scans reliably. */
export const QR_MAX_LENGTH = 1100;

type Packed = {
  s: number;
  c: CareShare["child"];
  f: string;
  t: string;
  l: [string, Log["type"], number, number, Log["data"]][];
};

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function fromBase64Url(text: string) {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
async function transform(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** The payload after "#": a versioned, compressed snapshot without notes. */
export async function encodeHandoff(share: CareShare) {
  const packed: Packed = {
    s: share.sharedAt,
    c: share.child,
    f: share.from,
    t: share.to,
    l: share.logs.map((log) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { notes, ...data } = log.data;
      return [log.id, log.type, log.timeGiven, log.timestamp, data];
    }),
  };
  const json = new TextEncoder().encode(JSON.stringify(packed));
  return (
    PREFIX +
    toBase64Url(await transform(json, new CompressionStream("deflate-raw")))
  );
}

export async function decodeHandoff(fragment: string): Promise<CareShare> {
  const text = fragment.replace(/^#/, "");
  if (!text.startsWith(PREFIX))
    throw new Error("This link doesn’t contain a KiddyMeds hand-off.");
  let packed: Packed;
  try {
    const bytes = await transform(
      fromBase64Url(text.slice(PREFIX.length)),
      new DecompressionStream("deflate-raw"),
    );
    if (bytes.length > 5 * 1024 * 1024) throw new Error("too large");
    packed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error(
      "This hand-off link is incomplete or damaged. Ask for a new one.",
    );
  }
  if (!packed || !Array.isArray(packed.l))
    throw new Error(
      "This hand-off link is incomplete or damaged. Ask for a new one.",
    );
  const share = parseCareShare({
    kind: "kiddymeds-care-share",
    version: 1,
    sharedAt: packed.s,
    child: packed.c,
    from: packed.f,
    to: packed.t,
    logs: packed.l.map((entry) => {
      if (!Array.isArray(entry)) throw new Error("bad entry");
      const [id, type, timeGiven, timestamp, data] = entry;
      return {
        id,
        childId: packed.c?.id,
        type,
        timeGiven,
        timestamp,
        data: { ...(data && typeof data === "object" ? data : {}), notes: "" },
      };
    }),
  });
  return { ...share, notesOmitted: true };
}

export function handoffUrl(origin: string, payload: string) {
  return `${origin}${HANDOFF_PATH}#${payload}`;
}
