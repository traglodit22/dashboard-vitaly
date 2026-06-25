import { createHash } from 'crypto'
import bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 12

function legacySha256(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

function isLegacySha256Hash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false
  if (storedHash.startsWith('$2')) {
    return bcrypt.compare(password, storedHash)
  }
  if (isLegacySha256Hash(storedHash)) {
    return legacySha256(password) === storedHash
  }
  return false
}
