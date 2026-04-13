/**
 * @fileOverview
 * @author Ramon Wijnands - rayman747@hotmail.com
 */

import type { DecodedPng } from "fast-png";

const textDecoder = new TextDecoder();

// Cache the dynamically imported `decode` function so repeated PNG messages
// don't pay an import()/await overhead each time.
let decodePng: ((buffer: Uint8Array) => DecodedPng) | undefined;

/**
 * If a message was compressed as a PNG image (a compression hack since
 * gzipping over WebSockets is not supported yet), this function decodes
 * the "image" as a Base64 string.
 *
 * `fast-png` is imported dynamically (lazily) rather than statically to avoid
 * a crash in environments such as React Native / Hermes. `fast-png` constructs
 * a `new TextDecoder('latin1')` at module load time, and Hermes does not
 * support the 'latin1' encoding, causing an immediate RangeError on import.
 * By deferring the import until a PNG message is actually received, users
 * who do not use PNG-compressed rosbridge messages are unaffected.
 * See: https://github.com/image-js/fast-png/blob/77a4479d68d84246793f58f7bbf2a2ea3a80c0f5/src/helpers/text.ts#L11
 *
 * @param data - A base64-encoded PNG string containing the compressed JSON data.
 */
export default async function decompressPng(data: string): Promise<unknown> {
  if (!decodePng) {
    try {
      const fastPng = await import("fast-png");
      decodePng = fastPng.decode;
    } catch (error) {
      throw new Error(
        "Failed to load fast-png. This may occur in environments that do not support the 'latin1' encoding (e.g. React Native / Hermes).",
        { cause: error }
      );
    }
  }

  const buffer = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  const decoded = tryDecodeBuffer(decodePng, buffer);

  try {
    return JSON.parse(textDecoder.decode(decoded.data));
  } catch (error) {
    throw new Error("Error parsing PNG JSON contents", { cause: error });
  }
}

function tryDecodeBuffer(
  decode: (buffer: Uint8Array) => DecodedPng,
  buffer: Uint8Array
): DecodedPng {
  try {
    return decode(buffer);
  } catch (error) {
    throw new Error("Error decoding PNG buffer", { cause: error });
  }
}