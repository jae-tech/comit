import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

const VALID_KEY = 'a'.repeat(64); // 32바이트 hex (64 hex chars)

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: { get: () => VALID_KEY },
        },
      ],
    }).compile();

    service = module.get(EncryptionService);
  });

  describe('encrypt / decrypt 라운드트립', () => {
    it('평문을 암호화 후 복호화하면 원래 값과 같아야 한다', () => {
      const plaintext = 'sk-test-api-key-1234567890';
      const { encryptedKey, iv } = service.encrypt(plaintext);
      expect(service.decrypt(encryptedKey, iv)).toBe(plaintext);
    });

    it('같은 평문을 두 번 암호화하면 서로 다른 ciphertext가 나와야 한다 (IV 랜덤)', () => {
      const plaintext = 'my-secret-key';
      const first = service.encrypt(plaintext);
      const second = service.encrypt(plaintext);
      expect(first.encryptedKey).not.toBe(second.encryptedKey);
      expect(first.iv).not.toBe(second.iv);
    });

    it('빈 문자열도 암호화/복호화 가능해야 한다', () => {
      const { encryptedKey, iv } = service.encrypt('');
      expect(service.decrypt(encryptedKey, iv)).toBe('');
    });

    it('한국어 포함 유니코드 문자열도 정확히 복호화해야 한다', () => {
      const plaintext = '테스트-api-키-🔑';
      const { encryptedKey, iv } = service.encrypt(plaintext);
      expect(service.decrypt(encryptedKey, iv)).toBe(plaintext);
    });
  });

  describe('authTag 무결성 검사', () => {
    it('암호문을 1바이트 변조하면 decrypt()가 throw해야 한다', () => {
      const { encryptedKey, iv } = service.encrypt('secret');
      const tampered = Buffer.from(encryptedKey, 'base64');
      tampered[0] ^= 0xff; // 첫 바이트 반전
      expect(() => service.decrypt(tampered.toString('base64'), iv)).toThrow();
    });

    it('IV를 다른 것으로 바꾸면 decrypt()가 throw해야 한다', () => {
      const { encryptedKey } = service.encrypt('secret');
      const wrongIv = Buffer.alloc(12, 0).toString('base64'); // zero IV
      expect(() => service.decrypt(encryptedKey, wrongIv)).toThrow();
    });
  });

  describe('초기화 검증', () => {
    it('ENCRYPTION_KEY가 64자 미만이면 서비스 생성 시 에러가 나야 한다', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            EncryptionService,
            {
              provide: ConfigService,
              useValue: { get: () => 'tooshort' },
            },
          ],
        }).compile(),
      ).rejects.toThrow('ENCRYPTION_KEY must be a 32-byte hex string');
    });

    it('ENCRYPTION_KEY가 없으면 서비스 생성 시 에러가 나야 한다', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            EncryptionService,
            {
              provide: ConfigService,
              useValue: { get: () => undefined },
            },
          ],
        }).compile(),
      ).rejects.toThrow('ENCRYPTION_KEY must be a 32-byte hex string');
    });
  });
});
