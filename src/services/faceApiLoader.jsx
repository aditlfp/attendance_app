// services/faceApiLoader.jsx
import * as faceapi from 'face-api.js';

let _modelsLoaded = false;
let _isLoading = false;

/**
 * modelPath: '/models' by default (served from public/)
 * useTiny: if true, load TinyFaceDetector AND the tiny landmark net (face_landmark_68_tiny)
 *         if false, load SSD Mobilenet AND the full face_landmark_68 net.
 */
export async function loadFaceApiModels(modelPath = '/models', useTiny = true) {
  if (_modelsLoaded) return;
  if (_isLoading) {
    while (_isLoading) await new Promise(r => setTimeout(r, 50));
    return;
  }
  _isLoading = true;
  try {
    console.info('faceApiLoader: loading models from', modelPath, 'useTiny=', useTiny);

    // 1) detector
    try {
      if (useTiny) {
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
        console.info('faceApiLoader: loaded tinyFaceDetector');
      } else {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath);
        console.info('faceApiLoader: loaded ssdMobilenetv1');
      }
    } catch (err) {
      console.error('faceApiLoader: failed to load detector model. Check detector model files in', modelPath, err);
      throw err;
    }

    // 2) landmarks: choose tiny vs full to match detector choice
    try {
      if (useTiny) {
        // load the tiny 68-landmark network
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelPath);
        console.info('faceApiLoader: loaded face_landmark_68_tiny model');
      } else {
        // load the full 68-landmark network
        await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);
        console.info('faceApiLoader: loaded face_landmark_68 model');
      }
    } catch (err) {
      console.error('faceApiLoader: failed to load landmark model. Ensure correct landmark model files exist in', modelPath, err);
      throw err;
    }

    // 3) recognition
    try {
      await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);
      console.info('faceApiLoader: loaded face_recognition model');
    } catch (err) {
      console.error('faceApiLoader: failed to load face_recognition model. Check face_recognition_model files in', modelPath, err);
      throw err;
    }

    _modelsLoaded = true;
    console.info('faceApiLoader: all models loaded successfully');
  } finally {
    _isLoading = false;
  }
}

export function areModelsLoaded() {
  return _modelsLoaded;
}
