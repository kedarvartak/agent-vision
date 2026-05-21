export type PngDimensions = {
  width: number;
  height: number;
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const readPngDimensions = (buffer: Buffer): PngDimensions => {
  if (buffer.byteLength < 24) {
    throw new Error("PNG buffer is too small to contain dimensions");
  }

  if (!buffer.subarray(0, PNG_SIGNATURE.byteLength).equals(PNG_SIGNATURE)) {
    throw new Error("Expected PNG signature in screenshot payload");
  }

  if (buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("Expected IHDR chunk in screenshot payload");
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
};
