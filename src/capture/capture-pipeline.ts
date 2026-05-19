import type { CaptureBundle } from "../types/capture.js";
import type { CapturePipelineInput } from "./types.js";

export interface CapturePipeline {
  createBundle(input: CapturePipelineInput): Promise<CaptureBundle>;
}
