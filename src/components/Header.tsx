import React from 'react';
import { Ruler, Camera } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-lg border-b border-gray-100 shadow-sm transition-all duration-300">
      <div className="container mx-auto px-4 py-3 sm:py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="bg-gradient-to-br from-teal-400 to-indigo-500 p-2 sm:p-2.5 rounded-xl shadow-md transform hover:scale-105 transition-transform">
              <Ruler className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 tracking-tight">BodyFit AI</h1>
              <p className="text-xs sm:text-sm font-medium text-gray-500 hidden sm:block tracking-wide">Precision Body Measurements</p>
            </div>
          </div>
          <div className="hidden lg:flex items-center space-x-2 px-4 py-2 bg-gray-50/80 rounded-full border border-gray-100 shadow-inner">
            <Camera className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-semibold text-gray-700">AI-Powered Tech</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;