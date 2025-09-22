import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isUploading: boolean;
}

export function FileUploadZone({ onFilesSelected, isUploading }: FileUploadZoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      onFilesSelected(acceptedFiles);
    },
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    disabled: isUploading,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
        ${isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300'}
        ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5'}`}
    >
      <input {...getInputProps()} />
      <Upload className="mx-auto h-12 w-12 text-gray-400" />
      <p className="mt-2 text-sm text-gray-600">
        {isDragActive
          ? "Drop the files here..."
          : isUploading
          ? "Uploading..."
          : "Drag 'n' drop files here, or click to select files"}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        Supported files: PDF, TXT, DOC, DOCX
      </p>
    </div>
  );
} 