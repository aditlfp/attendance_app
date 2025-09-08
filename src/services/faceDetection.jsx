import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';

let model = null;

export async function loadModel() {
  if (!model) {
    model = await blazeface.load();
  }
  return model;
}

export async function detectFaces(videoElement) {
  if (!model) {
    await loadModel();
  }
  const predictions = await model.estimateFaces(videoElement, false);
  return predictions;
}

export function drawFaceBox(ctx, prediction) {
  const start = prediction.topLeft;
  const end = prediction.bottomRight;
  const size = [end[0] - start[0], end[1] - start[1]];
  
  ctx.strokeStyle = '#00FF00';
  ctx.lineWidth = 2;
  ctx.strokeRect(start[0], start[1], size[0], size[1]);
}