import type { Logger } from "../logging/logger.js";
import type { CaptureBundle } from "../types/capture.js";
import type { CapturePipeline } from "./capture-pipeline.js";
import { InMemoryImageCompositor } from "./in-memory-image-compositor.js";
import type { ScreenCaptureProvider } from "./screen-capture-provider.js";
import type { CapturePipelineInput, CaptureRenderManifest } from "./types.js";

export class InMemoryCapturePipeline implements CapturePipeline {
  constructor(
    private readonly provider: ScreenCaptureProvider,
    private readonly compositor: InMemoryImageCompositor,
    private readonly logger: Logger
  ) {}

  async createBundle(input: CapturePipelineInput): Promise<CaptureBundle> {
    const source = await this.provider.capture({
      sessionId: input.sessionId,
      command: input.command,
      displayId: input.context?.displayId,
      activeAppName: input.context?.activeAppName,
      activeWindowTitle: input.context?.activeWindowTitle
    });

    const manifest: CaptureRenderManifest = {
      sessionId: input.sessionId,
      command: input.command,
      sourceImage: {
        width: source.width,
        height: source.height,
        displayId: source.displayId,
        backend: source.backend
      },
      crop: input.selection,
      annotations: input.annotations,
      context: input.context
    };

    const image = this.compositor.compose(source, manifest);
    this.logger.debug("Created in-memory capture bundle", {
      sessionId: input.sessionId,
      backend: image.backend,
      width: image.width,
      height: image.height,
      annotationCount: input.annotations.length
    });

    return {
      sessionId: input.sessionId,
      command: input.command,
      image,
      selection: input.selection,
      annotations: input.annotations,
      context: {
        ...input.context,
        capturedAt: source.capturedAt,
        displayId: input.context?.displayId ?? source.displayId
      }
    };
  }
}
