export async function uploadEncryptedFile(
  encryptedBlob: Blob,
  iv: string,
  salt: string,
  originalName: string,
  mimeType: string,
  options?: { expiresIn?: number; maxDownloads?: number }
): Promise<{ id: string; expiresAt: string | null; maxDownloads: number | null }> {
  const formData = new FormData();
  formData.append('file', encryptedBlob, originalName);
  formData.append('iv', iv);
  formData.append('salt', salt);
  formData.append('originalName', originalName);
  formData.append('mimeType', mimeType);
  if (options?.expiresIn) formData.append('expiresIn', String(options.expiresIn));
  if (options?.maxDownloads) formData.append('maxDownloads', String(options.maxDownloads));
  
  const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
  if (res.status === 413) throw new Error('File is too large for the server upload limit.');
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  return res.json();
}

export async function downloadEncryptedFile(id: string): Promise<{
  blob: Blob;
  iv: string;
  salt: string;
  originalName: string;
  mimeType: string;
}> {
  const res = await fetch(`/api/files/${id}`);
  if (res.status === 410) throw new Error('This file has expired or reached its download limit.');
  if (res.status === 404) throw new Error('File not found.');
  if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);
  
  const blob = await res.blob();
  return {
    blob,
    iv: res.headers.get('X-File-IV') || '',
    salt: res.headers.get('X-File-Salt') || '',
    originalName: decodeURIComponent(res.headers.get('X-Original-Name') || 'download'),
    mimeType: decodeURIComponent(res.headers.get('X-Mime-Type') || 'application/octet-stream')
  };
}

export async function getFileInfo(id: string) {
  const res = await fetch(`/api/files/${id}/info`);
  if (res.status === 410) throw new Error('This file has expired.');
  if (res.status === 404) throw new Error('File not found.');
  if (!res.ok) throw new Error(`Failed to get file info: ${res.statusText}`);
  return res.json();
}
