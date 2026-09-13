#!/usr/bin/env node
// Ridgeline Operational Picture API server.
//
//     node src/server.ts --port 8080

import { createApp, BASE_PATH, DEFAULT_HOST, DEFAULT_PORT } from "./app.ts";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const host = readArg("--host") ?? process.env.HOST ?? DEFAULT_HOST;
const port = Number(readArg("--port") ?? process.env.PORT ?? DEFAULT_PORT);

const server = createApp();

server.listen(port, host, () => {
  console.log(`ridgeline api on http://${host}:${port}${BASE_PATH}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log("\nstopping");
    server.close(() => process.exit(0));
  });
}
