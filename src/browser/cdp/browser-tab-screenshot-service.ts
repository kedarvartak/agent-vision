import WebSocket, { type RawData } from "ws";

import type { Logger } from "../../logging/logger.js";
import type { BrowserTabScreenshot } from "./types.js";
import { BrowserTabResolutionService } from "./browser-tab-resolution-service.js";
import { readPngDimensions } from "./png-metadata.js";
import type { LiveBrowserTab } from "./tab-model.js";
import type { LiveBrowserTabResolution } from "./tab-resolution.js";

const SCREENSHOT_TIMEOUT_MS = 10_000;

type CdpCommandSuccess = {
  id: number;
  result?: Record<string, unknown>;
};

type CdpCommandFailure = {
  id: number;
  error?: {
    message?: string;
  };
};

type CdpResponse = CdpCommandSuccess | CdpCommandFailure;

export type CaptureResolvedLiveBrowserTabScreenshotResult =
  | {
      status: "completed";
      query?: string;
      resolution: Extract<LiveBrowserTabResolution, { status: "resolved" }>;
      screenshot: BrowserTabScreenshot;
    }
  | Extract<LiveBrowserTabResolution, { status: "ambiguous" | "not_found" }>;

const nowIso = (): string => new Date().toISOString();

const waitForOpen = (socket: WebSocket): Promise<void> =>
  new Promise((resolve, reject) => {
    if (socket.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    const onOpen = () => {
      cleanup();
      resolve();
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      socket.off("open", onOpen);
      socket.off("error", onError);
    };

    socket.on("open", onOpen);
    socket.on("error", onError);
  });

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const sendCommand = async (
  socket: WebSocket,
  id: number,
  method: string,
  params?: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  return await withTimeout(
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const onMessage = (raw: RawData) => {
        try {
          const parsed = JSON.parse(raw.toString()) as CdpResponse & { method?: string };
          if (parsed.id !== id) {
            return;
          }

          cleanup();

          if ("error" in parsed && parsed.error) {
            reject(new Error(parsed.error.message ?? `CDP command failed: ${method}`));
            return;
          }

          resolve(parsed.result ?? {});
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const onClose = () => {
        cleanup();
        reject(new Error(`CDP socket closed before ${method} completed`));
      };

      const cleanup = () => {
        socket.off("message", onMessage);
        socket.off("error", onError);
        socket.off("close", onClose);
      };

      socket.on("message", onMessage);
      socket.on("error", onError);
      socket.on("close", onClose);
      socket.send(JSON.stringify({ id, method, params }));
    }),
    SCREENSHOT_TIMEOUT_MS,
    `Timed out waiting for CDP response to ${method}`
  );
};

const captureTabScreenshot = async (tab: LiveBrowserTab): Promise<BrowserTabScreenshot> => {
  if (!tab.webSocketDebuggerUrl) {
    throw new Error(`Live browser tab ${tab.targetId} is missing webSocketDebuggerUrl`);
  }

  const socket = new WebSocket(tab.webSocketDebuggerUrl);

  try {
    await withTimeout(waitForOpen(socket), SCREENSHOT_TIMEOUT_MS, "Timed out opening CDP tab websocket");

    await sendCommand(socket, 1, "Page.enable");
    const captureResult = await sendCommand(socket, 2, "Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true
    });

    const data = captureResult.data;
    if (typeof data !== "string" || data.trim() === "") {
      throw new Error("CDP screenshot response did not include PNG data");
    }

    const buffer = Buffer.from(data, "base64");
    const dimensions = readPngDimensions(buffer);

    return {
      targetId: tab.targetId,
      title: tab.title,
      url: tab.url,
      browserName: tab.browserName,
      mimeType: "image/png",
      bytesBase64: data,
      width: dimensions.width,
      height: dimensions.height,
      byteLength: buffer.byteLength,
      capturedAt: nowIso(),
      backend: "cdp-page-capture"
    };
  } finally {
    socket.close();
  }
};

export class BrowserTabScreenshotService {
  constructor(
    private readonly resolver: BrowserTabResolutionService,
    private readonly logger: Logger
  ) {}

  async captureResolved(query?: string): Promise<CaptureResolvedLiveBrowserTabScreenshotResult> {
    const resolution = this.resolver.resolve(query);
    if (resolution.status !== "resolved") {
      return resolution;
    }

    const screenshot = await captureTabScreenshot(resolution.tab);
    this.logger.info("Captured browser tab screenshot via CDP", {
      query,
      targetId: resolution.tab.targetId,
      title: resolution.tab.title,
      width: screenshot.width,
      height: screenshot.height,
      byteLength: screenshot.byteLength
    });

    return {
      status: "completed",
      query,
      resolution,
      screenshot
    };
  }
}
