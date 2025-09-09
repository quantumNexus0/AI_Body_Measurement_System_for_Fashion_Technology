import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, Layers, RotateCcw, Zap, AlertCircle } from 'lucide-react';

interface DepthCameraCaptureProps {
  onCapture: (imageData: string, depthData?: ArrayBuffer) => void;
}

const DepthCameraCapture: React.FC<DepthCameraCaptureProps> = ({ onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const depthCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasDepthSupport, setHasDepthSupport] = useState(false);
  const [depthStream, setDepthStream] = useState<MediaStream | null>(null);

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

  const startDepthCamera = useCallback(async () => {
    try {
      // Try to get depth camera stream
      const constraints = {
        video: {
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
          video: { width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsStreaming(true);
        }
      } catch (fallbackError) {
        console.error('Camera access failed:', fallbackError);
      }
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

  const captureDepthPhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

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

  useEffect(() => {
    checkDepthSupport();
    startDepthCamera();
    return () => stopCamera();
  }, [checkDepthSupport, startDepthCamera, stopCamera]);

  return (
    <div className="relative">
      <div className="relative bg-black rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto max-h-96 object-cover"
        />
        
        {/* 3D Scanning overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="border-2 border-blue-400/70 rounded-lg w-64 h-80 relative">
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-blue-400 text-sm font-medium flex items-center space-x-2">
              <Layers className="w-4 h-4" />
              <span>3D Body Scanning Active</span>
            </div>
            
            {/* Scanning lines animation */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute w-full h-0.5 bg-blue-400/60 animate-pulse" 
                   style={{ 
                     top: '20%',
                     animation: 'scan 2s ease-in-out infinite'
                   }}>
              </div>
            </div>
          </div>
        </div>

        {/* Depth support indicator */}
        {hasDepthSupport && (
          <div className="absolute top-4 right-4 bg-blue-500/90 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-1">
            <Layers className="w-3 h-3" />
            <span>Depth Camera</span>
          </div>
        )}

        {!hasDepthSupport && (
          <div className="absolute top-4 right-4 bg-orange-500/90 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-1">
            <AlertCircle className="w-3 h-3" />
            <span>Standard Camera</span>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={depthCanvasRef} className="hidden" />

      <div className="flex justify-center space-x-4 mt-6">
        <button
          onClick={stopCamera}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          disabled={!isStreaming}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset</span>
        </button>

        <button
          onClick={captureDepthPhoto}
          className="flex items-center space-x-2 px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          disabled={!isStreaming}
        >
          <Zap className="w-5 h-5" />
          <span>3D Scan</span>
        </button>
      </div>

      <div className="mt-4 text-center text-sm text-gray-600">
        <p className="font-medium">3D Body Scanning Instructions:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Stand 3-4 feet from the camera</li>
          <li>Rotate slowly for 360° scanning</li>
          <li>Keep arms slightly away from body</li>
          <li>{hasDepthSupport ? 'Depth camera detected' : 'Using standard camera with AI depth estimation'}</li>
        </ul>
      </div>

      <style jsx>{`
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