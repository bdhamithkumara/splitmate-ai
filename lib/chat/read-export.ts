// Read an uploaded WhatsApp export (.txt, or the .zip WhatsApp creates) as
// text. Browser-only.
import { unzipSync } from "fflate";

export const MAX_EXPORT_BYTES = 30 * 1024 * 1024;

export async function readChatExport(file: File): Promise<string> {
  if (file.size > MAX_EXPORT_BYTES) {
    throw new Error("That file is too large (max 30 MB).");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK"

  if (!isZip) return new TextDecoder("utf-8").decode(bytes);

  // Only decompress .txt entries; skip photos/voice notes in the zip.
  const entries = unzipSync(bytes, {
    filter: (entry) => entry.name.toLowerCase().endsWith(".txt"),
  });
  const names = Object.keys(entries);
  const chatName =
    names.find((n) => /(^|\/)_chat\.txt$/i.test(n)) ??
    names.find((n) => /whatsapp chat/i.test(n)) ??
    names[0];

  if (!chatName) {
    throw new Error("No chat .txt file found in that zip.");
  }

  return new TextDecoder("utf-8").decode(entries[chatName]);
}
