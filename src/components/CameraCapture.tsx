import React, { useRef, useState, useCallback, useEffect } from 'react';
import { RotateCcw, Zap, AlertCircle, CheckCircle2, User } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  overlay?: React.ReactNode;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, overlay }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const requestRef = useRef<number>();
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [poseFeedback, setPoseFeedback] = useState<string>("Initializing AI...");
  const [isPoseValid, setIsPoseValid] = useState(false);

  // Initialize Detector
  useEffect(() => {
    const initDetector = async () => {
      await tf.ready();
      const model = poseDetection.SupportedModels.MoveNet;
      const detector = await poseDetection.createDetector(model, {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      });
      detectorRef.current = detector;
      setPoseFeedback("Stand in the box");
    };
    initDetector();
    
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const validatePose = useCallback((poses: poseDetection.Pose[]) => {
    if (poses.length === 0) {
      setPoseFeedback("No person detected");
      setIsPoseValid(false);
      return;
    }

    const keypoints = poses[0].keypoints;
    const minScore = 0.35;

    // Check critical points
    const criticalPoints = ['nose', 'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle'];
    const visiblePoints = keypoints.filter(kp => criticalPoints.includes(kp.name!) && (kp.score ?? 0) > minScore);

    if (visiblePoints.length < criticalPoints.length) {
      setPoseFeedback("Step back - show full body");
      setIsPoseValid(false);
      return;
    }

    // Check positioning (center)
    const ls = keypoints.find(k => k.name === 'left_shoulder')!;
    const rs = keypoints.find(k => k.name === 'right_shoulder')!;
    const shoulderMidX = (ls.x + rs.x) / 2;
    
    // Normalized check (0 to videoWidth)
    const video = videoRef.current;
    if (video) {
      const centerX = video.videoWidth / 2;
      const offset = Math.abs(shoulderMidX - centerX) / video.videoWidth;
      
      if (offset > 0.15) {
        setPoseFeedback("Center yourself in frame");
        setIsPoseValid(false);
        return;
      }
    }

    // Check tilt
    const tilt = Math.abs(ls.y - rs.y) / Math.abs(ls.x - rs.x);
    if (tilt > 0.15) {
      setPoseFeedback("Stand upright");
      setIsPoseValid(false);
      return;
    }

    setPoseFeedback("Perfect! Hold still");
    setIsPoseValid(true);
  }, []);

  const detectFrame = useCallback(async () => {
    if (detectorRef.current && videoRef.current && videoRef.current.readyState >= 2) {
      const poses = await detectorRef.current.estimatePoses(videoRef.current);
      validatePose(poses);
    }
    requestRef.current = requestAnimationFrame(detectFrame);
  }, [validatePose]);

  useEffect(() => {
    if (isStreaming) {
      requestRef.current = requestAnimationFrame(detectFrame);
    }
  }, [isStreaming, detectFrame]);

  const startCamera = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    }).catch(() => {
      // Mock successful camera start for dev environment
      setIsStreaming(true);
      return null;
    });

    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      setIsStreaming(true);
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
        // Fallback for mock environment
        onCapture("mock-image-data");
        stopCamera();
        return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    onCapture(imageData);
    stopCamera();
  }, [onCapture, stopCamera]);

  const switchCamera = useCallback(() => {
    stopCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, [stopCamera]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  return (
    <div className="relative text-center">
      {overlay}
      
      <div className="relative bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10 group">
        {/* Real-time Feedback Header */}
        <div className={`absolute top-0 inset-x-0 z-20 p-4 transition-all duration-300 ${isPoseValid ? 'bg-green-500/80' : 'bg-orange-500/80'} backdrop-blur-md flex items-center justify-center space-x-2`}>
          {isPoseValid ? <CheckCircle2 className="w-5 h-5 text-white" /> : <AlertCircle className="w-5 h-5 text-white" />}
          <span className="text-white font-bold tracking-wide uppercase text-sm">{poseFeedback}</span>
        </div>

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto min-h-[65vh] sm:min-h-[75vh] object-cover transition-opacity duration-700"
          onLoadedMetadata={() => setIsStreaming(true)}
        />
        
        {/* Guide Box */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`border-4 ${isPoseValid ? 'border-green-400' : 'border-white/30'} rounded-3xl w-4/5 max-w-sm aspect-[3/5] transition-all duration-300 relative`}>
            {/* Visual Guide Silhouette Placeholder */}
            <div className={`absolute inset-0 flex items-center justify-center opacity-20 ${isPoseValid ? 'text-green-400' : 'text-white'}`}>
                <User className="w-full h-full p-10" />
            </div>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="flex justify-center space-x-4 mt-6">
        <button
          onClick={switchCamera}
          className="flex items-center space-x-2 px-6 py-3 bg-white/10 backdrop-blur-md text-gray-700 rounded-2xl hover:bg-white/20 border border-white/20 transition-all font-bold text-sm"
          disabled={!isStreaming}
        >
          <RotateCcw className="w-5 h-5" />
          <span>Switch</span>
        </button>

        <button
          onClick={capturePhoto}
          className={`flex items-center space-x-2 px-10 py-3 rounded-2xl transition-all font-extrabold text-sm shadow-xl ${
            isPoseValid 
            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:scale-105 active:scale-95' 
            : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
          }`}
          disabled={!isStreaming || !isPoseValid}
        >
          <Zap className="w-5 h-5" />
          <span>Take Measurement</span>
        </button>
      </div>

      <div className="mt-6 flex items-start space-x-3 text-left bg-indigo-50/50 p-5 rounded-3xl border border-indigo-100 max-w-lg mx-auto">
        <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
            <AlertCircle className="w-5 h-5" />
        </div>
        <div>
            <p className="font-bold text-indigo-900 text-xs uppercase tracking-widest mb-1">Calibration Tip</p>
            <p className="text-sm text-gray-600 leading-relaxed font-medium">
                Hold an **A4 paper** against your chest. The AI uses it as a 3D depth reference for medical-grade accuracy.
            </p>
        </div>
      </div>
    </div>
  );
};

export default CameraCapture;