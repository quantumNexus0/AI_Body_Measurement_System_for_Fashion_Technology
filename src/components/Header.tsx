import React from 'react';
import { Ruler, Camera } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-100">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-teal-500 p-2 rounded-lg">
              <Ruler className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">BodyFit AI</h1>
              <p className="text-sm text-gray-600">Precision Body Measurements</p>
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-2 text-sm text-gray-600">
            <Camera className="w-4 h-4" />
            <span>AI-Powered Fashion Technology</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;