import fs from "node:fs";
import path from "node:path";
import type { SpeakingMediaName } from "./types/speaking/speakingCreate.types";

const COMMITTED_DIR = path.resolve(process.cwd(), "fixtures/media");
const GENERATED_DIR = path.resolve(process.cwd(), "test-results/.media");

/**
 * MPEG-1 Layer III, 32 kbps, 32 kHz, mono, no CRC: one frame is
 * 144 × bitrate / sample rate = 144 bytes and plays 1152 samples (36 ms).
 */
const MP3_FRAME_HEADER = [0xff, 0xfb, 0x18, 0xc0];
const MP3_FRAME_BYTES = 144;
const MP3_FRAME_MS = 36;

/** The MP3 clips, by length in seconds. */
const MP3_SECONDS: Partial<Record<SpeakingMediaName, number>> = {
  "speaking-short.mp3": 5,
  "speaking-short-2.mp3": 4,
  "speaking-lecture.mp3": 60,
  "speaking-discussion.mp3": 180,
};

/**
 * A constant-bitrate MP3 of silence, `seconds` long.
 *
 * Every frame is a valid header followed by zeroed side information and main
 * data, which decoders play as silence. With no Xing header, players and the
 * server's duration probe both read the length as size ÷ bitrate, so it is
 * exact. Built here because hook [2e] caps committed files at 50 KB and the
 * lecture and discussion clips are far longer than that allows.
 */
export function silentMp3(seconds: number): Buffer {
  const frames = Math.ceil((seconds * 1000) / MP3_FRAME_MS);
  const frame = Buffer.alloc(MP3_FRAME_BYTES);
  Buffer.from(MP3_FRAME_HEADER).copy(frame);

  return Buffer.concat(Array.from({ length: frames }, () => frame));
}

/**
 * The path of a media fixture.
 *
 * MP3s are generated on first use into `test-results/` (written to a
 * per-process temp name and renamed, so parallel workers never read half a
 * file). Everything else is small enough to commit, in `fixtures/media/`; see
 * `fixtures/media/README.md` for how those were produced.
 */
export function mediaFile(name: SpeakingMediaName): string {
  const seconds = MP3_SECONDS[name];

  if (seconds === undefined) {
    const committed = path.join(COMMITTED_DIR, name);
    if (!fs.existsSync(committed)) {
      throw new Error(`Media fixture not found: ${committed}`);
    }
    return committed;
  }

  const target = path.join(GENERATED_DIR, name);

  if (!fs.existsSync(target)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
    const temp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temp, silentMp3(seconds));
    fs.renameSync(temp, target);
  }

  return target;
}

/** A file payload Playwright can hand to an `<input type=file>` without a disk file. */
export interface InMemoryFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * A small stand-in for a file whose upload a spec stubs — the "too large"
 * cases. The stub decides the reply, so the bytes never matter.
 */
export function placeholderFile(name: string, mimeType: string): InMemoryFile {
  return { name, mimeType, buffer: Buffer.from(`placeholder for ${name}`) };
}
