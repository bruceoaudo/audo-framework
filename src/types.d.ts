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

export interface Routes {
  post: Map<string, (req: audoRequest, res: http.ServerResponse) => void>;
  get: Map<string, (req: audoRequest, res: http.ServerResponse) => void>;
  put: Map<string, (req: audoRequest, res: http.ServerResponse) => void>;
  update: Map<string, (req: audoRequest, res: http.ServerResponse) => void>;
  delete: Map<string, (req: audoRequest, res: http.ServerResponse) => void>;
}