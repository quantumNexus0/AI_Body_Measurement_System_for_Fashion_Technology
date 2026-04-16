import { describe, it, expect } from 'vitest';
import { computeMeasurements } from '../MeasurementProcessorV2';
import * as poseDetection from '@tensorflow-models/pose-detection';

describe('MeasurementProcessorV2', () => {
  it('should compute realistic measurements from mock keypoints', () => {
    // Mock keypoints for a person ~170cm tall
    // 0: nose, 5: l_shoulder, 6: r_shoulder, 11: l_hip, 12: r_hip, 15: l_ankle, 16: r_ankle
    const mockKeypoints: poseDetection.Keypoint[] = Array(17).fill({ x: 0, y: 0, score: 0.9 });
    
    // Set some realistic pixel distances
    mockKeypoints[0] = { name: 'nose', x: 200, y: 100, score: 0.9 };
    mockKeypoints[5] = { name: 'left_shoulder', x: 150, y: 150, score: 0.9 };
    mockKeypoints[6] = { name: 'right_shoulder', x: 250, y: 150, score: 0.9 };
    mockKeypoints[11] = { name: 'left_hip', x: 160, y: 300, score: 0.9 };
    mockKeypoints[12] = { name: 'right_hip', x: 240, y: 300, score: 0.9 };
    mockKeypoints[15] = { name: 'left_ankle', x: 170, y: 550, score: 0.9 };
    mockKeypoints[16] = { name: 'right_ankle', x: 230, y: 550, score: 0.9 };

    // pixels_per_cm = (footY - noseY) / (heightCm * 0.93)
    // (550 - 100) / (170 * 0.93) = 450 / 158.1 ≈ 2.846
    const pixelsPerCm = 2.846;

    const result = computeMeasurements(mockKeypoints, pixelsPerCm);

    expect(result.shoulder_width.value).toBeCloseTo(35.1, 0.1); 
    expect(result.chest.value).toBeGreaterThan(result.shoulder_width.value);
    expect(result.overall_confidence).toBeGreaterThan(80);
    expect(result.warnings).toHaveLength(0);
  });

  it('should emit warnings for missing landmarks', () => {
    const poorKeypoints: poseDetection.Keypoint[] = Array(17).fill(null);
    const result = computeMeasurements(poorKeypoints as any, 1.0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.overall_confidence).toBe(0);
  });
});
