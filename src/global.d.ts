import * as http from "node:http";

export interface audoRequest extends http.IncomingMessage {
  body: any;
  query: Record<string, string | string[]>;
  params: Record<string, string>;
}

export function isAudoRequest(req: http.IncomingMessage): req is audoRequest {
  return true; // It's safe because we cast it below and we control the logic
}
