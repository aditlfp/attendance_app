// services/faceRecognition.jsx
import * as faceapi from 'face-api.js';
import { loadFaceApiModels, areModelsLoaded } from './faceApiLoader';

let _inited = false;

export async function loadModel(modelPath = '/models', useTiny = true) {
  if (_inited && areModelsLoaded()) return;
  await loadFaceApiModels(modelPath, useTiny);
  _inited = true;
}

/**
 * Extract a face descriptor from a video element.
 * Returns Float32Array (128) or { error: 'TOO_DARK'|'POOR_POSITION' } or null for unexpected error.
 */
export async function getFaceFeatures(videoElement) {
  try {
    if (!areModelsLoaded()) await loadModel();
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

    const detection = await faceapi.detectSingleFace(videoElement, options)
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (!detection) return { error: 'POOR_POSITION' };

    // small brightness check on bounding box
    const box = detection.detection.box;
    const faceBox = { topLeft: [box.x, box.y], bottomRight: [box.x + box.width, box.y + box.height] };
    if (isImageTooDark(videoElement, faceBox)) return { error: 'TOO_DARK' };

    const descriptor = detection.descriptor; // Float32Array length 128
    return l2Normalize(descriptor);
  } catch (err) {
    console.error('getFaceFeatures error:', err);
    return null;
  }
}

function isImageTooDark(videoElement, faceBox) {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const topLeft = faceBox?.topLeft || [0,0];
    const bottomRight = faceBox?.bottomRight || [videoElement.videoWidth || 640, videoElement.videoHeight || 480];
    const w = Math.max(1, bottomRight[0] - topLeft[0]);
    const h = Math.max(1, bottomRight[1] - topLeft[1]);
    canvas.width = w; canvas.height = h;
    ctx.drawImage(videoElement, topLeft[0], topLeft[1], w, h, 0, 0, w, h);
    const data = ctx.getImageData(0,0,w,h).data;
    let total=0, pixels=0;
    for (let i=0;i<data.length;i+=4){ const r=data[i], g=data[i+1], b=data[i+2]; total += 0.299*r + 0.587*g + 0.114*b; pixels++; }
    return (total / pixels) < 40;
  } catch (e) {
    console.warn('isImageTooDark failed', e);
    return false;
  }
}

function l2Normalize(arr) {
  const a = (arr instanceof Float32Array) ? arr : Float32Array.from(arr);
  let ss = 0;
  for (let i=0;i<a.length;i++) ss += a[i]*a[i];
  const n = Math.sqrt(ss) || 1;
  const out = new Float32Array(a.length);
  for (let i=0;i<a.length;i++) out[i] = a[i] / n;
  return out;
}

/* ---------------- Comparison helpers ---------------- */

/** Euclidean distance (between two descriptors) */
function euclideanDistance(a,b) {
  const min = Math.min(a.length, b.length);
  let s = 0;
  for (let i=0;i<min;i++) {
    const d = a[i] - b[i];
    s += d*d;
  }
  return Math.sqrt(s);
}

/**
 * Map Euclidean distance to similarity [0,1] using a threshold.
 * Typical FaceNet threshold ~0.6 (lower = more strict).
 */
export function compareFaces(featuresA, featuresB, threshold = 0.6) {
  if (!featuresA || !featuresB) return 0;
  const a = (featuresA instanceof Float32Array) ? featuresA : l2Normalize(featuresA);
  const b = (featuresB instanceof Float32Array) ? featuresB : l2Normalize(featuresB);
  const dist = euclideanDistance(a,b);
  const sim = Math.max(0, 1 - dist / threshold);
  return Math.max(0, Math.min(1, sim));
}

/**
 * Compare current descriptor against array of stored descriptors.
 * StoredTemplates should come from restoreTemplates (Float32Array[]).
 * Returns { maxSimilarity, bestIndex, distances }.
 */
export function compareAgainstTemplates(currentFeatures, storedTemplates, threshold = 0.6) {
  if (!currentFeatures || !storedTemplates || storedTemplates.length === 0) return { maxSimilarity: 0, bestIndex: -1, distances: [] };
  const cur = (currentFeatures instanceof Float32Array) ? currentFeatures : l2Normalize(currentFeatures);
  let best = -1, bestSim = 0;
  const distances = [];
  for (let i=0;i<storedTemplates.length;i++) {
    const tpl = (storedTemplates[i] instanceof Float32Array) ? storedTemplates[i] : l2Normalize(storedTemplates[i]);
    const dist = euclideanDistance(cur, tpl);
    const sim = Math.max(0, 1 - dist / threshold);
    distances.push(dist);
    if (sim > bestSim) { bestSim = sim; best = i; }
  }
  return { maxSimilarity: bestSim, bestIndex: best, distances };
}

/* ---------------- Persistence helpers ---------------- */

/**
 * Flatten templates for Firestore (converts Float32Array -> normal arrays)
 */
export function flattenTemplates(templates) {
  return {
    templates: templates.map(t => ({ features: Array.from(t), length: t.length })),
    count: templates.length
  };
}

export function restoreTemplates(flattened) {
  if (!flattened || !flattened.templates) return [];
  return flattened.templates.map(t => Float32Array.from(t.features));
}
