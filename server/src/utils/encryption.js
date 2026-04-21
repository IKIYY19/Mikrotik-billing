/**
 * Simple Encryption Utility
 * Encrypts API keys before storing in database
 */

const crypto = require('crypto');
const { generateSecret, isDefaultSecret } = require('./security');
const isProductionEnv = process.env.NODE_ENV === 'production';

// ENCRYPTION_KEY must be set via environment variable - no fallback for security
let ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  if (isProductionEnv || process.env.NODE_ENV === 'test') {
    throw new Error('ENCRYPTION_KEY environment variable is required in production and test environments');
  }

  ENCRYPTION_KEY = generateSecret(32).slice(0, 32);
  process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
  console.warn('ENCRYPTION_KEY not set; generated an ephemeral key for non-production runtime');
}

if (isProductionEnv && isDefaultSecret(ENCRYPTION_KEY)) {
  throw new Error('ENCRYPTION_KEY cannot use a default or placeholder value in production');
}

if (ENCRYPTION_KEY.length < 32) {
  const message = 'ENCRYPTION_KEY must be at least 32 characters';
  if (isProductionEnv) {
    throw new Error(message);
  }
  console.warn(`${message}; using weak key only because NODE_ENV is not production`);
}

// Ensure key is exactly 32 bytes
function getKey() {
  const key = ENCRYPTION_KEY.padEnd(32).slice(0, 32);
  return Buffer.from(key, 'utf8');
}

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Encrypt text
 */
function encrypt(text) {
  if (!text) return null;
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
}

/**
 * Decrypt text
 */
function decrypt(encryptedText) {
  if (!encryptedText) return null;
  
  try {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

/**
 * Encrypt all values in an object
 */
function encryptObject(obj) {
  if (!obj) return {};
  
  const encrypted = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'string' && value.length > 0) {
      encrypted[key] = encrypt(value);
    } else {
      encrypted[key] = value;
    }
  }
  return encrypted;
}

/**
 * Decrypt all values in an object
 */
function decryptObject(obj) {
  if (!obj) return {};
  
  const decrypted = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'string' && value.includes(':')) {
      decrypted[key] = decrypt(value);
    } else {
      decrypted[key] = value;
    }
  }
  return decrypted;
}

module.exports = {
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,
};
