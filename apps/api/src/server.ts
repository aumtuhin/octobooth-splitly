import app from "./app.js";

const preferredPort = Number(process.env.PORT ?? 4000);

function startServer(port: number, retries = 10) {
  const server = app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
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
