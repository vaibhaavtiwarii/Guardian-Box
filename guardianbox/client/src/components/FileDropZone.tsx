import { useState, useCallback } from 'react';
import { IconFile, IconUpload } from './icons';
import { formatFileSize } from '../utils/format';

interface FileDropZoneProps {
  onFileSelected: (file: File) => void;
  selectedFile: File | null;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export default function FileDropZone({ onFileSelected, selectedFile }: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (file.size > MAX_FILE_SIZE) {
        setError(`That file is ${formatFileSize(file.size)}. The limit is ${formatFileSize(MAX_FILE_SIZE)}.`);
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer items-center gap-4 rounded-xl border border-dashed px-5 py-7 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus sm:py-9 ${
          isDragOver
            ? 'border-paper bg-raised'
            : selectedFile
              ? 'border-steel/60 bg-ink/40 hover:bg-ink/70'
              : 'border-line bg-ink/40 hover:border-steel hover:bg-ink/70'
        }`}
      >
        <input
          type="file"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
        <span
          className={`flex size-12 shrink-0 items-center justify-center rounded-lg ${
            selectedFile ? 'bg-paper text-ink' : 'bg-raised text-paper'
          }`}
        >
          {selectedFile ? <IconFile /> : <IconUpload />}
        </span>
        <span className="min-w-0">
          {selectedFile ? (
            <>
              <span className="block truncate font-medium">{selectedFile.name}</span>
              <span className="block text-sm text-steel">
                {formatFileSize(selectedFile.size)}. Click or drop to choose a different file.
              </span>
            </>
          ) : (
            <>
              <span className="block font-medium">
                Drop a file here, or <span className="underline underline-offset-4">browse</span>
              </span>
              <span className="block text-sm text-steel">
                Any file type, up to {formatFileSize(MAX_FILE_SIZE)}.
              </span>
            </>
          )}
        </span>
      </label>

      <p role="alert" className={error ? 'mt-3 flex items-start gap-2 text-sm text-alert' : 'sr-only'}>
        {error}
      </p>
    </div>
  );
}
