import WebSocket, { type RawData } from "ws";

import type { LiveBrowserTab } from "./tab-model.js";

const CDP_COMMAND_TIMEOUT_MS = 10_000;

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

export class CdpWebSocketSession {
  private nextCommandId = 1;

  constructor(private readonly socket: WebSocket) {}

  async sendCommand(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs = CDP_COMMAND_TIMEOUT_MS
  ): Promise<Record<string, unknown>> {
    const id = this.nextCommandId++;

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
          this.socket.off("message", onMessage);
          this.socket.off("error", onError);
          this.socket.off("close", onClose);
        };

        this.socket.on("message", onMessage);
        this.socket.on("error", onError);
        this.socket.on("close", onClose);
        this.socket.send(JSON.stringify({ id, method, params }));
      }),
      timeoutMs,
      `Timed out waiting for CDP response to ${method}`
    );
  }
}

export const withCdpTabSession = async <T>(
  tab: LiveBrowserTab,
  run: (session: CdpWebSocketSession) => Promise<T>
): Promise<T> => {
  if (!tab.webSocketDebuggerUrl) {
    throw new Error(`Live browser tab ${tab.targetId} is missing webSocketDebuggerUrl`);
  }

  const socket = new WebSocket(tab.webSocketDebuggerUrl);

  try {
    await withTimeout(waitForOpen(socket), CDP_COMMAND_TIMEOUT_MS, "Timed out opening CDP tab websocket");
    return await run(new CdpWebSocketSession(socket));
  } finally {
    socket.close();
  }
};
