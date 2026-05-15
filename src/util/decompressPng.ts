import { inflate } from 'pako';

function readUint32BE(buf: Uint8Array, offset: number): number {
  return (((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0);
}

function chunkType(buf: Uint8Array, offset: number): string {
  return String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]);
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePngPixels(buf: Uint8Array): Uint8Array {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== sig[i]) throw new Error('Invalid PNG signature');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  let bitDepth = 0;
  const idatChunks: Uint8Array[] = [];

  while (offset < buf.length) {
    const len = readUint32BE(buf, offset);
    offset += 4;
    const type = chunkType(buf, offset);
    offset += 4;

    if (type === 'IHDR') {
      width = readUint32BE(buf, offset);
      height = readUint32BE(buf, offset + 4);
      bitDepth = buf[offset + 8];
      const colorType = buf[offset + 9];
      switch (colorType) {
        case 0: channels = 1; break;
        case 2: channels = 3; break;
        case 3: channels = 1; break;
        case 4: channels = 2; break;
        case 6: channels = 4; break;
        default: throw new Error(`Unsupported PNG color type: ${colorType}`);
      }
    } else if (type === 'IDAT') {
      idatChunks.push(buf.slice(offset, offset + len));
    } else if (type === 'IEND') {
      break;
    }

    offset += len;
    offset += 4; // CRC
  }

  if (width === 0) throw new Error('PNG missing IHDR chunk');
  if (idatChunks.length === 0) throw new Error('PNG missing IDAT chunk');

  const totalLen = idatChunks.reduce((s, c) => s + c.length, 0);
  const compressed = new Uint8Array(totalLen);
  let pos = 0;
  for (const chunk of idatChunks) {
    compressed.set(chunk, pos);
    pos += chunk.length;
  }

  const raw = inflate(compressed);

  const bpp = Math.ceil((channels * bitDepth) / 8);
  const stride = width * bpp;
  const output = new Uint8Array(stride * height);

  for (let y = 0; y < height; y++) {
    const filterType = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;

    switch (filterType) {
      case 0:
        output.set(raw.subarray(src, src + stride), dst);
        break;
      case 1:
        for (let x = 0; x < stride; x++) {
          const a = x >= bpp ? output[dst + x - bpp] : 0;
          output[dst + x] = (raw[src + x] + a) & 0xff;
        }
        break;
      case 2:
        for (let x = 0; x < stride; x++) {
          const b = y > 0 ? output[dst - stride + x] : 0;
          output[dst + x] = (raw[src + x] + b) & 0xff;
        }
        break;
      case 3:
        for (let x = 0; x < stride; x++) {
          const a = x >= bpp ? output[dst + x - bpp] : 0;
          const b = y > 0 ? output[dst - stride + x] : 0;
          output[dst + x] = (raw[src + x] + Math.floor((a + b) / 2)) & 0xff;
        }
        break;
      case 4:
        for (let x = 0; x < stride; x++) {
          const a = x >= bpp ? output[dst + x - bpp] : 0;
          const b = y > 0 ? output[dst - stride + x] : 0;
          const c = x >= bpp && y > 0 ? output[dst - stride + x - bpp] : 0;
          output[dst + x] = (raw[src + x] + paethPredictor(a, b, c)) & 0xff;
        }
        break;
      default:
        throw new Error(`Unsupported PNG filter type: ${filterType}`);
    }
  }

  return output;
}

function utf8Decode(bytes: Uint8Array): string {
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b === 0) break;
    if (b < 0x80) {
      result += String.fromCharCode(b);
      i += 1;
    } else if ((b & 0xe0) === 0xc0) {
      result += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else if ((b & 0xf0) === 0xe0) {
      result += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
      );
      i += 3;
    } else {
      const cp =
        ((b & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f);
      result += String.fromCodePoint(cp);
      i += 4;
    }
  }
  return result;
}

export default async function decompressPng(data: string): Promise<unknown> {
  const buffer = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));

  let pixels: Uint8Array;
  try {
    pixels = decodePngPixels(buffer);
  } catch (error) {
    throw new Error('Error decoding PNG buffer', { cause: error });
  }

  try {
    return JSON.parse(utf8Decode(pixels));
  } catch (error) {
    throw new Error('Error parsing PNG JSON contents', { cause: error });
  }
}
