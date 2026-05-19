import type { RawScreenCapture, ScreenCaptureProviderRequest } from "./types.js";

export interface ScreenCaptureProvider {
  capture(request: ScreenCaptureProviderRequest): Promise<RawScreenCapture>;
}
