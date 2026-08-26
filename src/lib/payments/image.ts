export type ReceiptImage = {
  mime: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
  width: number;
  height: number;
};

const MAX_DIMENSION = 8192;
const MAX_PIXELS = 25_000_000;

function validDimensions(width: number, height: number) {
  return width > 0 && height > 0 && width <= MAX_DIMENSION && height <= MAX_DIMENSION
    && width * height <= MAX_PIXELS;
}

function png(buffer: Buffer): ReceiptImage | null {
  if (buffer.length < 45 || !buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return null;
  if (buffer.readUInt32BE(8) !== 13 || buffer.toString("ascii", 12, 16) !== "IHDR") return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  let offset = 8;
  let hasData = false;
  let hasEnd = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) return null;
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") hasData = true;
    if (type === "IEND") {
      if (length !== 0 || end !== buffer.length) return null;
      hasEnd = true;
      break;
    }
    offset = end;
  }
  return hasData && hasEnd && validDimensions(width, height)
    ? { mime: "image/png", extension: "png", width, height }
    : null;
}

function webp(buffer: Buffer): ReceiptImage | null {
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF"
      || buffer.toString("ascii", 8, 12) !== "WEBP" || buffer.readUInt32LE(4) + 8 !== buffer.length) return null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (end > buffer.length) return null;
    let width = 0;
    let height = 0;
    if (type === "VP8X" && length >= 10) {
      width = 1 + buffer.readUIntLE(start + 4, 3);
      height = 1 + buffer.readUIntLE(start + 7, 3);
    } else if (type === "VP8L" && length >= 5 && buffer[start] === 0x2f) {
      const bits = buffer.readUInt32LE(start + 1);
      width = 1 + (bits & 0x3fff);
      height = 1 + ((bits >>> 14) & 0x3fff);
    } else if (type === "VP8 " && length >= 10
        && buffer[start + 3] === 0x9d && buffer[start + 4] === 0x01 && buffer[start + 5] === 0x2a) {
      width = buffer.readUInt16LE(start + 6) & 0x3fff;
      height = buffer.readUInt16LE(start + 8) & 0x3fff;
    }
    if (width || height) {
      return validDimensions(width, height)
        ? { mime: "image/webp", extension: "webp", width, height }
        : null;
    }
    offset = end + (length % 2);
  }
  return null;
}

function jpeg(buffer: Buffer): ReceiptImage | null {
  if (buffer.length < 12 || buffer[0] !== 0xff || buffer[1] !== 0xd8
      || buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) return null;
  let offset = 2;
  let width = 0;
  let height = 0;
  let hasScan = false;
  while (offset + 1 < buffer.length - 2) {
    if (buffer[offset] !== 0xff) return null;
    while (buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++];
    if (marker === 0xda) {
      hasScan = true;
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) return null;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 8) return null;
      height = buffer.readUInt16BE(offset + 3);
      width = buffer.readUInt16BE(offset + 5);
    }
    offset += length;
  }
  return hasScan && validDimensions(width, height)
    ? { mime: "image/jpeg", extension: "jpg", width, height }
    : null;
}

export function inspectReceiptImage(buffer: Buffer): ReceiptImage | null {
  return png(buffer) ?? webp(buffer) ?? jpeg(buffer);
}
