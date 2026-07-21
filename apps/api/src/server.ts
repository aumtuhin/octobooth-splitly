import app from "./app.js";

const preferredPort = Number(process.env.PORT ?? 4000);
// Bind to all interfaces so the app is reachable behind the Fly proxy.
// Listening on localhost/127.0.0.1 would make the machine unreachable (502).
const host = process.env.HOST ?? "0.0.0.0";

function startServer(port: number, retries = 10) {
  const server = app.listen(port, host, () => {
    console.log(`API listening on http://${host}:${port}`);
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" && retries > 0) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is in use, retrying on ${nextPort}...`);
      startServer(nextPort, retries - 1);
      return;
    }
    throw error;
  });
}

startServer(preferredPort);
