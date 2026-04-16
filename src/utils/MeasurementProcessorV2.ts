import * as poseDetection from '@tensorflow-models/pose-detection';

export interface Measurement {
  value: number;
  unit: 'cm';
  confidence: 'high' | 'medium' | 'low';
}

export interface MeasurementResult {
  shoulder_width: Measurement;
  chest: Measurement;
  waist: Measurement;
  hips: Measurement;
  arm_length: Measurement;
  leg_length: Measurement;
  inseam: Measurement;
  neck: Measurement;
  overall_confidence: number;
  warnings: string[];
}

const DEPTH_RATIO = 0.72; // empirical front/depth ratio for average body

function pixelDist(a: poseDetection.Keypoint, b: poseDetection.Keypoint): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function ellipseCircumference(widthCm: number, depthRatio = DEPTH_RATIO): number {
  const a = widthCm / 2;
  const b = a * depthRatio;
  // Ramanujan approximation
  const h = ((a - b) ** 2) / ((a + b) ** 2);
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

function scoreConfidence(keypoints: poseDetection.Keypoint[], ids: number[]): 'high' | 'medium' | 'low' {
  const scores = ids.map(i => keypoints[i]?.score ?? 0);
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  if (avg > 0.75) return 'high';
  if (avg > 0.45) return 'medium';
  return 'low';
}

export function computeMeasurements(
  keypoints: poseDetection.Keypoint[],
  pixelsPerCm: number
): MeasurementResult {
  const warnings: string[] = [];

  const toCm = (px: number) => parseFloat((px / pixelsPerCm).toFixed(1));

  const kp = keypoints;
  const missingKps: string[] = [];

  // Validate key landmarks exist
  if (!kp[5] || !kp[6]) missingKps.push('shoulders');
  if (!kp[11] || !kp[12]) missingKps.push('hips');
  if (!kp[15] || !kp[16]) missingKps.push('ankles');
  if (missingKps.length > 0) warnings.push(`Low confidence on: ${missingKps.join(', ')}`);

  // Shoulder width
  const shoulderPxWidth = kp[5] && kp[6] ? pixelDist(kp[5], kp[6]) : 0;
  const shoulderCm = toCm(shoulderPxWidth);

  // Hip width
  const hipPxWidth = kp[11] && kp[12] ? pixelDist(kp[11], kp[12]) : 0;
  const hipCm = toCm(hipPxWidth);

  // Chest: estimated as 1.15× shoulder width (average ratio)
  const chestWidthCm = shoulderCm * 1.15;

  // Waist: estimated at midpoint between shoulder base and hip
  let waistWidthCm = 0;
  if (kp[5] && kp[6] && kp[11] && kp[12]) {
     // const waistY = (kp[5].y + kp[6].y) / 2 + (kp[11].y - (kp[5].y + kp[6].y) / 2) * 0.55;
     const waistScaleFactor = 0.72; // waist is narrower than shoulder
     waistWidthCm = shoulderCm * waistScaleFactor;
  }

  // Arm length: shoulder to wrist
  const leftArm = (kp[5] && kp[7] && kp[9]) ? (pixelDist(kp[5], kp[7]) + pixelDist(kp[7], kp[9])) : 0;
  const rightArm = (kp[6] && kp[8] && kp[10]) ? (pixelDist(kp[6], kp[8]) + pixelDist(kp[8], kp[10])) : 0;
  const armCm = toCm((leftArm + rightArm) / 2);

  // Leg length: hip to ankle
  const leftLeg = (kp[11] && kp[13] && kp[15]) ? (pixelDist(kp[11], kp[13]) + pixelDist(kp[13], kp[15])) : 0;
  const rightLeg = (kp[12] && kp[14] && kp[16]) ? (pixelDist(kp[12], kp[14]) + pixelDist(kp[14], kp[16])) : 0;
  const legCm = toCm((leftLeg + rightLeg) / 2);

  // Inseam: hip to ankle minus ~10cm for rise
  const inseamCm = parseFloat((legCm * 0.88).toFixed(1));

  // Neck: estimated as 0.38 × shoulder width (empirical)
  const neckWidthCm = shoulderCm * 0.38;

  const validKps = kp.filter(k => k != null);
  const overallConf = validKps.reduce((s, k) => s + (k.score ?? 0), 0) / validKps.length;

  return {
    shoulder_width: { value: shoulderCm, unit: 'cm', confidence: scoreConfidence(kp, [5, 6]) },
    chest: { value: parseFloat(ellipseCircumference(chestWidthCm).toFixed(1)), unit: 'cm', confidence: scoreConfidence(kp, [5, 6]) },
    waist: { value: parseFloat(ellipseCircumference(waistWidthCm).toFixed(1)), unit: 'cm', confidence: scoreConfidence(kp, [11, 12]) },
    hips: { value: parseFloat(ellipseCircumference(hipCm).toFixed(1)), unit: 'cm', confidence: scoreConfidence(kp, [11, 12]) },
    arm_length: { value: armCm, unit: 'cm', confidence: scoreConfidence(kp, [5, 7, 9, 6, 8, 10]) },
    leg_length: { value: legCm, unit: 'cm', confidence: scoreConfidence(kp, [11, 13, 15]) },
    inseam: { value: inseamCm, unit: 'cm', confidence: scoreConfidence(kp, [11, 13, 15]) },
    neck: { value: parseFloat(ellipseCircumference(neckWidthCm, 0.85).toFixed(1)), unit: 'cm', confidence: scoreConfidence(kp, [0, 5, 6]) },
    overall_confidence: parseFloat((overallConf * 100).toFixed(1)),
    warnings,
  };
}
