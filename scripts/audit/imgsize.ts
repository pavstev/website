const pngSignature = 0x89_50_4e_47;
const skippedMarkers = new Set([0xc4, 0xc8, 0xcc]);

const jpegSize = (buffer: Buffer): [number, number] | undefined => {
  let index = 2;
  while (index + 9 < buffer.length) {
    const marker = buffer[index + 1] ?? 0;
    if (marker === 0xff || buffer[index] !== 0xff) {
      index += 1;
      continue;
    }
    if (marker >= 0xc0 && marker <= 0xcf && !skippedMarkers.has(marker))
      return [buffer.readUInt16BE(index + 7), buffer.readUInt16BE(index + 5)];
    index += 2 + buffer.readUInt16BE(index + 2);
  }
  return undefined;
};

export const imageSize = (buffer: Buffer): [number, number] | undefined => {
  if (
    buffer.length > 24 &&
    buffer.readUInt32BE(0) === pngSignature &&
    buffer.toString("latin1", 12, 16) === "IHDR"
  )
    return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
  return buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8
    ? jpegSize(buffer)
    : undefined;
};
