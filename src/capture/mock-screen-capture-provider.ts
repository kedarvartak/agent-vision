import type { ScreenCaptureProvider } from "./screen-capture-provider.js";
import type { RawScreenCapture, ScreenCaptureProviderRequest } from "./types.js";

export class MockScreenCaptureProvider implements ScreenCaptureProvider {
  async capture(request: ScreenCaptureProviderRequest): Promise<RawScreenCapture> {
    const descriptor = {
      kind: "phase5-mock-screen-capture",
      sessionId: request.sessionId,
      command: request.command,
      displayId: request.displayId ?? "display-1",
      activeAppName: request.activeAppName ?? "Prototype App",
      activeWindowTitle: request.activeWindowTitle ?? "Prototype Window",
      generatedAt: new Date().toISOString()
    };

    return {
      mimeType: "image/png",
      bytesBase64: Buffer.from(JSON.stringify(descriptor)).toString("base64"),
      width: 1920,
      height: 1080,
      capturedAt: new Date().toISOString(),
      displayId: request.displayId ?? "display-1",
      backend: "mock-screen-provider"
    };
  }
}
