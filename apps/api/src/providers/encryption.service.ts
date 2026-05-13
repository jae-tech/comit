import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM 표준 96-bit

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const hexKey = this.config.get<string>('ENCRYPTION_KEY');
    if (!hexKey || hexKey.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)');
    }
    this.key = Buffer.from(hexKey, 'hex');
  }

  encrypt(plaintext: string): { encryptedKey: string; iv: string } {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // encrypted + authTag를 함께 저장
    const combined = Buffer.concat([encrypted, authTag]);

    return {
      encryptedKey: combined.toString('base64'),
      iv: iv.toString('base64'),
    };
  }

  decrypt(encryptedKey: string, iv: string): string {
    const combined = Buffer.from(encryptedKey, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');

    // 마지막 16바이트가 authTag
    const authTag = combined.subarray(combined.length - 16);
    const encrypted = combined.subarray(0, combined.length - 16);

    const decipher = createDecipheriv(ALGORITHM, this.key, ivBuffer);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
