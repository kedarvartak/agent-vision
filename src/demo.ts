import { VisualContextServer } from "./server.js";

const run = async (): Promise<void> => {
  const server = new VisualContextServer();
  server.start();

  const session = await server.callTool("startCaptureSession", { command: "see" });
  console.log("started", JSON.stringify(session, null, 2));

  if (!session || typeof session !== "object" || !("id" in session) || typeof session.id !== "string") {
    throw new Error("Unexpected session response");
  }

  const completed = await server.callTool("completeMockCaptureSession", { sessionId: session.id });
  console.log("completed", JSON.stringify(completed, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
