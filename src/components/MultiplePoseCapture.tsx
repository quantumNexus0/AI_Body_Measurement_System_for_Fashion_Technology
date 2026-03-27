import React, { useState, useRef } from 'react';
import { User, RotateCcw, Camera, Users } from 'lucide-react';

interface MultiplePoseCaptureProps {
  onCapture: (poses: { front: string; side: string; sitting?: string }) => void;
  overlay?: React.ReactNode;
}

const MultiplePoseCapture: React.FC<MultiplePoseCaptureProps> = ({ onCapture, overlay }) => {
  const [currentPose, setCurrentPose] = useState<'front' | 'side' | 'sitting'>('front');
  const [capturedPoses, setCapturedPoses] = useState<{
    front?: string;
    side?: string;
    sitting?: string;
  }>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const poses = [
    {
      id: 'front' as const,
      name: 'Front View',
      icon: User,
      description: 'Stand facing the camera, arms at sides',
      instructions: [
        'Face the camera directly',
        'Stand with feet shoulder-width apart',
        'Arms relaxed at your sides',
        'Look straight ahead'
      ]
    },
    {
      id: 'side' as const,
      name: 'Side View',
      icon: RotateCcw,
      description: 'Turn 90° to show your profile',
      instructions: [
        'Turn to show your left or right side',
        'Keep arms at your sides',
        'Stand up straight',
        'Profile should be clearly visible'
      ]
    },
    {
      id: 'sitting' as const,
      name: 'Sitting Position',
      icon: Users,
      description: 'Sit upright for seated measurements',
      instructions: [
        'Sit on a chair or stool',
        'Keep back straight',
        'Feet flat on the floor',
        'Hands on your knees'
      ]
    }
  ];

  React.useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
      }
    } catch (error) {
      setIsStreaming(true); // Mock success
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  };

  const capturePose = () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.videoWidth === 0) {
      // Generate mock image
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = '#333';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${currentPose.toUpperCase()} POSE`, 320, 240);
        const mockImage = canvas.toDataURL('image/jpeg', 0.8);
        
        const newPoses = { ...capturedPoses, [currentPose]: mockImage };
        setCapturedPoses(newPoses);
        
        // Move to next pose or complete
        const poseOrder = ['front', 'side', 'sitting'] as const;
        const currentIndex = poseOrder.indexOf(currentPose);
        if (currentIndex < poseOrder.length - 1) {
          setCurrentPose(poseOrder[currentIndex + 1]);
        }
      }
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
    const newPoses = { ...capturedPoses, [currentPose]: imageData };
    setCapturedPoses(newPoses);

    // Move to next pose or complete
    const poseOrder = ['front', 'side', 'sitting'] as const;
    const currentIndex = poseOrder.indexOf(currentPose);
    if (currentIndex < poseOrder.length - 1) {
      setCurrentPose(poseOrder[currentIndex + 1]);
    }
  };

  const completePoseCapture = () => {
    if (capturedPoses.front && capturedPoses.side) {
      onCapture(capturedPoses as { front: string; side: string; sitting?: string });
      stopCamera();
    }
  };

  const resetPoses = () => {
    setCapturedPoses({});
    setCurrentPose('front');
  };

  const currentPoseData = poses.find(p => p.id === currentPose);
  const Icon = currentPoseData?.icon || User;

  return (
    <div className="space-y-4 sm:space-y-6 relative text-center">
      {/* Optional UI overlay */}
      {overlay}

      {/* Camera View */}
      <div className="relative bg-black rounded-xl overflow-hidden shadow-sm">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto min-h-[60vh] sm:min-h-[75vh] object-cover"
        />
        
        {/* Pose overlay guide */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="border-2 border-white/40 rounded-lg w-3/4 max-w-sm aspect-[2/3] sm:aspect-[3/4] relative">
            {/* Box outline only */}
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Controls */}
      <div className="flex justify-center flex-wrap gap-2 sm:gap-3">
        <button
          onClick={resetPoses}
          className="flex items-center space-x-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset</span>
        </button>

        {!capturedPoses[currentPose] ? (
          <button
            onClick={capturePose}
            className="flex items-center space-x-1 px-5 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium shadow-sm"
            disabled={!isStreaming}
          >
            <Camera className="w-4 h-4" />
            <span>Capture {currentPoseData?.name}</span>
          </button>
        ) : (
          <button
            onClick={() => {
              const nextPose = poses.find(p => !capturedPoses[p.id])?.id;
              if (nextPose) setCurrentPose(nextPose);
            }}
            className="flex items-center space-x-1 px-5 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium shadow-sm"
          >
            <span>✓ {currentPoseData?.name} Saved</span>
          </button>
        )}

        {capturedPoses.front && capturedPoses.side && (
          <button
            onClick={completePoseCapture}
            className="flex items-center space-x-1 px-5 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors text-sm font-medium shadow-sm"
          >
            <Users className="w-4 h-4" />
            <span>Complete Scan</span>
          </button>
        )}
      </div>

      {/* Current Pose Instructions (Moved to Bottom) */}
      {currentPoseData && !capturedPoses[currentPose] && (
        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 sm:p-4 max-w-md mx-auto shadow-sm">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-blue-900 uppercase tracking-tighter">{currentPoseData?.name} Guidelines</h3>
          </div>
          <p className="text-center text-blue-700 text-xs mb-3 font-medium underline decoration-blue-200 underline-offset-4">{currentPoseData?.description}</p>
          <div className="flex justify-center">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              {currentPoseData?.instructions.map((instruction, index) => (
                <li key={index} className="flex items-start space-x-2 text-blue-600">
                  <div className="min-w-[4px] w-1 h-1 bg-blue-400 rounded-full mt-1.5"></div>
                  <span className="text-[11px] font-medium leading-tight">{instruction}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Progress & Status Summary */}
      <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="flex flex-col items-center gap-4">
          {/* Pose Progress Icons */}
          <div className="flex justify-center flex-wrap gap-3">
            {poses.map((pose) => {
              const PoseIcon = pose.icon;
              const isCompleted = !!capturedPoses[pose.id];
              const isCurrent = pose.id === currentPose;
              
              return (
                <div
                  key={pose.id}
                  onClick={() => setCurrentPose(pose.id)}
                  className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all cursor-pointer w-20 sm:w-24 ${
                    isCompleted
                      ? 'border-green-500 bg-green-50/50'
                      : isCurrent
                      ? 'border-blue-500 bg-blue-50/50'
                      : 'border-gray-100 bg-gray-50/30'
                  }`}
                >
                  <PoseIcon className={`w-4 h-4 sm:w-5 sm:h-5 mb-1 ${
                    isCompleted ? 'text-green-600' : isCurrent ? 'text-blue-600' : 'text-gray-300'
                  }`} />
                  <span className={`text-[10px] font-bold text-center leading-tight ${
                    isCompleted ? 'text-green-700' : isCurrent ? 'text-blue-700' : 'text-gray-400'
                  }`}>
                    {pose.name}
                  </span>
                  {isCompleted && (
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1"></div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-center">
            <div className="inline-flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-full text-xs font-semibold text-gray-600">
               <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></span>
               <span>{Object.keys(capturedPoses).length} / {poses.length} Poses Captured</span>
            </div>
            <p className="mt-2 text-[11px] sm:text-xs text-gray-400 italic font-medium">
              {capturedPoses.front && capturedPoses.side 
                ? "Excellent! You can now finish the scan or capture the final pose." 
                : "Please capture both Front and Side views for your AI measurement."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiplePoseCapture;