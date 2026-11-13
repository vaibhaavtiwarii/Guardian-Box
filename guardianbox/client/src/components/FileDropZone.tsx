import { useState, useRef, useCallback } from 'react';

interface FileDropZoneProps {
  onFileSelected: (file: File) => void;
  selectedFile: File | null;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function FileDropZone({ onFileSelected, selectedFile }: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (file.size > MAX_FILE_SIZE) {
        setError(`File too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`);
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative w-full min-h-[200px] rounded-xl border-2 border-dashed
          flex flex-col items-center justify-center gap-4 p-8 cursor-pointer
          transition-all duration-300 ease-out
          ${
            isDragOver
              ? 'border-[var(--gb-accent)] bg-[var(--gb-accent)]/5 shadow-[0_0_30px_rgba(34,211,238,0.15)]'
              : selectedFile
                ? 'border-[var(--gb-success)]/50 bg-[var(--gb-surface)]'
                : 'border-[var(--gb-border)] bg-[var(--gb-surface)] hover:border-[var(--gb-primary)]/50 hover:bg-[var(--gb-surface-hover)]'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleInputChange}
          className="hidden"
        />

        {selectedFile ? (
          <>
            {/* File icon */}
            <div className="w-14 h-14 rounded-xl bg-[var(--gb-success)]/10 flex items-center justify-center">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M9 15l2 2 4-4" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-[var(--gb-text)] font-medium truncate max-w-xs">
                {selectedFile.name}
              </p>
              <p className="text-[var(--gb-text-muted)] text-sm mt-1">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <p className="text-xs text-[var(--gb-text-muted)]">
              Click or drop to change file
            </p>
          </>
        ) : (
          <>
            {/* Upload cloud icon */}
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
                isDragOver ? 'bg-[var(--gb-accent)]/10' : 'bg-[var(--gb-primary)]/10'
              }`}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-colors duration-300 ${
                  isDragOver ? 'stroke-[var(--gb-accent)]' : 'stroke-[var(--gb-primary)]'
                }`}
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-[var(--gb-text)] font-medium">
                Drop your file here or{' '}
                <span className="text-[var(--gb-primary)] underline underline-offset-2">
                  click to browse
                </span>
              </p>
              <p className="text-[var(--gb-text-muted)] text-sm mt-1">
                Maximum file size: {formatFileSize(MAX_FILE_SIZE)}
              </p>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-[var(--gb-danger)]">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
