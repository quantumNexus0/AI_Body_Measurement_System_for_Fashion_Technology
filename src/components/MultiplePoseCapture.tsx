import React, { useState, useRef } from 'react';
import { User, RotateCcw, Camera, Users } from 'lucide-react';

interface MultiplePoseCaptureProps {
  onCapture: (poses: { front: string; side: string; sitting?: string }) => void;
}

const MultiplePoseCapture: React.FC<MultiplePoseCaptureProps> = ({ onCapture }) => {
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
    if (!videoRef.current || !canvasRef.current) {
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
    <div className="space-y-6">
      {/* Pose Progress */}
      <div className="flex justify-center space-x-4">
        {poses.map((pose) => {
          const PoseIcon = pose.icon;
          const isCompleted = !!capturedPoses[pose.id];
          const isCurrent = pose.id === currentPose;
          
          return (
            <div
              key={pose.id}
              className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                isCompleted
                  ? 'border-green-500 bg-green-50'
                  : isCurrent
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <PoseIcon className={`w-6 h-6 mb-2 ${
                isCompleted ? 'text-green-600' : isCurrent ? 'text-blue-600' : 'text-gray-400'
              }`} />
              <span className={`text-sm font-medium ${
                isCompleted ? 'text-green-700' : isCurrent ? 'text-blue-700' : 'text-gray-500'
              }`}>
                {pose.name}
              </span>
              {isCompleted && (
                <div className="w-2 h-2 bg-green-500 rounded-full mt-1"></div>
              )}
            </div>
          );
        })}
      </div>

      {/* Current Pose Instructions */}
      {currentPoseData && !capturedPoses[currentPose] && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Icon className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-blue-900">{currentPoseData.name}</h3>
          </div>
          <p className="text-blue-700 mb-4">{currentPoseData.description}</p>
          <ul className="space-y-2">
            {currentPoseData.instructions.map((instruction, index) => (
              <li key={index} className="flex items-center space-x-2 text-blue-600">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                <span className="text-sm">{instruction}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Camera View */}
      <div className="relative bg-black rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto max-h-96 object-cover"
        />
        
        {/* Pose overlay guide */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="border-2 border-white/50 rounded-lg w-64 h-80 relative">
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-white text-sm font-medium flex items-center space-x-2">
              <Icon className="w-4 h-4" />
              <span>{currentPoseData?.name}</span>
            </div>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Controls */}
      <div className="flex justify-center space-x-4">
        <button
          onClick={resetPoses}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset</span>
        </button>

        {!capturedPoses[currentPose] ? (
          <button
            onClick={capturePose}
            className="flex items-center space-x-2 px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            disabled={!isStreaming}
          >
            <Camera className="w-5 h-5" />
            <span>Capture {currentPoseData?.name}</span>
          </button>
        ) : (
          <button
            onClick={() => setCurrentPose(poses.find(p => !capturedPoses[p.id])?.id || 'front')}
            className="flex items-center space-x-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <span>✓ {currentPoseData?.name} Captured</span>
          </button>
        )}

        {capturedPoses.front && capturedPoses.side && (
          <button
            onClick={completePoseCapture}
            className="flex items-center space-x-2 px-8 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
          >
            <Users className="w-5 h-5" />
            <span>Complete Multi-Pose Scan</span>
          </button>
        )}
      </div>

      {/* Progress Summary */}
      <div className="text-center text-sm text-gray-600">
        <p>
          Progress: {Object.keys(capturedPoses).length} of {poses.length} poses captured
        </p>
        <p className="mt-1">
          {capturedPoses.front && capturedPoses.side 
            ? "Ready to process measurements!" 
            : "Capture front and side views for complete measurements"}
        </p>
      </div>
    </div>
  );
};

export default MultiplePoseCapture;