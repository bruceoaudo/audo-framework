//========================================//
// Required imports
//=======================================//
import * as http from "node:http";
import cluster from "node:cluster";
import { cpus } from "node:os";
import { RateLimiter } from "./rateLimiter";
import { Router } from "./routes";
import { audoRequest } from "./global";

//========================================//
// Interfaces
//========================================//

export interface Options {
  // Performance options
  keepAlive?: boolean;
  keepAliveTimeout?: number;
  maxConnections?: number;
  timeout?: number;
  useCluster?: boolean;

  // Security options
  maxHeadersCount?: number;
  rateLimit?: {
    windowMs: number;
    max: number;
    message?: string;
    statusCode?: number;
  };
  disablePoweredBy?: boolean;
  strictTransportSecurity?: boolean | string;
  contentSecurityPolicy?: string;
  xssProtection?: boolean | string;
  frameOptions?: string;
  contentTypeOptions?: boolean;
}

//========================================//
// Main Server Class
//========================================//
export class audo extends Router {
  private server!: http.Server;
  private rateLimiter?: RateLimiter;
  private cleanupCallbacks: Array<() => Promise<void>> = [];

  constructor(hostname: string, port: number, options: Options = {}) {
    // Call  Router class
    super();
    // Set default options
    const defaultOptions: Options = {
      keepAlive: true,
      keepAliveTimeout: 5000,
      maxConnections: Infinity,
      timeout: 5000,
      useCluster: false,
      maxHeadersCount: 2000,
      disablePoweredBy: true,
      strictTransportSecurity: true,
      xssProtection: true,
      frameOptions: "DENY",
      contentTypeOptions: true,
      ...options,
    };

    // Initialize rate limiter if enabled
    if (defaultOptions.rateLimit) {
      this.rateLimiter = new RateLimiter({
        windowMs: defaultOptions.rateLimit.windowMs,
        max: defaultOptions.rateLimit.max,
        message: defaultOptions.rateLimit.message,
        statusCode: defaultOptions.rateLimit.statusCode,
      });
      this.registerCleanup(() => {
        this.rateLimiter?.destroy();
        return Promise.resolve();
      });
    }

    // Cluster mode implementation
    if (defaultOptions.useCluster && cluster.isPrimary) {
      this.setupCluster();
      return;
    }

    // Create HTTP server
    this.server = http.createServer();
    this.configureServer(defaultOptions, hostname, port);
    this.setupRequestHandling(defaultOptions);
    this.setupErrorHandlers();
  }

  private setupCluster(): void {
    const numCPUs = cpus().length;
    console.log(`Primary ${process.pid} is running`);

    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} died`);
      cluster.fork(); // Restart the worker
    });
  }

  private configureServer(
    options: Options,
    hostname: string,
    port: number
  ): void {
    // Performance settings
    this.server.keepAliveTimeout = options.keepAliveTimeout!;
    this.server.headersTimeout = options.keepAliveTimeout! + 1000;
    this.server.maxConnections = options.maxConnections!;
    this.server.maxHeadersCount = options.maxHeadersCount!;
    this.server.setTimeout(options.timeout!, (socket) => {
      socket.end(); // Forcefully close the connection
    });

    // Start listening
    this.server.listen(port, hostname, () => {
      console.log(
        `HTTP Server ${cluster.isPrimary ? "Primary" : "Worker"} ${
          process.pid
        } started on ${hostname}:${port}`
      );
    });
  }

  private setupRequestHandling(options: Options): void {
    this.server.on(
      "request",
      (req: http.IncomingMessage, res: http.ServerResponse) => {
        // Apply rate limiting if enabled
        if (this.rateLimiter && !this.checkRateLimit(req, res)) {
          return;
        }

        // Apply security headers
        this.applySecurityHeaders(res, options);

        let body = "";

        req.on("data", (chunk) => {
          body += chunk;
        });

        req.on("end", () => {
          const method = (req.method || "GET").toUpperCase();
          const url = new URL(req.url || "/", `http://${req.headers.host}`);
          const path = url.pathname;

          // Cast and enrich IncomingMessage
          const enrichedReq = req as audoRequest;

          // Parse query string
          const query: Record<string, string | string[]> = {};
          for (const [key, value] of url.searchParams.entries()) {
            if (query[key]) {
              if (Array.isArray(query[key])) {
                (query[key] as string[]).push(value);
              } else {
                query[key] = [query[key] as string, value];
              }
            } else {
              query[key] = value;
            }
          }
          enrichedReq.query = query;

          // Only parse body if content-type is JSON
          const contentType = req.headers["content-type"] || "";
          if (contentType.includes("application/json")) {
            try {
              enrichedReq.body = JSON.parse(body || "{}");
            } catch {
              enrichedReq.body = {};
            }
          } else {
            enrichedReq.body = {};
          }

          // Handle routes
          const methodRoutes =
            this.routes[method.toLowerCase() as keyof typeof this.routes];
          const { handler, params } = matchRoute(path, methodRoutes);
          enrichedReq.params = params;

          if (handler) {
            handler(enrichedReq, res);
          } else {
            res.writeHead(404, "URL Endpoint not found");
            res.end();
          }
        });
      }
    );
  }

  private checkRateLimit(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): boolean {
    if (!this.rateLimiter) return true;

    const ip = req.socket.remoteAddress || "unknown";
    const limitCheck = this.rateLimiter.check(ip);

    if (!limitCheck.allowed) {
      res.writeHead(this.rateLimiter["statusCode"], {
        "Content-Type": "text/plain",
      });
      res.end(this.rateLimiter["message"]);
      return false;
    }

    // Add rate limit headers
    res.setHeader("X-RateLimit-Limit", this.rateLimiter["max"]);
    res.setHeader("X-RateLimit-Remaining", limitCheck.remaining);
    res.setHeader(
      "X-RateLimit-Reset",
      Math.floor(
        (this.rateLimiter["store"].get(ip)?.resetTime || Date.now()) / 1000
      )
    );

    return true;
  }

  private applySecurityHeaders(
    res: http.ServerResponse,
    options: Options
  ): void {
    // Remove X-Powered-By header
    if (options.disablePoweredBy) {
      res.removeHeader("X-Powered-By");
    }

    // Strict Transport Security
    if (options.strictTransportSecurity) {
      const hstsValue =
        typeof options.strictTransportSecurity === "string"
          ? options.strictTransportSecurity
          : "max-age=31536000; includeSubDomains";
      res.setHeader("Strict-Transport-Security", hstsValue);
    }

    // Content Security Policy
    if (options.contentSecurityPolicy) {
      res.setHeader("Content-Security-Policy", options.contentSecurityPolicy);
    }

    // XSS Protection
    if (options.xssProtection) {
      const xssValue =
        typeof options.xssProtection === "string"
          ? options.xssProtection
          : "1; mode=block";
      res.setHeader("X-XSS-Protection", xssValue);
    }

    // Frame Options
    if (options.frameOptions) {
      res.setHeader("X-Frame-Options", options.frameOptions);
    }

    // Content Type Options
    if (options.contentTypeOptions) {
      res.setHeader("X-Content-Type-Options", "nosniff");
    }
  }

  private setupErrorHandlers(): void {
    // Client errors
    this.server.on("clientError", (error, socket) => {
      console.error("Client error:", error);
      if (socket.writable) {
        socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
      }
    });

    // Uncaught exceptions
    process.on("uncaughtException", async (error) => {
      console.error("Uncaught Exception:", error);
      await this.cleanupResources();
      process.exit(1);
    });

    // Unhandled rejections
    process.on("unhandledRejection", async (reason, promise) => {
      console.error("Unhandled Rejection at:", promise, "reason:", reason);
      await this.cleanupResources();
      process.exit(1);
    });

    // Graceful shutdown
    process.on("SIGTERM", async () => {
      console.log("SIGTERM received. Shutting down gracefully...");
      await this.cleanupResources();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      console.log("SIGINT received. Shutting down gracefully...");
      await this.cleanupResources();
      process.exit(0);
    });
  }

  private registerCleanup(callback: () => Promise<void>): void {
    this.cleanupCallbacks.push(callback);
  }

  private async cleanupResources(): Promise<void> {
    console.log("Cleaning up resources...");

    // Close the server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server.close(() => {
          console.log("HTTP server closed");
          resolve();
        });
      });
    }

    // Execute all registered cleanup callbacks
    await Promise.all(
      this.cleanupCallbacks.map((cb) =>
        cb().catch((e) => {
          console.error("Cleanup error:", e);
        })
      )
    );

    console.log("Cleanup completed");
  }
}

function matchRoute(
  path: string,
  routes: Map<string, Function>
): { handler?: Function; params: Record<string, string> } {
  for (const [pattern, handler] of routes.entries()) {
    const patternParts = pattern.split("/").filter(Boolean);
    const pathParts = path.split("/").filter(Boolean);

    if (patternParts.length !== pathParts.length) continue;

    const params: Record<string, string> = {};
    let matched = true;

    for (let i = 0; i < patternParts.length; i++) {
      const p = patternParts[i];
      const actual = pathParts[i];

      if (p.startsWith(":")) {
        params[p.slice(1)] = decodeURIComponent(actual);
      } else if (p !== actual) {
        matched = false;
        break;
      }
    }

    if (matched) return { handler, params };
  }

  return { handler: undefined, params: {} };
}
