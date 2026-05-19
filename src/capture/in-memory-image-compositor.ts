import type { CaptureImage } from "../types/capture.js";
import type { CaptureRenderManifest, RawScreenCapture } from "./types.js";

export class InMemoryImageCompositor {
  compose(source: RawScreenCapture, manifest: CaptureRenderManifest): CaptureImage {
    const renderedPayload = Buffer.from(
      JSON.stringify({
        kind: "phase5-composited-capture",
        source,
        manifest
      })
    );

    return {
      mimeType: "image/png",
      bytesBase64: renderedPayload.toString("base64"),
      width: manifest.crop.width,
      height: manifest.crop.height,
      byteLength: renderedPayload.byteLength,
      sourceWidth: source.width,
      sourceHeight: source.height,
      backend: `${source.backend}+in-memory-compositor`,
      persisted: false
    };
  }
}
