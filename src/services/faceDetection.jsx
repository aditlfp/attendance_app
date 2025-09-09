// services/faceDetection.jsx
import * as faceapi from 'face-api.js';
import { loadFaceApiModels, areModelsLoaded } from './faceApiLoader';

let MODEL_PATH = '/models';
let USE_TINY = true;

export function setFaceApiModelPath(path) { MODEL_PATH = path; }
export function setUseTiny(v) { USE_TINY = !!v; }

export async function detectFaces(videoElement, drawOverlay = false, canvasElement = null) {
  try {
    if (!areModelsLoaded()) {
      await loadFaceApiModels(MODEL_PATH, USE_TINY);
    }

    const options = USE_TINY
      ? new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
      : new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

    const results = await faceapi.detectAllFaces(videoElement, options).withFaceLandmarks(true);

    const predictions = results.map(res => {
      const box = res.detection.box;
      const landmarks = (res.landmarks && res.landmarks.positions) ? res.landmarks.positions.map(p => [p.x, p.y]) : [];
      return {
        topLeft: [box.x, box.y],
        bottomRight: [box.x + box.width, box.y + box.height],
        landmarks,
        detectionScore: res.detection.score
      };
    });

    if (drawOverlay && canvasElement) {
      drawOverlayOnCanvas(videoElement, canvasElement, predictions);
    }

    return predictions;
  } catch (err) {
    console.error('detectFaces error:', err);
    return [];
  }
}

function drawOverlayOnCanvas(videoEl, canvasEl, predictions = []) {
  const ctx = canvasEl.getContext('2d');
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  if (!videoEl || !videoEl.videoWidth) return;

  const sx = canvasEl.width / videoEl.videoWidth;
  const sy = canvasEl.height / videoEl.videoHeight;

  // guide circle
  const isMobile = window.innerWidth <= 768;
  const guideRadius = isMobile ? 120 : 180;
  ctx.setLineDash([5,5]);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = isMobile ? 1 : 2;
  ctx.beginPath();
  ctx.arc(canvasEl.width / 2, canvasEl.height / 2, guideRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const p of predictions) {
    const tl = p.topLeft;
    const br = p.bottomRight;
    const x = tl[0] * sx, y = tl[1] * sy, w = (br[0] - tl[0]) * sx, h = (br[1] - tl[1]) * sy;

    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    if (Array.isArray(p.landmarks)) {
      ctx.fillStyle = '#FF0000';
      for (const lm of p.landmarks) {
        ctx.beginPath();
        ctx.arc(lm[0] * sx, lm[1] * sy, isMobile ? 1.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export async function isFaceDetectionSupported() {
  try {
    if (!areModelsLoaded()) await loadFaceApiModels(MODEL_PATH, USE_TINY);
    return true;
  } catch (err) {
    console.warn('face detection not supported:', err);
    return false;
  }
}
