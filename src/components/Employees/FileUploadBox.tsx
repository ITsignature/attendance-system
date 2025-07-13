import React, { useRef, useState } from "react";

interface FileUploadBoxProps {
  id: string;
  label: string;
  onFileChange: (file: File) => void;
}

const FileUploadBox: React.FC<FileUploadBoxProps> = ({ id, label, onFileChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleBoxClick = () => inputRef.current?.click();

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      onFileChange(e.dataTransfer.files[0]);
    }
  };

  return (
    <div>
      <p className="mb-2 font-medium">{label}</p>
      <div
        className={`border border-dashed border-purple-500 rounded-lg p-6 text-center text-sm text-gray-500 transition-colors ${
          dragOver ? "bg-purple-50" : ""
        }`}
        onClick={handleBoxClick}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleFileDrop}
      >
        <div className="flex justify-center mb-2">
          <div className="h-10 w-10 flex items-center justify-center rounded-full bg-purple-100 text-purple-600 text-lg">
            ⬆️
          </div>
        </div>
        <span>
          Drag & Drop or{" "}
          <span className="text-purple-600 underline cursor-pointer">choose file</span>{" "}
          to upload
        </span>
        <p className="text-xs mt-1 text-gray-400">Supported formats: Jpeg, pdf</p>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept=".jpg,.jpeg,.pdf"
          onChange={(e) => e.target.files && onFileChange(e.target.files[0])}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default FileUploadBox;
