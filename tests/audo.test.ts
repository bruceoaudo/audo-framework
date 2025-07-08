jest.mock("../src/rateLimiter", () => {
  return {
    RateLimiter: jest.fn().mockImplementation(() => ({
      check: jest.fn().mockReturnValue({ allowed: true, remaining: 10 }),
      destroy: jest.fn(),
      store: new Map(),
    })),
  };
});


beforeAll(() => {
  process.env.JWT_SECRET = "test-secret";
});

import { Options } from "../src/types";
import supertest from "supertest";
import http from "http";
import { audo } from "../src";
import { utils } from "../src/utils";

describe("audo server tests", () => {
  let serverInstance: audo;
  let httpServer: http.Server;

  beforeAll((done) => {
    serverInstance = new audo("127.0.0.1", 0, {
      useCluster: false,
    } as Options);

    serverInstance.get("/test", (req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "hello" }));
    });

    serverInstance.post("/echo", (req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ body: req.body }));
    });

    serverInstance.get("/user/:id", (req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ userId: req.params.id }));
    });

    httpServer = (serverInstance as any).server;
    setTimeout(done, 200);
  });

  afterAll((done) => {
    httpServer.close(done);
  });

  it("GET /test should return 200", async () => {
    await supertest(httpServer)
      .get("/test")
      .expect(200)
      .expect("Content-Type", /json/)
      .expect({ message: "hello" });
  });

  it("POST /echo should return echoed body", async () => {
    await supertest(httpServer)
      .post("/echo")
      .send({ name: "Bruce" })
      .set("Content-Type", "application/json")
      .expect(200)
      .expect({ body: { name: "Bruce" } });
  });

  it("GET /not-found should return 404", async () => {
    await supertest(httpServer).get("/not-found").expect(404);
  });

  it("GET /user/:id should return route param", async () => {
    await supertest(httpServer)
      .get("/user/123")
      .expect(200)
      .expect({ userId: "123" });
  });
});

describe("utils class tests", () => {
  const password = "supersecret123";

  it("should hash and verify password correctly", async () => {
    const hash = await utils.encryptPassword(password);
    expect(hash).toMatch(/^\$argon2id\$/);

    const isValid = await utils.verifyPassword(hash, password);
    expect(isValid).toBe(true);
  });

  it("should sign and verify a JWT", () => {
    const payload = { userId: "user-123" };
    const token = utils.signJWT(payload);

    const verified = utils.verifyJWT<{ userId: string; jti: string }>(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe("user-123");
    expect(verified?.jti).toBeDefined();
  });

  it("should return null for invalid JWT", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const invalidToken = "invalid.token.string";
    const result = utils.verifyJWT(invalidToken);
    expect(result).toBeNull();
    spy.mockRestore();
  });
});
