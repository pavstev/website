import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { type AddressInfo } from "node:net";
import { afterEach, describe, it } from "node:test";

import { reachable } from "./reachable.ts";

describe("reachable", () => {
  let servers: Server[] = [];

  afterEach(async () => {
    const running = servers;
    servers = [];
    await Promise.all(
      running.map(
        (server) =>
          new Promise<void>((resolve) => {
            server.closeAllConnections();
            server.close(() => {
              resolve();
            });
          })
      )
    );
  });

  const start = async (status: number | undefined): Promise<string> => {
    const server = createServer((_request, response) => {
      if (status === undefined) return;
      response.writeHead(status);
      response.end();
    });
    servers.push(server);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const { port } = server.address() as AddressInfo;
    return `http://127.0.0.1:${String(port)}/`;
  };

  it("finds nothing wrong with a page that answers 200", async () => {
    assert.deepEqual(await reachable(await start(200)), []);
  });
  it("reports the status of a page that answers badly", async () => {
    const url = await start(404);
    assert.deepEqual(await reachable(url), [`${url} answered 404`]);
  });
  it("reports a page that never answers instead of throwing", async () => {
    const url = await start(undefined);
    assert.deepEqual(await reachable(url, 100), [`${url} did not answer`]);
  });
  it("reports a page that cannot be reached instead of throwing", async () => {
    const url = await start(200);
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => {
              resolve();
            });
          })
      )
    );
    assert.deepEqual(await reachable(url), [`${url} did not answer`]);
  });
});
