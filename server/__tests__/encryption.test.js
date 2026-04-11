/**
 * Encryption Utility Tests
 */

describe('Encryption Utility', () => {
  let encryption;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long!!';
    jest.resetModules();
    encryption = require('../src/utils/encryption');
  });

  describe('encrypt/decrypt', () => {
    test('should encrypt and decrypt text correctly', () => {
      const originalText = 'secret-api-key-12345';
      
      const encrypted = encryption.encrypt(originalText);
      const decrypted = encryption.decrypt(encrypted);
      
      expect(decrypted).toBe(originalText);
    });

    test('should return null for empty input', () => {
      expect(encryption.encrypt('')).toBeNull();
      expect(encryption.decrypt('')).toBeNull();
    });

    test('should return null for null input', () => {
      expect(encryption.encrypt(null)).toBeNull();
      expect(encryption.decrypt(null)).toBeNull();
    });

    test('should produce different ciphertext for same plaintext', () => {
      const text = 'same-text';
      
      const encrypted1 = encryption.encrypt(text);
      const encrypted2 = encryption.encrypt(text);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    test('should include IV in ciphertext', () => {
      const encrypted = encryption.encrypt('test-text');
      
      // Format should be iv:ciphertext
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toHaveLength(32); // 16 bytes IV in hex = 32 chars
    });
  });

  describe('encryptObject/decryptObject', () => {
    test('should encrypt all string values in object', () => {
      const obj = {
        apiKey: 'secret-key',
        apiSecret: 'secret-value',
        count: 42,
      };
      
      const encrypted = encryption.encryptObject(obj);
      
      expect(encrypted.apiKey).not.toBe('secret-key');
      expect(encrypted.apiSecret).not.toBe('secret-value');
      expect(encrypted.count).toBe(42);
    });

    test('should decrypt all encrypted values in object', () => {
      const obj = {
        apiKey: encryption.encrypt('secret-key'),
        apiSecret: encryption.encrypt('secret-value'),
        count: 42,
      };
      
      const decrypted = encryption.decryptObject(obj);
      
      expect(decrypted.apiKey).toBe('secret-key');
      expect(decrypted.apiSecret).toBe('secret-value');
      expect(decrypted.count).toBe(42);
    });

    test('should handle empty object', () => {
      expect(encryption.encryptObject({})).toEqual({});
      expect(encryption.decryptObject({})).toEqual({});
    });

    test('should handle null/undefined', () => {
      expect(encryption.encryptObject(null)).toEqual({});
      expect(encryption.decryptObject(null)).toEqual({});
    });
  });

  describe('security', () => {
    test('should fail if ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY;
      
      // Mock process.exit to prevent actual exit
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((n) => n);
      
      expect(() => {
        jest.resetModules();
        require('../src/utils/encryption');
      }).toThrow();
      
      mockExit.mockRestore();
    });
  });
});
