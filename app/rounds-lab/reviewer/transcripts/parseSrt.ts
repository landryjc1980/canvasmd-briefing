export type ParsedSrtSegment = {
  startMs: number;
  endMs: number;
  text: string;
};

function parseTimecode(value: string): number {
  const match = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid SRT timecode: ${value}`);
  }
  const [, hours, minutes, seconds, milliseconds] = match;
  return (
    Number(hours) * 3_600_000
    + Number(minutes) * 60_000
    + Number(seconds) * 1_000
    + Number(milliseconds)
  );
}

/** Parses SRT without adding or correcting any transcript words. */
export function parseSrt(raw: string, sourceLabel = "local SRT"): ParsedSrtSegment[] {
  const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    throw new Error(`${sourceLabel} is empty.`);
  }

  return normalized.split(/\n{2,}/).map((block, index) => {
    const lines = block.split("\n");
    const sequence = Number(lines.shift());
    const timing = lines.shift();
    const timingMatch = /^(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/.exec(timing ?? "");
    const text = lines.join(" ").replace(/\s+/g, " ").trim();

    if (!Number.isInteger(sequence) || sequence !== index + 1) {
      throw new Error(
        `${sourceLabel} has unexpected sequence ${String(sequence)} at block ${index + 1}.`,
      );
    }
    if (!timingMatch || !text) {
      throw new Error(`${sourceLabel} has an incomplete block at sequence ${sequence}.`);
    }

    const startMs = parseTimecode(timingMatch[1]);
    const endMs = parseTimecode(timingMatch[2]);
    if (endMs <= startMs) {
      throw new Error(`${sourceLabel} has invalid timing at sequence ${sequence}.`);
    }

    return { startMs, endMs, text };
  });
}
