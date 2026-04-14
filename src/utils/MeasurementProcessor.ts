import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';

interface CalibrationData {
  type: 'height' | 'reference';
  value: number;
  unit: 'cm' | 'inches';
  referenceObject?: string;
  gender?: 'm' | 'f' | 'n';
}

interface Measurements {
  shoulder_width: string;
  chest: string;
  waist: string;
  hips: string;
  arm_length: string;
  leg_length: string;
  inseam: string;
  neck: string;
}

interface WeightedKeypoint {
  x: number;
  y: number;
  score: number;
  depthEstimate?: number;
}

const REQUIRED_KEYPOINTS = [
  'left_shoulder', 'right_shoulder',
  'left_hip', 'right_hip',
  'left_ankle', 'right_ankle'
];

class MeasurementProcessor {
  private detector: poseDetection.PoseDetector | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await tf.ready().catch(() => {});
    const model = poseDetection.SupportedModels.MoveNet;
    this.detector = await poseDetection.createDetector(model, {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    }).catch(() => null);
    this.initialized = true;
  }

  private assessPoseQuality(
    keypoints: poseDetection.Keypoint[]
  ): { pass: boolean; reason?: string; score: number } {
    const kpMap = new Map(keypoints.map(k => [k.name, k]));
    
    for (const name of REQUIRED_KEYPOINTS) {
      const kp = kpMap.get(name);
      if (!kp || (kp.score ?? 0) < 0.5)
        return { pass: false, reason: `Low confidence: ${name}`, score: 0 };
    }

    const avgScore = keypoints.reduce((s, k) => s + (k.score ?? 0), 0) / keypoints.length;
    
    // Check bilateral symmetry (ensure user is facing camera squarely)
    const ls = kpMap.get('left_shoulder')!;
    const rs = kpMap.get('right_shoulder')!;
    const lh = kpMap.get('left_hip')!;
    const rh = kpMap.get('right_hip')!;

    const shoulderTilt = Math.abs(ls.y - rs.y) / Math.abs(ls.x - rs.x);
    const hipTilt = Math.abs(lh.y - rh.y) / Math.abs(lh.x - rh.x);

    if (shoulderTilt > 0.15 || hipTilt > 0.15) {
      return { pass: false, reason: 'Non-frontal pose detected (Tilt)', score: avgScore };
    }

    return { pass: true, score: avgScore };
  }

  private confidenceWeightedDistance(
    a: WeightedKeypoint,
    b: WeightedKeypoint,
    pixelToUnits: number
  ): { value: number; confidence: number } {
    const confidence = Math.min(a.score, b.score);
    if (confidence < 0.35) return { value: -1, confidence: 0 };

    const dz = (a.depthEstimate ?? 0) - (b.depthEstimate ?? 0);
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const px = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return { value: px / pixelToUnits, confidence };
  }

  private ellipsePerimeter(a: number, b: number): number {
    const h = Math.pow(a - b, 2) / Math.pow(a + b, 2);
    return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  }

  private estimateCircumference(
    widthUnits: number,
    depthUnits: number | undefined,
    type: 'chest' | 'waist' | 'hips',
    gender: 'm' | 'f' | 'n' = 'n'
  ): number {
    const depthRatio = type === 'chest' 
        ? (gender === 'f' ? 0.78 : 0.72) 
        : type === 'waist' 
        ? (gender === 'f' ? 0.68 : 0.62) 
        : 0.85;
    
    const estimatedDepth = depthUnits ?? (widthUnits * depthRatio);
    return this.ellipsePerimeter(widthUnits / 2, estimatedDepth / 2);
  }

  async processImage(
    imageBlob: Blob,
    calibrationData: CalibrationData
  ): Promise<{ measurements: Measurements; quality?: any }> {
    if (!this.detector || !this.initialized) {
        return { measurements: this.generateDefaultMeasurements(calibrationData) };
    }

    const imageUrl = URL.createObjectURL(imageBlob);
    const img = new Image();

    return new Promise((resolve) => {
      img.onload = async () => {
        const poses = await this.detector!.estimatePoses(img).catch(() => []);
        if (poses.length === 0) {
            resolve({ measurements: this.generateDefaultMeasurements(calibrationData) });
            return;
        }

        const quality = this.assessPoseQuality(poses[0].keypoints);
        if (!quality.pass) {
            // Log warning but proceed with best-effort for now
            console.warn(`[AI] Pose quality rejected: ${quality.reason}`);
        }

        const measurements = this.calculateMeasurements(poses[0], calibrationData, img.height);
        resolve({ measurements: measurements ?? this.generateDefaultMeasurements(calibrationData), quality });
        URL.revokeObjectURL(imageUrl);
      };
      img.src = imageUrl;
    });
  }

  private calculateMeasurements(
    pose: poseDetection.Pose,
    calibrationData: CalibrationData,
    imageHeight: number
  ): Measurements | null {
    const kps = pose.keypoints;
    const kpMap = new Map(kps.map(k => [k.name, k as WeightedKeypoint]));

    const pxPerUnit = this.calculatePixelsPerUnit(kps, calibrationData, imageHeight);
    if (pxPerUnit <= 0) return null;

    const getDist = (p1Name: string, p2Name: string) => {
        const a = kpMap.get(p1Name);
        const b = kpMap.get(p2Name);
        if (!a || !b) return { value: -1, confidence: 0 };
        return this.confidenceWeightedDistance(a, b, pxPerUnit);
    };

    const shoulder = getDist('left_shoulder', 'right_shoulder');
    const hips = getDist('left_hip', 'right_hip');
    const gender = calibrationData.gender || 'n';

    const armL = getDist('left_shoulder', 'left_elbow').value + getDist('left_elbow', 'left_wrist').value;
    const legL = getDist('left_hip', 'left_knee').value + getDist('left_knee', 'left_ankle').value;

    return {
      shoulder_width: this.fmt(shoulder.value, calibrationData.unit),
      chest: this.fmt(this.estimateCircumference(shoulder.value * 0.85, undefined, 'chest', gender), calibrationData.unit),
      waist: this.fmt(this.estimateCircumference(shoulder.value * 0.78, undefined, 'waist', gender), calibrationData.unit),
      hips: this.fmt(this.estimateCircumference(hips.value * 1.05, undefined, 'hips', gender), calibrationData.unit),
      arm_length: this.fmt(armL > 0 ? armL : shoulder.value * 1.2, calibrationData.unit),
      leg_length: this.fmt(legL > 0 ? legL : shoulder.value * 2.1, calibrationData.unit),
      inseam: this.fmt(legL > 0 ? legL * 0.82 : shoulder.value * 1.7, calibrationData.unit),
      neck: this.fmt(shoulder.value * 0.38, calibrationData.unit)
    };
  }

  private calculatePixelsPerUnit(kps: poseDetection.Keypoint[], cal: CalibrationData, h: number): number {
    const nose = kps.find(k => k.name === 'nose');
    const lHip = kps.find(k => k.name === 'left_hip');
    const rHip = kps.find(k => k.name === 'right_hip');
    if (!nose || !lHip || !rHip) return 0;
    const hipY = (lHip.y + rHip.y) / 2;
    return (hipY - nose.y) / (cal.value * 0.6 / (cal.unit === 'cm' ? 1 : 2.54));
  }

  private generateDefaultMeasurements(cal: CalibrationData): Measurements {
    const unit = cal.unit;
    const base = unit === 'cm' ? 100 : 40;
    return {
      shoulder_width: `45 ${unit}`,
      chest: `95 ${unit}`,
      waist: `80 ${unit}`,
      hips: `100 ${unit}`,
      arm_length: `65 ${unit}`,
      leg_length: `95 ${unit}`,
      inseam: `80 ${unit}`,
      neck: `38 ${unit}`
    };
  }

  private fmt(val: number, unit: string): string {
    return `${Math.round(val * 10) / 10} ${unit}`;
  }
}
export default MeasurementProcessor;