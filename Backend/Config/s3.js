/**
 * AWS S3 Configuration
 * Handles S3 client setup and file operations
 */

import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";

// Ensure environment variables are loaded
dotenv.config();

// S3 Bucket configuration (using the same variable names as your .env)
export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "ots-edtech";
export const S3_REGION = process.env.S3_REGION || "ap-south-1";

// S3 Client Configuration
const s3Client = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Get the public URL for an S3 object
 */
export const getS3Url = (key) => {
  return `https://${S3_BUCKET_NAME}.s3.${S3_REGION}.amazonaws.com/${key}`;
};

/**
 * Delete a file from S3
 */
export const deleteFromS3 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
    });
    await s3Client.send(command);
    console.log(`Deleted from S3: ${key}`);
    return true;
  } catch (error) {
    console.error("Error deleting from S3:", error);
    return false;
  }
};

/**
 * Get a signed URL for private file access (optional, for private buckets)
 */
export const getSignedS3Url = async (key, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
    });
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return null;
  }
};

/**
 * Extract S3 key from full URL
 */
export const getKeyFromUrl = (url) => {
  if (!url) return null;
  const baseUrl = `https://${S3_BUCKET_NAME}.s3.${S3_REGION}.amazonaws.com/`;
  if (url.startsWith(baseUrl)) {
    return url.replace(baseUrl, "");
  }
  // If it's already a key, return as is
  return url;
};

/**
 * Upload base64 data to S3
 * @param {string} base64Data - The base64 data URL (e.g., data:image/jpeg;base64,...)
 * @param {string} folder - The folder to store the file in
 * @param {string} filename - The original filename
 * @returns {Object} - File info with S3 URL, key, filename, mimeType, size
 */
export const uploadBase64ToS3 = async (base64Data, folder, filename) => {
  try {
    // Extract the base64 content and mime type
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error("Invalid base64 data URL format");
    }

    const mimeType = matches[1];
    const base64Content = matches[2];
    const buffer = Buffer.from(base64Content, "base64");

    // Generate unique key
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeName = filename
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .substring(0, 50);
    const key = `OTS Managment/${folder}/${uniqueSuffix}-${safeName}`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });

    await s3Client.send(command);

    return {
      filename: safeName,
      originalName: filename,
      mimeType: mimeType,
      size: buffer.length,
      path: getS3Url(key),
      key: key,
    };
  } catch (error) {
    console.error("Error uploading base64 to S3:", error);
    throw error;
  }
};

export { s3Client };
export default s3Client;
