import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';

/**
 * MeasurementProcessor.ts — Improved Version
 * Uses real MoveNet keypoint coordinates for pixel-to-cm conversion.
 * Replace the existing src/utils/MeasurementProcessor.ts with this file.
 *
 * MoveNet keypoint indices (17 points):
 *  0: nose          1: left_eye       2: right_eye
 *  3: left_ear      4: right_ear      5: left_shoulder
 *  6: right_shoulder 7: left_elbow   8: right_elbow
 *  9: left_wrist   10: right_wrist  11: left_hip
 * 12: right_hip    13: left_knee    14: right_knee
 * 15: left_ankle   16: right_ankle
 */

export interface Keypoint {
  x: number;       // 0.0–1.0 normalized, or pixel if usePixels=true
  y: number;
  score: number;   // confidence 0.0–1.0
  name?: string;
}

export interface CalibrationData {
  type: "height" | "reference";
  value: number;   // actual real-world value in cm
  unit: "cm" | "inches";
  pixelHeight?: number; // pixel distance of the full body (top of head to ankles)
  referenceObject?: string; // from MeasurementCapture
  gender?: 'm' | 'f' | 'n'; // from previous
}

export interface MeasurementResult {
  shoulder_width: string;
  chest: string;
  waist: string;
  hips: string;
  arm_length: string;
  leg_length: string;
  inseam: string;
  neck: string;
  confidence: Record<string, number>; // per-measurement confidence 0–1
  warnings: string[];
}

// Minimum keypoint confidence to trust a measurement
const MIN_CONFIDENCE = 0.4;

/**
 * Euclidean pixel distance between two keypoints.
 */
function pixelDist(a: Keypoint, b: Keypoint, imgW: number, imgH: number): number {
  const dx = (a.x - b.x) * imgW;
  const dy = (a.y - b.y) * imgH;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Returns cm-per-pixel scale factor derived from calibration.
 * For height calibration: actual_height_cm / pixel_height_of_body
 */
function getScaleFactor(
  keypoints: Keypoint[],
  calibration: CalibrationData,
  imgW: number,
  imgH: number
): number {
  const valueCm =
    calibration.unit === "inches"
      ? calibration.value * 2.54
      : calibration.value;

  if (calibration.type === "height") {
    // Use head-top (nose y - estimated ear-to-top offset) to ankle midpoint
    const nose = keypoints[0];
    const leftAnkle = keypoints[15];
    const rightAnkle = keypoints[16];

    const headY = nose.y * imgH - 0.06 * imgH; // ~6% above nose for top of head
    const ankleY =
      ((leftAnkle.y + rightAnkle.y) / 2) * imgH;
    const bodyPixels = Math.abs(ankleY - headY);

    if (bodyPixels < 10) return 0.1; // fallback
    return valueCm / bodyPixels;
  }

  // Reference object calibration: pixelHeight provided externally
  if (calibration.pixelHeight && calibration.pixelHeight > 0) {
    return valueCm / calibration.pixelHeight;
  }

  return 0.1; // safe fallback
}

/**
 * Elliptical circumference approximation.
 * Given the visible front-width (a) and an estimated depth (b = a * depthRatio),
 * uses Ramanujan's approximation: π * (3(a+b) - sqrt((3a+b)(a+3b)))
 */
function ellipseCircumference(frontWidthCm: number, depthRatio = 0.75): number {
  const a = frontWidthCm / 2; // semi-major axis
  const b = a * depthRatio;   // semi-minor axis (estimated depth)
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

/**
 * Confidence of a measurement based on involved keypoints.
 */
function measurementConfidence(kps: Keypoint[]): number {
  if (kps.length === 0) return 0;
  return kps.reduce((sum, k) => sum + k.score, 0) / kps.length;
}

/**
 * Main measurement function.
 *
 * @param keypoints  — 17 MoveNet keypoints (normalized 0–1 x/y)
 * @param calibration — calibration data with real-world height or reference size
 * @param imgW        — source image width in pixels
 * @param imgH        — source image height in pixels
 */
export function processMeasurements(
  keypoints: Keypoint[],
  calibration: CalibrationData,
  imgW: number,
  imgH: number
): MeasurementResult {
  const warnings: string[] = [];
  const scale = getScaleFactor(keypoints, calibration, imgW, imgH);

  const kp = keypoints; // shorthand

  // Helper: pixel distance → cm
  const toCm = (a: Keypoint, b: Keypoint) =>
    pixelDist(a, b, imgW, imgH) * scale;

  // ── Shoulder width ──────────────────────────────────────────────────────
  const shoulderPx = pixelDist(kp[5], kp[6], imgW, imgH);
  const shoulderCm = shoulderPx * scale;
  const shoulderConf = measurementConfidence([kp[5], kp[6]]);

  // ── Neck circumference ───────────────────────────────────────────────────
  // Estimate neck width as ~40% of shoulder width; circumference via ellipse
  const neckWidthCm = shoulderCm * 0.28;
  const neckCm = ellipseCircumference(neckWidthCm, 0.9);
  const neckConf = measurementConfidence([kp[5], kp[6], kp[0]]);

  // ── Chest circumference ──────────────────────────────────────────────────
  // Use shoulder width and scale down by ~0.92 to approximate chest width
  const chestWidthCm = shoulderCm * 0.92;
  const chestCm = ellipseCircumference(chestWidthCm, 0.72);
  const chestConf = measurementConfidence([kp[5], kp[6], kp[11], kp[12]]);

  // ── Waist circumference ───────────────────────────────────────────────────
  // Midpoint between shoulders and hips
  const leftWaistY = (kp[5].y + kp[11].y) / 2;
  const rightWaistY = (kp[6].y + kp[12].y) / 2;
  const leftWaistX = (kp[5].x + kp[11].x) / 2;
  const rightWaistX = (kp[6].x + kp[12].x) / 2;
  const waistWidthPx = Math.sqrt(
    Math.pow((rightWaistX - leftWaistX) * imgW, 2) +
    Math.pow((rightWaistY - leftWaistY) * imgH, 2)
  );
  const waistWidthCm = waistWidthPx * scale;
  const waistCm = ellipseCircumference(waistWidthCm, 0.68);
  const waistConf = measurementConfidence([kp[5], kp[6], kp[11], kp[12]]);

  // ── Hip circumference ─────────────────────────────────────────────────────
  const hipWidthCm = toCm(kp[11], kp[12]) * 1.15; // slight outward correction
  const hipCm = ellipseCircumference(hipWidthCm, 0.78);
  const hipConf = measurementConfidence([kp[11], kp[12]]);

  // ── Arm length (shoulder → elbow → wrist) ────────────────────────────────
  // Use left arm if better confidence, else right
  const leftArmCm = toCm(kp[5], kp[7]) + toCm(kp[7], kp[9]);
  const rightArmCm = toCm(kp[6], kp[8]) + toCm(kp[8], kp[10]);
  const leftArmConf = measurementConfidence([kp[5], kp[7], kp[9]]);
  const rightArmConf = measurementConfidence([kp[6], kp[8], kp[10]]);
  const armCm = leftArmConf >= rightArmConf ? leftArmCm : rightArmCm;
  const armConf = Math.max(leftArmConf, rightArmConf);

  // ── Leg length (hip → knee → ankle) ──────────────────────────────────────
  const leftLegCm = toCm(kp[11], kp[13]) + toCm(kp[13], kp[15]);
  const rightLegCm = toCm(kp[12], kp[14]) + toCm(kp[14], kp[16]);
  const leftLegConf = measurementConfidence([kp[11], kp[13], kp[15]]);
  const rightLegConf = measurementConfidence([kp[12], kp[14], kp[16]]);
  const legCm = leftLegConf >= rightLegConf ? leftLegCm : rightLegCm;
  const legConf = Math.max(leftLegConf, rightLegConf);

  // ── Inseam (hip midpoint → ankle midpoint) ────────────────────────────────
  const hipMidY = ((kp[11].y + kp[12].y) / 2) * imgH;
  const ankleMidY = ((kp[15].y + kp[16].y) / 2) * imgH;
  const inseamCm = Math.abs(ankleMidY - hipMidY) * scale * 0.92; // 92% of hip-to-ankle
  const inseamConf = measurementConfidence([kp[11], kp[12], kp[15], kp[16]]);

  // ── Plausibility checks ────────────────────────────────────────────────────
  const checks: Array<[number, string, [number, number]]> = [
    [shoulderCm, "Shoulder width", [30, 65]],
    [chestCm,    "Chest",          [70, 145]],
    [waistCm,    "Waist",          [55, 125]],
    [hipCm,      "Hips",           [75, 140]],
    [armCm,      "Arm length",     [45, 90]],
    [legCm,      "Leg length",     [65, 115]],
    [inseamCm,   "Inseam",         [55, 100]],
    [neckCm,     "Neck",           [28, 55]],
  ];

  checks.forEach(([val, name, [lo, hi]]) => {
    if (val < lo || val > hi) {
      warnings.push(
        `${name} (${val.toFixed(1)} cm) is outside typical range ${lo}–${hi} cm. ` +
        `Check calibration or image quality.`
      );
    }
  });

  // Warn on low-confidence keypoints
  [shoulderConf, armConf, legConf].forEach((c, i) => {
    const names = ["shoulder", "arm", "leg"];
    if (c < MIN_CONFIDENCE) {
      warnings.push(`Low detection confidence for ${names[i]} (${(c * 100).toFixed(0)}%). Consider re-capturing.`);
    }
  });

  return {
    shoulder_width: `${shoulderCm.toFixed(1)} cm`,
    chest:          `${chestCm.toFixed(1)} cm`,
    waist:          `${waistCm.toFixed(1)} cm`,
    hips:           `${hipCm.toFixed(1)} cm`,
    arm_length:     `${armCm.toFixed(1)} cm`,
    leg_length:     `${legCm.toFixed(1)} cm`,
    inseam:         `${inseamCm.toFixed(1)} cm`,
    neck:           `${neckCm.toFixed(1)} cm`,
    confidence: {
      shoulder_width: shoulderConf,
      chest:          chestConf,
      waist:          waistConf,
      hips:           hipConf,
      arm_length:     armConf,
      leg_length:     legConf,
      inseam:         inseamConf,
      neck:           neckConf,
    },
    warnings,
  };
}

/**
 * Indian size chart mapper.
 * Returns top/bottom/ethnic size based on measurements.
 */
export function getIndianSizes(result: MeasurementResult): {
  top: string; bottom: string; ethnic: string;
} {
  const chest = parseFloat(result.chest);
  const waist = parseFloat(result.waist);
  const hips  = parseFloat(result.hips);

  const sizeFromChest = (c: number) =>
    c < 82 ? "XS" : c < 88 ? "S" : c < 94 ? "M" : c < 100 ? "L" : c < 108 ? "XL" : "XXL";

  const sizeFromWaist = (w: number) =>
    w < 68 ? "XS" : w < 74 ? "S" : w < 80 ? "M" : w < 88 ? "L" : w < 96 ? "XL" : "XXL";

  const sizeFromHip = (h: number) =>
    h < 86 ? "XS" : h < 92 ? "S" : h < 98 ? "M" : h < 106 ? "L" : h < 114 ? "XL" : "XXL";

  return {
    top:    sizeFromChest(chest),
    bottom: sizeFromWaist(waist),
    ethnic: sizeFromHip(hips),
  };
}

export default class MeasurementProcessor {
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

  async processImage(
    imageBlob: Blob,
    calibrationData: CalibrationData
  ): Promise<{ measurements: MeasurementResult | null; quality?: any }> {
    if (!this.detector || !this.initialized) {
        return { measurements: null };
    }

    const imageUrl = URL.createObjectURL(imageBlob);
    const img = new Image();

    return new Promise((resolve) => {
      img.onload = async () => {
        const poses = await this.detector!.estimatePoses(img).catch(() => []);
        if (poses.length === 0) {
            resolve({ measurements: null });
            URL.revokeObjectURL(imageUrl);
            return;
        }

        const pose = poses[0];
        
        // MoveNet returns keypoints in pixel coordinates.
        // The processMeasurements algorithm expects normalized keypoints 0.0-1.0
        const normalizedKeypoints: Keypoint[] = pose.keypoints.map(kp => ({
           x: kp.x / img.width,
           y: kp.y / img.height,
           score: kp.score ?? 0,
           name: kp.name
        }));

        // Fill missing keypoints with 0 if somehow MoveNet returned fewer than 17
        while (normalizedKeypoints.length < 17) {
          normalizedKeypoints.push({ x: 0, y: 0, score: 0 });
        }

        const measurements = processMeasurements(normalizedKeypoints, calibrationData, img.width, img.height);
        
        // Basic quality assessment
        const qualityScore = pose.keypoints.reduce((sum, kp) => sum + (kp.score ?? 0), 0) / pose.keypoints.length;
        const pass = qualityScore > 0.4 && measurements.warnings.length === 0;

        resolve({ measurements, quality: { pass, score: qualityScore, reason: measurements.warnings[0] } });
        URL.revokeObjectURL(imageUrl);
      };
      img.onerror = () => {
        resolve({ measurements: null });
        URL.revokeObjectURL(imageUrl);
      };
      img.src = imageUrl;
    });
  }
}