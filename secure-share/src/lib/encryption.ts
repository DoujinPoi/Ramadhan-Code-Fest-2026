/**
 * Client-Side Encryption Utilities (Zero-Knowledge)
 * 
 * Uses Web Crypto API with AES-256-GCM for encryption
 * The encryption key NEVER leaves the client - it's stored in the URL fragment (#)
 * which is never sent to the server.
 */

// Generate a random encryption key
export async function generateKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

// Export key to raw bytes (for URL fragment)
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return bufferToBase64(exported);
}

// Import key from raw bytes (from URL fragment)
export async function importKey(keyBase64: string): Promise<CryptoKey> {
  const keyBytes = base64ToBuffer(keyBase64);
  return await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Generate a random IV (Initialization Vector)
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for AES-GCM
}

// Generate a random salt
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

// Convert ArrayBuffer to Base64
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to ArrayBuffer
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Progress callback type
export type ProgressCallback = (progress: number, stage: string) => void;

// Encrypt file data with progress reporting
export async function encryptFile(
  file: File,
  key: CryptoKey,
  onProgress?: ProgressCallback
): Promise<{
  encryptedData: string;
  iv: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}> {
  // Report initial progress
  onProgress?.(0, 'Reading file...');
  
  // Read file as ArrayBuffer
  const fileBuffer = await file.arrayBuffer();
  
  // Report reading complete
  onProgress?.(30, 'Generating encryption key...');
  
  // Generate IV
  const iv = generateIV();
  
  // Report ready for encryption
  onProgress?.(50, 'Encrypting data...');
  
  // Encrypt
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    fileBuffer
  );
  
  // Report encryption complete
  onProgress?.(90, 'Encoding encrypted data...');
  
  const result = {
    encryptedData: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv),
    fileName: file.name,
    fileType: file.type || 'application/octet-stream',
    fileSize: file.size,
  };
  
  // Report completion
  onProgress?.(100, 'Encryption complete');
  
  return result;
}

// Decrypt file data
export async function decryptFile(
  encryptedData: string,
  iv: string,
  key: CryptoKey
): Promise<ArrayBuffer> {
  const encryptedBuffer = base64ToBuffer(encryptedData);
  const ivBuffer = base64ToBuffer(iv);
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    encryptedBuffer
  );
  
  return decryptedBuffer;
}

// Download decrypted file
// XSS Prevention: Always force download instead of browser render
// This prevents malicious HTML/JS files from executing in the browser
export function downloadFile(
  data: ArrayBuffer,
  fileName: string,
  fileType: string
): void {
  // List of potentially dangerous MIME types that could execute code
  const dangerousTypes = [
    'text/html',
    'application/xhtml+xml',
    'text/xml',
    'application/xml',
    'image/svg+xml',
    'application/pdf',
  ];
  
  // For dangerous types, use a generic binary type to prevent browser rendering
  // The browser will still download the file with correct filename
  const safeFileType = dangerousTypes.some(type => 
    fileType.toLowerCase().includes(type.toLowerCase())
  ) 
    ? 'application/octet-stream' 
    : fileType;
  
  // Create blob with safe MIME type
  const blob = new Blob([data], { type: safeFileType });
  const url = URL.createObjectURL(blob);
  
  // Create download link with security attributes
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName; // Forces download instead of render
  a.rel = 'noopener noreferrer'; // Security: prevents reverse tabnabbing
  a.style.display = 'none'; // Hidden from view
  
  // Append, click, and immediately remove
  document.body.appendChild(a);
  a.click();
  
  // Use setTimeout to ensure download starts before revoking URL
  // Some browsers need a moment to initiate the download
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Max file size (50MB)
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Validate file size
export function validateFileSize(file: File): boolean {
  return file.size <= MAX_FILE_SIZE;
}

// Generate shareable URL with key in fragment
export function generateShareUrl(fileId: string, keyBase64: string): string {
  if (typeof window === 'undefined') {
    return `/download/${fileId}#${keyBase64}`;
  }
  const baseUrl = window.location.origin;
  return `${baseUrl}/download/${fileId}#${keyBase64}`;
}

// Extract key from URL fragment
export function extractKeyFromUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const hash = window.location.hash.slice(1); // Remove #
  return hash || null;
}
