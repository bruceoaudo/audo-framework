import * as http from "node:http";

// Example usage
// const router = Router()
// router.post("/", (req, res)=>{})

interface Routes {
  post: Map<
    string,
    (req: http.IncomingMessage, res: http.ServerResponse) => void
  >;
  get: Map<
    string,
    (req: http.IncomingMessage, res: http.ServerResponse) => void
  >;
  put: Map<
    string,
    (req: http.IncomingMessage, res: http.ServerResponse) => void
  >;
  update: Map<
    string,
    (req: http.IncomingMessage, res: http.ServerResponse) => void
  >;
  delete: Map<
    string,
    (req: http.IncomingMessage, res: http.ServerResponse) => void
  >;
}

export class Router {
  protected routes: Routes;
  constructor() {
    this.routes = {
      post: new Map(),
      get: new Map(),
      put: new Map(),
      update: new Map(),
      delete: new Map(),
    };
  }

  get(
    path: string,
    callback: (req: http.IncomingMessage, res: http.ServerResponse) => void
  ) {
    this.routes.get.set(path, callback);
  }

  post(
    path: string,
    callback: (req: http.IncomingMessage, res: http.ServerResponse) => void
  ) {
    this.routes.post.set(path, callback);
  }

  put(
    path: string,
    callback: (req: http.IncomingMessage, res: http.ServerResponse) => void
  ) {
    this.routes.put.set(path, callback);
  }

  update(
    path: string,
    callback: (req: http.IncomingMessage, res: http.ServerResponse) => void
  ) {
    this.routes.update.set(path, callback);
  }

  delete(
    path: string,
    callback: (req: http.IncomingMessage, res: http.ServerResponse) => void
  ) {
    this.routes.delete.set(path, callback);
  }
}
