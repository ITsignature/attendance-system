import React, { useRef, useState } from "react";
import { HiCloudUpload, HiDocumentText, HiX } from 'react-icons/hi';
import { Spinner } from 'flowbite-react';

interface FileUploadBoxProps {
  id: string;
  label: string;
  onFileChange: (file: File | null) => void;
  loading?: boolean;
}

const FileUploadBox: React.FC<FileUploadBoxProps> = ({ id, label, onFileChange, loading = false }) => {
  const [dragActive, setDragActive] = useState(false);  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

   const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      onFileChange(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      onFileChange(file);
    }
  };
  
  const removeFile = () => {
    setSelectedFile(null);
    onFileChange(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleBoxClick = () => {
    if (!loading && inputRef.current) {
      inputRef.current.click();
    }
  };

  return (
    <div className="w-full">
      <p className="mb-2 font-medium">{label}</p>

    <div
  className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
    ${dragActive ? 'border-blue-400 bg-blue-50' : 'border-purple-500 hover:border-purple-400'}
    ${loading ? 'opacity-50 pointer-events-none' : ''}`}
  onDragEnter={handleDrag}
  onDragLeave={handleDrag}
  onDragOver={handleDrag}
  onDrop={handleDrop}
>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
            <Spinner size="sm" />
            <span className="ml-2 text-sm text-gray-600">Uploading...</span>
          </div>
        )}

 <input
  ref={inputRef}
  id={id} 
  type="file"
  className={`${selectedFile ? "hidden" : "absolute inset-0 w-full h-full opacity-0 cursor-pointer"}`}
  onChange={handleFileChange}
  accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
  disabled={loading}
/>


        {selectedFile ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <HiDocumentText className="w-8 h-8 text-green-500 mr-3" />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeFile();
              }}
              className="text-red-500 hover:text-red-700 transition-colors"
              disabled={loading}
            >
              <HiX className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div>
            <div className="flex justify-center mb-2">
              <div className="h-10 w-10 flex items-center justify-center rounded-full bg-purple-100 text-purple-600">
                <HiCloudUpload className="w-6 h-6" />
              </div>
            </div>

        <span className="text-sm text-gray-500">
              Drag & Drop or{" "}
              <span className="text-purple-600 underline cursor-pointer font-medium">
                choose file
              </span>{" "}
              to upload
        </span>

        <p className="text-xs mt-2 text-gray-400">
              Supported formats: JPG, PNG, PDF, DOC, DOCX up to 10MB
            </p>
            </div>
        )}
      </div>
    </div>
  );
  
};

export default FileUploadBox;
