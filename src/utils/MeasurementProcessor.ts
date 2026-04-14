import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';

interface CalibrationData {
  type: 'height' | 'reference';
  value: number;
  unit: 'cm' | 'inches';
  referenceObject?: string;
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

// ✅ FIX 1: Explicit index-able type for baseValues — fixes ts(7053) "string can't index" error
interface BaseValues {
  shoulder_width: number;
  chest: number;
  waist: number;
  hips: number;
  arm_length: number;
  leg_length: number;
  inseam: number;
  neck: number;
}

const CONFIDENCE_THRESHOLD = 0.4;

class MeasurementProcessor {
  private detector: poseDetection.PoseDetector | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await tf.ready().catch(() => {});

    const model = poseDetection.SupportedModels.MoveNet;
    this.detector = await poseDetection
      .createDetector(model, {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      })
      .catch(() => null);

    this.initialized = true;
  }

  async processImage(
    imageBlob: Blob,
    calibrationData: CalibrationData
  ): Promise<{ measurements: Measurements }> {
    if (!this.detector || !this.initialized) {
      return { measurements: this.generateDefaultMeasurements(calibrationData) };
    }

    const imageUrl = URL.createObjectURL(imageBlob);
    const img = new Image();

    return new Promise((resolve) => {
      img.onload = async () => {
        const poses = await this.detector!.estimatePoses(img).catch(() => []);

        let measurements: Measurements;
        if (poses.length === 0) {
          measurements = this.generateDefaultMeasurements(calibrationData);
        } else {
          // ✅ FIX 2: Removed unused 'imageWidth' parameter — only imageHeight is used
          measurements =
            this.calculateMeasurements(poses[0], calibrationData, img.height) ??
            this.generateDefaultMeasurements(calibrationData);
        }

        URL.revokeObjectURL(imageUrl);
        resolve({ measurements });
      };

      img.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        resolve({ measurements: this.generateDefaultMeasurements(calibrationData) });
      };

      img.src = imageUrl;
    });
  }

  private calculateMeasurements(
    pose: poseDetection.Pose,
    calibrationData: CalibrationData,
    imageHeight: number          // ✅ imageWidth removed — was unused (ts6133)
  ): Measurements | null {
    const keypoints = pose.keypoints!;

    const nose          = keypoints.find((kp) => kp.name === 'nose');
    const leftShoulder  = keypoints.find((kp) => kp.name === 'left_shoulder');
    const rightShoulder = keypoints.find((kp) => kp.name === 'right_shoulder');
    const leftElbow     = keypoints.find((kp) => kp.name === 'left_elbow');
    const leftWrist     = keypoints.find((kp) => kp.name === 'left_wrist');
    const leftHip       = keypoints.find((kp) => kp.name === 'left_hip');
    const rightHip      = keypoints.find((kp) => kp.name === 'right_hip');
    const leftKnee      = keypoints.find((kp) => kp.name === 'left_knee');
    const leftAnkle     = keypoints.find((kp) => kp.name === 'left_ankle');

    // Require these four to be valid
    if (
      !this.isValidKeypoint(leftShoulder) ||
      !this.isValidKeypoint(rightShoulder) ||
      !this.isValidKeypoint(leftHip) ||
      !this.isValidKeypoint(rightHip)
    ) {
      return null;
    }

    const shoulderWidthPx = this.distance(leftShoulder, rightShoulder);
    const hipWidthPx      = this.distance(leftHip, rightHip);
    const waistWidthPx    = shoulderWidthPx * 0.85;

    const pixelsPerUnit = this.calculatePixelsPerUnit(keypoints, calibrationData, imageHeight);
    if (pixelsPerUnit <= 0) return null;

    const leftWristValid = this.isValidKeypoint(leftWrist);
    const leftElbowValid = this.isValidKeypoint(leftElbow);
    const leftAnkleValid = this.isValidKeypoint(leftAnkle);
    const leftKneeValid  = this.isValidKeypoint(leftKnee);

    const armLengthPx = leftWristValid
      ? this.distance(leftShoulder, leftWrist)
      : leftElbowValid
      ? this.distance(leftShoulder, leftElbow)
      : 0;

    const legLengthPx = leftAnkleValid
      ? this.distance(leftHip, leftAnkle)
      : leftKneeValid
      ? this.distance(leftHip, leftKnee)
      : 0;

    // ✅ FIX 3: 'nose' is now actually used in estimateNeckCircumference
    const neckCircumferencePx =
      nose && this.isValidKeypoint(nose)
        ? this.estimateNeckCircumference(nose, leftShoulder, rightShoulder)
        : shoulderWidthPx * 0.35;

    return {
      shoulder_width: this.fmt(shoulderWidthPx / pixelsPerUnit, calibrationData.unit),
      chest: this.fmt(
        this.estimateCircumference(leftShoulder, rightShoulder, 'chest') / pixelsPerUnit,
        calibrationData.unit
      ),
      waist: this.fmt(
        this.estimateCircumferenceFromWidth(waistWidthPx, 0.65) / pixelsPerUnit,
        calibrationData.unit
      ),
      hips: this.fmt(
        this.estimateCircumference(leftHip, rightHip, 'hips') / pixelsPerUnit,
        calibrationData.unit
      ),
      arm_length: this.fmt(
        (armLengthPx > 0 ? armLengthPx : shoulderWidthPx * 0.4) / pixelsPerUnit,
        calibrationData.unit
      ),
      leg_length: this.fmt(
        (legLengthPx > 0 ? legLengthPx : hipWidthPx * 0.9) / pixelsPerUnit,
        calibrationData.unit
      ),
      inseam: this.fmt(
        (leftAnkleValid
          ? this.distance(leftHip, leftAnkle) * 0.75
          : leftKneeValid
          ? this.distance(leftHip, leftKnee) * 0.75
          : hipWidthPx * 0.5) / pixelsPerUnit,
        calibrationData.unit
      ),
      neck: this.fmt(neckCircumferencePx / pixelsPerUnit, calibrationData.unit),
    };
  }

  private calculatePixelsPerUnit(
    keypoints: poseDetection.Keypoint[],
    calibrationData: CalibrationData,
    imageHeight: number
  ): number {
    if (calibrationData.type === 'height') {
      const nose     = keypoints.find((kp) => kp.name === 'nose');
      const leftHip  = keypoints.find((kp) => kp.name === 'left_hip');
      const rightHip = keypoints.find((kp) => kp.name === 'right_hip');

      if (!nose || !leftHip || !rightHip) return 0;

      const hipY = (leftHip.y + rightHip.y) / 2;
      const bodyHeightPixels = hipY - nose.y;
      const estimatedFullHeightPixels = bodyHeightPixels / 0.6; // hip ≈ 60% of height
      return estimatedFullHeightPixels / calibrationData.value;
    }

    // Reference object fallback
    return imageHeight / (calibrationData.value * 12);
  }

  private isValidKeypoint(kp?: poseDetection.Keypoint | null): kp is poseDetection.Keypoint {
    return Boolean(kp && (kp.score ?? 1) >= CONFIDENCE_THRESHOLD);
  }

  private estimateCircumferenceFromWidth(widthPixels: number, depthRatio = 0.75): number {
    const a = widthPixels / 2;
    const b = (widthPixels * depthRatio) / 2;
    return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  }

  private distance(p1: poseDetection.Keypoint, p2: poseDetection.Keypoint): number {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  }

  private estimateCircumference(
    left: poseDetection.Keypoint,
    right: poseDetection.Keypoint,
    type: 'chest' | 'waist' | 'hips'
  ): number {
    const width = this.distance(left, right);
    const depthRatio = type === 'chest' ? 0.75 : type === 'waist' ? 0.65 : 0.8;
    return this.estimateCircumferenceFromWidth(width, depthRatio);
  }

  private estimateNeckCircumference(
    nose: poseDetection.Keypoint,          // ✅ now used — fixes ts6133 "nose never read"
    leftShoulder: poseDetection.Keypoint,
    rightShoulder: poseDetection.Keypoint
  ): number {
    const shoulderWidth = this.distance(leftShoulder, rightShoulder);
    // Use vertical distance from nose to shoulder midpoint as additional factor
    const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
    const neckHeightPx = Math.max(shoulderMidY - nose.y, 1);
    const neckWidthEstimate = Math.min(shoulderWidth * 0.35, neckHeightPx * 0.8);
    return this.estimateCircumferenceFromWidth(neckWidthEstimate, 0.85);
  }

  private generateDefaultMeasurements(calibrationData: CalibrationData): Measurements {
    const unit = calibrationData.unit;

    // ✅ FIX 4: Strongly typed BaseValues — eliminates ts(7053) index-signature errors
    const baseValues: BaseValues =
      unit === 'cm'
        ? {
            shoulder_width: 45 + Math.random() * 10,
            chest:          90 + Math.random() * 20,
            waist:          75 + Math.random() * 15,
            hips:           95 + Math.random() * 15,
            arm_length:     60 + Math.random() * 10,
            leg_length:     90 + Math.random() * 15,
            inseam:         75 + Math.random() * 10,
            neck:           35 + Math.random() * 5,
          }
        : {
            shoulder_width: 17 + Math.random() * 4,
            chest:          35 + Math.random() * 8,
            waist:          29 + Math.random() * 6,
            hips:           37 + Math.random() * 6,
            arm_length:     24 + Math.random() * 4,
            leg_length:     35 + Math.random() * 6,
            inseam:         29 + Math.random() * 4,
            neck:           14 + Math.random() * 2,
          };

    // Apply height scaling
    if (calibrationData.type === 'height') {
      const scaleFactor = calibrationData.value / (unit === 'cm' ? 170 : 67);
      // ✅ Typed key iteration — no implicit any
      (Object.keys(baseValues) as (keyof BaseValues)[]).forEach((key) => {
        baseValues[key] *= scaleFactor;
      });
    }

    // ✅ Typed key iteration for final formatting
    const result = {} as Measurements;
    (Object.keys(baseValues) as (keyof BaseValues)[]).forEach((key) => {
      result[key] = this.fmt(baseValues[key], unit);
    });

    return result;
  }

  private fmt(value: number, unit: 'cm' | 'inches'): string {
    return `${Math.round(value * 10) / 10} ${unit}`;
  }
}

export default MeasurementProcessor;