import { useRef, useState, useCallback, useEffect } from 'react';
import { Vec2 } from '../game/types';

type HandTrackerState = 'idle' | 'loading' | 'ready' | 'error';

interface UseHandTrackerResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  fingerPos: Vec2 | null;
  isTracking: boolean;
  state: HandTrackerState;
  errorMsg: string;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
}

export function useHandTracker(): UseHandTrackerResult {
  const videoRef = useRef<HTMLVideoElement>(null!);
  const [fingerPos, setFingerPos] = useState<Vec2 | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [trackerState, setTrackerState] = useState<HandTrackerState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const handLandmarkerRef = useRef<import('@mediapipe/tasks-vision').HandLandmarker | null>(null);
  const lastVideoTimeRef = useRef(-1);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsTracking(false);
    setFingerPos(null);
  }, []);

  const startCamera = useCallback(async () => {
    setTrackerState('loading');
    setErrorMsg('');

    try {
      // Load mediapipe
      const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
      );
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
      });
      handLandmarkerRef.current = landmarker;

      // Get webcam
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((res) => {
          videoRef.current!.onloadedmetadata = () => {
            videoRef.current!.play();
            res();
          };
        });
      }

      setTrackerState('ready');
      setIsTracking(true);

      // Detection loop
      const detect = () => {
        animFrameRef.current = requestAnimationFrame(detect);
        const video = videoRef.current;
        if (!video || !handLandmarkerRef.current) return;
        if (video.readyState < 2) return;
        if (video.currentTime === lastVideoTimeRef.current) return;
        lastVideoTimeRef.current = video.currentTime;

        const now = performance.now();
        const results = handLandmarkerRef.current.detectForVideo(video, now);

        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          // Landmark 8 = index finger tip
          const tip = landmarks[8];
          // Mirror X because webcam is flipped, map to canvas coords
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const canvasEl = document.getElementById('fruit-canvas') as HTMLCanvasElement;
          const cw = canvasEl?.width ?? vw;
          const ch = canvasEl?.height ?? vh;
          // tip.x is 0–1 (normalized), mirrored
          const x = (1 - tip.x) * cw;
          const y = tip.y * ch;
          setFingerPos({ x, y });
        } else {
          setFingerPos(null);
        }
      };
      detect();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setErrorMsg('Camera permission denied. Please allow camera access and try again.');
      } else if (msg.includes('NotFound')) {
        setErrorMsg('No camera found. Please connect a webcam and try again.');
      } else {
        setErrorMsg(`Failed to start camera: ${msg}`);
      }
      setTrackerState('error');
      setIsTracking(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
        handLandmarkerRef.current = null;
      }
    };
  }, [stopCamera]);

  return {
    videoRef,
    fingerPos,
    isTracking,
    state: trackerState,
    errorMsg,
    startCamera,
    stopCamera,
  };
}
