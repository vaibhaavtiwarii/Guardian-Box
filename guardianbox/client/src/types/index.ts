export interface FileUploadResponse {
  id: string;
  expiresAt: string | null;
  maxDownloads: number | null;
}

export interface FileInfo {
  id: string;
  originalName: string;
  mimeType: string;
  /** Total encrypted bytes stored on the server. */
  size: number;
  chunkCount: number;
  expiresAt: string | null;
  maxDownloads: number | null;
  downloadCount: number;
  createdAt: string;
}
