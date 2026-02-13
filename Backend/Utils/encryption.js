import crypto from "crypto";

// Encryption configuration
const ALGORITHM = "aes-256-cbc";
const ENCRYPTION_KEY = process.env.SALARY_ENCRYPTION_KEY || "default-32-char-encryption-key!!"; // Must be 32 characters
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Encrypt sensitive data
 * @param {string|number} text - Data to encrypt
 * @returns {string} - Encrypted data in format: iv:encryptedData
 */
export const encrypt = (text) => {
  if (text === null || text === undefined || text === "") return text;
  
  try {
    // Convert to string if it's a number
    const textStr = String(text);
    
    // Create a random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Ensure key is exactly 32 bytes
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32));
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt the data
    let encrypted = cipher.update(textStr, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    // Return iv and encrypted data separated by ':'
    return iv.toString("hex") + ":" + encrypted;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
};

/**
 * Decrypt sensitive data
 * @param {string} text - Encrypted data in format: iv:encryptedData
 * @returns {string} - Decrypted data
 */
export const decrypt = (text) => {
  if (text === null || text === undefined || text === "") return text;
  
  try {
    // Check if data is already encrypted (contains ':' separator)
    if (!text.includes(":")) {
      // Data is not encrypted, return as is (for backward compatibility)
      return text;
    }
    
    // Split iv and encrypted data
    const parts = text.split(":");
    if (parts.length !== 2) {
      throw new Error("Invalid encrypted data format");
    }
    
    const iv = Buffer.from(parts[0], "hex");
    const encryptedData = parts[1];
    
    // Ensure key is exactly 32 bytes
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32));
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    // Decrypt the data
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    // Return original value if decryption fails (for backward compatibility)
    return text;
  }
};

/**
 * Encrypt numeric values
 * @param {number} value - Number to encrypt
 * @returns {string} - Encrypted value
 */
export const encryptNumber = (value) => {
  if (value === null || value === undefined) return value;
  return encrypt(String(value));
};

/**
 * Decrypt numeric values
 * @param {string} encryptedValue - Encrypted number
 * @returns {number} - Decrypted number
 */
export const decryptNumber = (encryptedValue) => {
  if (encryptedValue === null || encryptedValue === undefined) return encryptedValue;
  const decrypted = decrypt(encryptedValue);
  return decrypted ? Number(decrypted) : null;
};
