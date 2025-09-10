import React, { useCallback, useState } from 'react';
import { Upload, Image, X } from 'lucide-react';

interface ImageUploadProps {
  onUpload: (imageData: string) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onUpload }) => {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreview(result);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    } else {
      // Generate mock preview if no file selected
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, 400, 600);
        ctx.fillStyle = '#6c757d';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Sample Body Image', 200, 300);
        const mockPreview = canvas.toDataURL('image/jpeg', 0.8);
        setPreview(mockPreview);
      }
    }
  }, [handleFile]);

  const handleUseImage = () => {
    if (preview) {
      onUpload(preview);
    }
  };

  const clearPreview = () => {
    setPreview(null);
  };

  if (preview) {
    return (
      <div className="text-center">
        <div className="relative inline-block">
          <img 
            src={preview} 
            alt="Preview" 
            className="max-w-full max-h-64 sm:max-h-96 rounded-lg shadow-md"
          />
          <button
            onClick={clearPreview}
            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="mt-6 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
          <button
            onClick={clearPreview}
            className="px-4 sm:px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Choose Different Image
          </button>
          <button
            onClick={handleUseImage}
            className="px-6 sm:px-8 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
          >
            Use This Image
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div
        className={`border-2 border-dashed rounded-xl p-6 sm:p-12 transition-colors ${
          dragOver 
            ? 'border-teal-400 bg-teal-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
      >
        <div className="flex flex-col items-center space-y-3 sm:space-y-4">
          <div className="p-3 sm:p-4 bg-gray-100 rounded-full">
            <Image className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600" />
          </div>
          
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
              Upload Your Photo
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4 px-4">
              Drag and drop your image here, or click to browse
            </p>
          </div>

          <label className="inline-flex items-center space-x-2 px-4 sm:px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            <span className="text-sm sm:text-base">Select Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 text-xs sm:text-sm text-gray-600 px-4">
        <p>For best results:</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left">
          <li>Ensure your full body is visible</li>
          <li>Stand against a plain background</li>
          <li>Wear form-fitting clothing</li>
          <li>Stand in good lighting</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageUpload;