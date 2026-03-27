import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Layers, RotateCcw, Zap } from 'lucide-react';

interface DepthCameraCaptureProps {
  onCapture: (imageData: string, depthData?: ArrayBuffer) => void;
  overlay?: React.ReactNode;
}

const DepthCameraCapture: React.FC<DepthCameraCaptureProps> = ({ onCapture, overlay }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const depthCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasDepthSupport, setHasDepthSupport] = useState(false);
  const [depthStream, setDepthStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const checkDepthSupport = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const depthCameras = devices.filter(device => 
        device.kind === 'videoinput' && 
        (device.label.toLowerCase().includes('depth') || 
         device.label.toLowerCase().includes('realsense') ||
         device.label.toLowerCase().includes('kinect'))
      );
      setHasDepthSupport(depthCameras.length > 0);
    } catch (error) {
      setHasDepthSupport(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (depthStream) {
      depthStream.getTracks().forEach(track => track.stop());
      setDepthStream(null);
    }
    setIsStreaming(false);
  }, [depthStream]);

  const startDepthCamera = useCallback(async () => {
    stopCamera();
    // Add a small delay to ensure the previous stream is fully released
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      // Try to get depth camera stream if possible, but respect facingMode
      const constraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 640 },
          height: { ideal: 480 },
          // @ts-ignore - Depth camera specific constraints
          videoKind: { exact: "depth" }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setDepthStream(stream);
        setIsStreaming(true);
      }
    } catch (error) {
      // Fallback to regular camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 }, 
            height: { ideal: 720 } 
          }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsStreaming(true);
        }
      } catch (fallbackError) {
        console.error('Camera access failed:', fallbackError);
      }
    }
  }, [facingMode, stopCamera]);

  const captureDepthPhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    if (!video.videoWidth || !video.videoHeight) {
      canvas.width = 640;
      canvas.height = 480;
      context.fillStyle = '#e0f2fe';
      context.fillRect(0, 0, 640, 480);
      context.fillStyle = '#0369a1';
      context.font = '24px Arial';
      context.textAlign = 'center';
      context.fillText('Mock 3D Depth Map', 320, 240);
    } else {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
    }

    // Simulate depth data processing
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    // Generate mock depth data
    const depthCanvas = depthCanvasRef.current;
    if (depthCanvas && hasDepthSupport) {
      const depthContext = depthCanvas.getContext('2d');
      if (depthContext) {
        depthCanvas.width = canvas.width;
        depthCanvas.height = canvas.height;
        
        // Create depth map visualization
        const gradient = depthContext.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, 'rgba(0, 0, 255, 0.8)'); // Near (blue)
        gradient.addColorStop(0.5, 'rgba(0, 255, 0, 0.8)'); // Medium (green)
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0.8)'); // Far (red)
        
        depthContext.fillStyle = gradient;
        depthContext.fillRect(0, 0, canvas.width, canvas.height);
        
        // Convert to depth data buffer
        const depthImageData = depthContext.getImageData(0, 0, canvas.width, canvas.height);
        onCapture(imageData, depthImageData.data.buffer);
      }
    } else {
      onCapture(imageData);
    }

    stopCamera();
  }, [onCapture, stopCamera, hasDepthSupport]);

  const switchCamera = useCallback(() => {
    stopCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, [stopCamera]);

  useEffect(() => {
    checkDepthSupport();
    startDepthCamera();
    return () => stopCamera();
  }, [checkDepthSupport, startDepthCamera, stopCamera, facingMode]);

  return (
    <div className="relative text-center">
      {/* Optional UI Overlay */}
      {overlay}

      <div className="relative bg-black rounded-xl overflow-hidden shadow-sm">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto min-h-[60vh] sm:min-h-[70vh] object-cover"
        />

        {/* 3D Scanning overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="border-2 border-blue-400/70 rounded-lg w-3/4 max-w-sm aspect-[2/3] sm:aspect-[3/4] relative">
            {/* Outline only */}
            
            {/* Scanning lines animation */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-400/50 shadow-[0_0_15px_rgba(96,165,250,0.8)] animate-[scan_3s_ease-in-out_infinite]"></div>
            </div>
          </div>
        </div>

        {hasDepthSupport && (
          <div className="absolute top-4 right-4 bg-blue-500/90 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-1">
            <Layers className="w-3 h-3" />
            <span>Depth Camera</span>
          </div>
        )}

        {!hasDepthSupport && (
          <div className="absolute top-4 right-4 bg-teal-500/90 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1 shadow-md">
            <Zap className="w-3 h-3" />
            <span>AI Depth Estimation</span>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={depthCanvasRef} className="hidden" />

      <div className="flex justify-center space-x-3 mt-6">
        <button
          onClick={stopCamera}
          className="flex items-center space-x-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors text-sm"
          disabled={!isStreaming}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset</span>
        </button>

        <button
          onClick={switchCamera}
          className="flex items-center space-x-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors text-sm"
          disabled={!isStreaming}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Switch Camera</span>
        </button>

        <button
          onClick={captureDepthPhoto}
          className="flex items-center space-x-1 px-6 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors text-sm disabled:opacity-50 shadow-sm"
          disabled={!isStreaming}
        >
          <Zap className="w-4 h-4" />
          <span>3D Scan</span>
        </button>
      </div>

      <div className="mt-4 text-center text-xs sm:text-sm text-gray-700 px-4 bg-blue-50/50 py-3 rounded-xl border border-blue-100 shadow-sm max-w-sm mx-auto">
        <p className="font-bold mb-2 text-blue-800 uppercase tracking-tighter text-[10px] flex items-center justify-center space-x-1">
          <Layers className="w-3 h-3" />
          <span>3D Scanning Guidelines</span>
        </p>
        <ul className="text-left inline-block space-y-1">
          <li className="flex items-start space-x-2">
            <span className="min-w-[4px] w-1 h-1 bg-blue-400 rounded-full mt-1.5"></span>
            <span className="text-xs font-semibold text-gray-900">Stand 3-4 feet from the camera</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="min-w-[4px] w-1 h-1 bg-blue-400 rounded-full mt-1.5"></span>
            <span className="text-xs">Rotate slowly for 360° scanning</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="min-w-[4px] w-1 h-1 bg-blue-400 rounded-full mt-1.5"></span>
            <span className="text-xs">Keep arms slightly away from body</span>
          </li>
        </ul>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 10%; opacity: 1; }
          50% { top: 50%; opacity: 0.7; }
          100% { top: 90%; opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default DepthCameraCapture;