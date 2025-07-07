import argon2 from "argon2";

export class utils {
  // Hash a plain password
  static async encryptPassword(plainPassword: string): Promise<string> {
    return await argon2.hash(plainPassword);
  }

  // Verify a password against the stored hash
  static async verifyPassword(
    hashedPassword: string,
    plainPassword: string
  ): Promise<boolean> {
    return await argon2.verify(hashedPassword, plainPassword);
  }
}
