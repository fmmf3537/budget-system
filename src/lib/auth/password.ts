import bcrypt from "bcryptjs"

const SALT_ROUNDS = 10

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, SALT_ROUNDS)
}

export function verifyPassword(
  plain: string,
  hash: string | null | undefined
): boolean {
  if (!hash) return false
  return bcrypt.compareSync(plain, hash)
}
