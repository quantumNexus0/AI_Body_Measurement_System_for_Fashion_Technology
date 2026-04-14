"""
Smart Auto-Capture Camera for AI Body Measurement
Automatically verifies user pose (stand back, upright, in-frame) before safely triggering a snapshot!
"""

import cv2
import time
import numpy as np
import mediapipe as mp
import logging

from calibration import check_pose_quality
from measure_engine import measure_body_from_image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_smart_camera(user_height: float = 170.0):
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return

    # MediaPipe setup for real-time tracking
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,  # use lower complexity for real-time webcam speed
        min_detection_confidence=0.6,
        min_tracking_confidence=0.6
    )

    countdown_start = 0
    capture_triggered = False

    print("=============================================")
    print(" Smart Camera Activated ")
    print(" Please stand entirely in front of the camera")
    print("=============================================")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Flip horizontally for selfie-view display
        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]

        # Convert to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(rgb_frame)

        status_text = "No person detected. Step into frame."
        color = (0, 0, 255) # Red
        is_perfect = False

        if results.pose_landmarks:
            landmarks = results.pose_landmarks.landmark
            # Check pose validity using our calibration logic
            is_valid, msg = check_pose_quality(landmarks, h, w)

            if is_valid:
                status_text = "PERFECT POSE! Hold Still..."
                color = (0, 255, 0) # Green
                is_perfect = True
            else:
                status_text = msg
                color = (0, 165, 255) # Orange/Red
                countdown_start = 0 # reset countdown if they move out of frame

            # Draw visual skeleton
            mp.solutions.drawing_utils.draw_landmarks(
                frame, 
                results.pose_landmarks, 
                mp_pose.POSE_CONNECTIONS,
                mp.solutions.drawing_utils.DrawingSpec(color=(245,117,66), thickness=2, circle_radius=2),
                mp.solutions.drawing_utils.DrawingSpec(color=color, thickness=2, circle_radius=2)
            )
        else:
            countdown_start = 0

        # Handle the automatic countdown trap
        if is_perfect:
            if countdown_start == 0:
                countdown_start = time.time()
            
            elapsed = time.time() - countdown_start
            remaining = 3 - int(elapsed)

            if remaining <= 0:
                # Capture activated!
                capture_triggered = True
                break
            else:
                # Draw countdown on screen
                cv2.putText(frame, f"Capturing in {remaining}...", (w//2 - 150, h//2), 
                            cv2.FONT_HERSHEY_DUPLEX, 1.5, (0, 255, 0), 3)

        # Draw status box
        cv2.rectangle(frame, (0, h - 50), (w, h), (0, 0, 0), -1)
        cv2.putText(frame, status_text, (20, h - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

        cv2.imshow("BodyFit Smart Camera", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

    # If successful, calculate the measurements with the Python engine
    if capture_triggered:
        print("\n[+] SUCCESS! Snaphot Acquired. Processing mathematically...")
        # Save photo
        cv2.imwrite("capture.jpg", frame)

        # Run the full Ramanujan/MediaPipe analysis on the snapshot
        try:
            # We encode to bytes to mimic API payload
            _, img_encoded = cv2.imencode('.jpg', rgb_frame)
            img_bytes = img_encoded.tobytes()

            calibration_data = {
                "unit": "cm",
                "type": "height",
                "value": user_height
            }

            measurements = measure_body_from_image(img_bytes, calibration_data)
            
            print("\n=============================================")
            print(" PYTHON GENERATED MEASUREMENTS (100% Python) ")
            print("=============================================")
            for key, val in measurements.items():
                print(f" -> {key.upper()}: {val}")
            print("=============================================\n")

        except Exception as e:
            print(f"Error executing python engine: {e}")

if __name__ == "__main__":
    run_smart_camera()
