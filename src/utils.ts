import argon2, { Options as ArgonOptions, argon2id } from "argon2";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

//===============================//
// JWT Constants
//===============================//

// WARNING: NEVER hard-code secrets in production!
// Use environment variables (e.g., process.env.JWT_SECRET)
const JWT_SECRET = process.env.JWT_SECRET || "a-very-strong-secret";

// Used to validate the token issuer and recipient
const JWT_ISSUER = "audo-lib";
const JWT_AUDIENCE = "audo-users";
const TOKEN_EXPIRATION = "1h"; // Options: "15m", "1h", "2d", etc.

export class utils {
  //===============================//
  // Argon2 Password Hashing Options
  //===============================//

  // Use argon2id for best protection (resistant to side-channel and GPU attacks)
  // ──────────────────────────────────────────────────────────────
  // Security Recommendations:
  // - For stronger protection:    timeCost: 6, memoryCost: 2**17 (128MB), parallelism: 2
  // - For better performance:     timeCost: 2, memoryCost: 2**14 (16MB), parallelism: 1
  // Choose based on your threat model and server capacity.
  // ──────────────────────────────────────────────────────────────
  private static readonly hashOptions: ArgonOptions & { raw?: false } = {
    type: argon2id, // Use argon2id for hybrid protection
    timeCost: 4, // Number of iterations (higher = stronger but slower)
    memoryCost: 2 ** 16, // 64 MB of RAM
    parallelism: 2, // Threads used for hashing
  };

  /**
   * Hash a plain password using Argon2id
   * @param plainPassword - The raw password to hash
   * @returns a secure hashed password string
   */
  static async encryptPassword(plainPassword: string): Promise<string> {
    return await argon2.hash(plainPassword, this.hashOptions);
  }

  /**
   * Verify a plain password against a hashed value
   * @param hashedPassword - Stored hash
   * @param plainPassword - Plain password input from user
   * @returns true if valid, false if not
   */
  static async verifyPassword(
    hashedPassword: string,
    plainPassword: string
  ): Promise<boolean> {
    return await argon2.verify(hashedPassword, plainPassword);
  }

  //===============================//
  // JWT Signing
  //===============================//

  /**
   * Sign and generate a JWT token
   * Includes:
   * - jti (JWT ID): unique identifier for each token (helps with blacklisting)
   * - iat (Issued At): when the token was created
   * - exp (Expiration): when the token expires (default: 1h)
   * - aud (Audience): who the token is meant for
   * - iss (Issuer): who created the token
   *
   * @param payload - Object to encode into the JWT
   * @param options - Optional overrides for jwt.sign
   * @returns signed JWT token string
   */
  static signJWT(payload: object, options?: Partial<jwt.SignOptions>): string {
    const jti = randomUUID(); // Globally unique token ID
    const now = Math.floor(Date.now() / 1000); // Issued at (iat)

    return jwt.sign(
      {
        ...payload,
        jti,
        iat: now,
      },
      JWT_SECRET,
      {
        algorithm: "HS256", // Use strong symmetric algorithm
        expiresIn: TOKEN_EXPIRATION,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        ...options, // Allow custom settings (e.g., different exp)
      }
    );
  }

  //===============================//
  // JWT Verification
  //===============================//

  /**
   * Verify a JWT token and decode its payload.
   * Will return `null` if the token is invalid, expired, or forged.
   * Always handle null checks when calling this method.
   *
   * @param token - The JWT token to verify
   * @returns payload if valid, null otherwise
   */
  static verifyJWT<T = any>(token: string): T | null {
    try {
      const payload = jwt.verify(token, JWT_SECRET, {
        algorithms: ["HS256"], // Enforce algorithm match
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as T;

      return payload;
    } catch (error) {
      console.error("Invalid token:", error);
      return null;
    }
  }
}
