import type { CaptureSession } from "./types/session.js";
import { VisualContextServer } from "./server.js";

const sleep = async (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

const ensureSession = (value: unknown): CaptureSession => {
  if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string") {
    throw new Error("Unexpected session response");
  }

  return value as CaptureSession;
};

const run = async (): Promise<void> => {
  const server = new VisualContextServer();
  server.start();

  const session = ensureSession(await server.callTool("startCaptureSession", { command: "see" }));
  console.log("started", JSON.stringify(session, null, 2));

  const awaiting = server.callTool("awaitCaptureSession", {
    sessionId: session.id,
    timeoutMs: 5_000
  });

  await sleep(50);
  const completed = await server.callTool("completeMockCaptureSession", { sessionId: session.id });
  console.log("completed", JSON.stringify(completed, null, 2));

  const awaited = await awaiting;
  console.log("awaited", JSON.stringify(awaited, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
