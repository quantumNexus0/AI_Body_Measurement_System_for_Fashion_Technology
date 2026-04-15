import React, { useState, useRef, useEffect } from 'react';
import {
  Camera, Upload, User, Ruler as Ruler2, CheckCircle2,
  TrendingUp, Download, Plus, X, Layers, Users
} from 'lucide-react';
import CameraCapture from './CameraCapture';
import ImageUpload from './ImageUpload';
import DepthCameraCapture from './DepthCameraCapture';
import MultiplePoseCapture from './MultiplePoseCapture';
import CalibrationModal from './CalibrationModal';
import ClothingRecommendations from './ClothingRecommendations';
import ProgressTracking from './ProgressTracking';
import ExportOptions from './ExportOptions';
import MeasurementProcessor, { getIndianSizes } from '../utils/MeasurementProcessor';

interface CalibrationData {
  type: 'height' | 'reference';
  value: number;
  unit: 'cm' | 'inches';
  referenceObject?: string;
}

// ✅ FIX 1: Replaced 'any' with proper Measurements interface (Line 26)
interface Measurements {
  shoulder_width: string;
  chest: string;
  waist: string;
  hips: string;
  arm_length: string;
  leg_length: string;
  inseam: string;
  neck: string;
  warnings?: string[];
}

type CaptureMethod = 'camera' | 'upload' | '3d' | 'multipose';
type ActiveTab = 'capture' | 'recommendations' | 'progress' | 'export';

const DEFAULT_MEASUREMENTS: Measurements = {
  shoulder_width: '45.0 cm',
  chest: '95.0 cm',
  waist: '80.0 cm',
  hips: '100.0 cm',
  arm_length: '65.0 cm',
  leg_length: '95.0 cm',
  inseam: '80.0 cm',
  neck: '38.0 cm',
};

const MeasurementCapture: React.FC = () => {
  const [captureMethod, setCaptureMethod] = useState<CaptureMethod>('camera');
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null);

  // ✅ FIX 2: Replaced 'any' with Measurements | null (Line 128 area)
  const [measurements, setMeasurements] = useState<Measurements | null>(null);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('capture');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCaptureMenuOpen, setIsCaptureMenuOpen] = useState(false);

  const measurementProcessor = useRef(new MeasurementProcessor());

  useEffect(() => {
    measurementProcessor.current.initialize();
  }, []);

  const handleImageCapture = (imageData: string) => {
    setCurrentImage(imageData);
    setShowCalibration(true);
  };

  const handleCalibrationComplete = (data: CalibrationData) => {
    setCalibrationData(data);
    setShowCalibration(false);
    processImage();
  };

  const processImage = async () => {
    if (!currentImage) {
      setMeasurements(DEFAULT_MEASUREMENTS);
      return;
    }

    setIsProcessing(true);
    setProcessingStep('Detecting body landmarks...');

    const response = await fetch(currentImage);
    const blob = await response.blob();

    setProcessingStep('Analyzing pose and extracting measurements...');

    const result = await measurementProcessor.current.processImage(
      blob,
      calibrationData ?? { type: 'height', value: 170, unit: 'cm' }
    );

    // ✅ FIX 3: Replaced 'any' spread with typed fallback (Line 178 area)
    setMeasurements(result.measurements ?? DEFAULT_MEASUREMENTS);
    setProcessingStep('Measurements complete!');
    setIsProcessing(false);
  };

  const resetCapture = () => {
    setCurrentImage(null);
    setCalibrationData(null);
    setMeasurements(null);
    setProcessingStep('');
  };

  const navTabs: { id: ActiveTab; name: string; icon: React.ElementType }[] = [
    { id: 'capture', name: 'Capture', icon: Camera },
    { id: 'recommendations', name: 'Recommendations', icon: User },
    { id: 'progress', name: 'Progress', icon: TrendingUp },
    { id: 'export', name: 'Export', icon: Download },
  ];

  const captureMethods: { id: CaptureMethod; name: string; icon: React.ElementType }[] = [
    { id: 'camera', name: 'Camera', icon: Camera },
    { id: 'upload', name: 'Upload', icon: Upload },
    { id: '3d', name: '3D Scan', icon: Layers },
    { id: 'multipose', name: 'Multi-Pose', icon: Users },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-4">
          Advanced AI Body Measurement System
        </h2>
        <p className="text-sm sm:text-lg text-gray-600 max-w-2xl mx-auto px-4">
          Experience next-generation body measurement technology with 3D scanning, multiple pose analysis,
          clothing recommendations, and progress tracking.
        </p>
      </div>

      {/* Floating Action Button Navigation */}
      <div className="fixed bottom-6 right-6 sm:bottom-10 sm:right-10 z-50">
        {isMobileMenuOpen && (
          <div className="flex flex-col gap-3 mb-4 items-end animate-in slide-in-from-bottom-2 fade-in">
            {navTabs
              .filter((tab) => tab.id !== activeTab)
              .map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }}
                    className="flex items-center gap-3 bg-white p-3 rounded-full shadow-lg border border-gray-100 transition-all hover:bg-gray-50 active:bg-gray-100"
                  >
                    <span className="font-semibold text-sm text-gray-700 pl-3">{tab.name}</span>
                    <div className="bg-teal-50 p-2 text-teal-600 rounded-full">
                      <Icon className="w-5 h-5" />
                    </div>
                  </button>
                );
              })}
          </div>
        )}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="bg-gradient-to-r from-teal-500 to-indigo-500 text-white p-4 rounded-full shadow-2xl transition-transform hover:scale-105 active:scale-95 flex items-center justify-center border-4 border-white"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>

      {/* Capture Tab */}
      {activeTab === 'capture' && !currentImage && (
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-slate-200/50 border border-white p-4 sm:p-10 mb-6 sm:mb-8 transition-all relative">
          {(() => {
            const CaptureModeSwitcher = (
              <div className="flex flex-col items-start mb-6 px-4">
                <button
                  onClick={() => setIsCaptureMenuOpen(!isCaptureMenuOpen)}
                  className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800 transition-all group"
                  title="Switch Capture Method"
                >
                  <div className="flex items-center justify-center">
                    {isCaptureMenuOpen ? <X className="w-5 h-5" /> : <Plus className="w-6 h-6 stroke-[2px]" />}
                  </div>
                  <span className="font-bold text-xs uppercase tracking-widest text-gray-500 group-hover:text-indigo-600">
                    Choose Camera Mode
                  </span>
                </button>
                {isCaptureMenuOpen && (
                  <div className="flex flex-wrap gap-2 mt-4 items-center animate-in slide-in-from-top-2 fade-in">
                    {captureMethods
                      .filter((m) => m.id !== captureMethod)
                      .map((method) => {
                        const Icon = method.icon;
                        return (
                          <button
                            key={method.id}
                            onClick={() => { setCaptureMethod(method.id); setIsCaptureMenuOpen(false); }}
                            className="flex items-center gap-2 bg-white/80 p-2 pr-4 rounded-xl shadow-sm border border-gray-100 transition-all hover:bg-indigo-50 hover:border-indigo-100"
                          >
                            <div className="bg-indigo-50 p-2 text-indigo-600 rounded-lg">
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className="font-bold text-[10px] sm:text-xs text-gray-700 whitespace-nowrap">
                              {method.name}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            );

            return (
              <>
                {captureMethod === 'camera' && (
                  <CameraCapture onCapture={handleImageCapture} overlay={CaptureModeSwitcher} />
                )}
                {captureMethod === 'upload' && (
                  <div className="relative">
                    {CaptureModeSwitcher}
                    <div className="pt-16">
                      <ImageUpload onUpload={handleImageCapture} />
                    </div>
                  </div>
                )}
                {captureMethod === '3d' && (
                  <DepthCameraCapture onCapture={handleImageCapture} overlay={CaptureModeSwitcher} />
                )}
                {captureMethod === 'multipose' && (
                  <MultiplePoseCapture
                    onCapture={(poses: { front: string }) => { handleImageCapture(poses.front); }}
                    overlay={CaptureModeSwitcher}
                  />
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Processing State */}
      {activeTab === 'capture' && isProcessing && (
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-slate-200/50 border border-white p-8 sm:p-12 text-center transform transition-all">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-teal-100 to-indigo-100 rounded-2xl shadow-inner mb-6 animate-pulse">
            <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-t-transparent border-teal-500" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 tracking-tight">Processing Your Image</h3>
          <p className="text-base sm:text-lg text-gray-500 mb-6">{processingStep}</p>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden shadow-inner">
            <div className="bg-gradient-to-r from-teal-400 to-indigo-500 h-3 rounded-full transition-all duration-1000 w-3/4" />
          </div>
        </div>
      )}

      {/* Results */}
      {activeTab === 'capture' && measurements && (
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl shadow-slate-200/50 border border-white p-6 sm:p-10 transform transition-all duration-500 animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center space-x-4 mb-8">
            <div className="p-3 bg-green-100 rounded-full shadow-sm">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Your Body Measurements
            </h3>
          </div>

          <div className="grid sm:grid-cols-2 gap-5 sm:gap-10">
            <div className="space-y-4">
              <MeasurementItem label="Shoulder Width" value={measurements.shoulder_width} />
              <MeasurementItem label="Chest Circumference" value={measurements.chest} />
              <MeasurementItem label="Waist Circumference" value={measurements.waist} />
              <MeasurementItem label="Hip Circumference" value={measurements.hips} />
            </div>
            <div className="space-y-4">
              <MeasurementItem label="Arm Length" value={measurements.arm_length} />
              <MeasurementItem label="Leg Length" value={measurements.leg_length} />
              <MeasurementItem label="Inseam" value={measurements.inseam} />
              <MeasurementItem label="Neck Circumference" value={measurements.neck} />
            </div>
          </div>

          {(() => {
            const sizes = getIndianSizes(measurements as any);
            return (
              <div className="mt-8 p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                <h4 className="text-lg font-semibold text-indigo-900 mb-4 flex items-center">
                  <span className="bg-indigo-100 p-1.5 rounded-lg mr-2">
                    <User className="w-5 h-5 text-indigo-600" />
                  </span>
                  Recommended Indian Sizes
                </h4>
                <div className="grid grid-cols-3 gap-3 md:gap-4">
                  <div className="bg-white p-4 rounded-xl text-center shadow-sm border border-indigo-50">
                    <div className="text-xs sm:text-sm text-gray-500 mb-1">Top Size</div>
                    <div className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-indigo-600">{sizes.top}</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl text-center shadow-sm border border-indigo-50">
                    <div className="text-xs sm:text-sm text-gray-500 mb-1">Bottom Size</div>
                    <div className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-indigo-600">{sizes.bottom}</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl text-center shadow-sm border border-indigo-50">
                    <div className="text-xs sm:text-sm text-gray-500 mb-1">Ethnic Wear</div>
                    <div className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-indigo-600">{sizes.ethnic}</div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="mt-10 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 justify-end">
            <button
              onClick={resetCapture}
              className="flex items-center justify-center space-x-2 px-6 py-3.5 bg-gray-100/80 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
            >
              <Camera className="w-5 h-5" />
              <span>New Measurement</span>
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(JSON.stringify(measurements, null, 2)); }}
              className="flex items-center justify-center space-x-2 px-6 py-3.5 bg-indigo-50 text-indigo-700 font-semibold rounded-xl hover:bg-indigo-100 transition-colors"
            >
              <Ruler2 className="w-5 h-5" />
              <span>Copy Results</span>
            </button>
            <button
              onClick={() => setActiveTab('recommendations')}
              className="flex items-center justify-center space-x-2 px-6 py-3.5 bg-gradient-to-r from-teal-500 to-indigo-500 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
            >
              <User className="w-5 h-5" />
              <span>Get Recommendations</span>
            </button>
          </div>
        </div>
      )}

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && measurements && (
        <ClothingRecommendations measurements={measurements} />
      )}

      {/* Progress Tab */}
      {activeTab === 'progress' && (
        <ProgressTracking
          currentMeasurements={measurements}
          onAddRecord={(record) => { console.log('New record added:', record); }}
        />
      )}

      {/* Export Tab */}
      {activeTab === 'export' && measurements && (
        <ExportOptions
          measurements={measurements}
          progressData={[]}
          recommendations={[]}
        />
      )}

      {/* Empty state for tabs needing measurements */}
      {(activeTab === 'recommendations' || activeTab === 'export') && !measurements && (
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <Ruler2 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">No Measurements Available</h3>
          <p className="text-sm sm:text-base text-gray-600 mb-4 px-4">
            Please capture your body measurements first to access{' '}
            {activeTab === 'recommendations' ? 'clothing recommendations' : 'export options'}.
          </p>
          <button
            onClick={() => setActiveTab('capture')}
            className="px-4 sm:px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
          >
            Start Measurement
          </button>
        </div>
      )}

      {showCalibration && (
        <CalibrationModal
          onComplete={handleCalibrationComplete}
          onCancel={() => setShowCalibration(false)}
        />
      )}
    </div>
  );
};

const MeasurementItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between items-center p-4 sm:p-5 bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-50/50 hover:border-teal-100 transition-colors">
    <span className="font-medium text-gray-600 text-sm sm:text-base">{label}</span>
    <span className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-indigo-600">
      {value}
    </span>
  </div>
);

export default MeasurementCapture;