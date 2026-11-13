export interface FileUploadResponse {
  id: string;
  expiresAt: string | null;
  maxDownloads: number | null;
}

export interface FileInfo {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  expiresAt: string | null;
  maxDownloads: number | null;
  downloadCount: number;
  createdAt: string;
}

export interface EncryptedPayload {
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
}
