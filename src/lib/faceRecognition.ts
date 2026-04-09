import * as faceapi from '@vladmandic/face-api';

const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models'; // CDN for models

let modelsLoaded = false;

export async function loadModels() {
  if (modelsLoaded) return;
  
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    console.log('Face Recognition Models Loaded');
  } catch (err) {
    console.error('Error loading face recognition models:', err);
    throw new Error('Failed to load facial recognition models. Please check your internet connection.');
  }
}

export async function getFaceDescriptor(videoElement: HTMLVideoElement) {
  const detections = await faceapi
    .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detections ? detections.descriptor : null;
}

export function compareFaces(descriptor1: Float32Array, descriptor2: Float32Array) {
  const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
  // Lower distance means better match. Threshold is typically 0.6 for FaceRecognitionNet.
  return distance < 0.55; // Using 0.55 for higher accuracy
}

export function serializeDescriptor(descriptor: Float32Array): string {
  return JSON.stringify(Array.from(descriptor));
}

export function deserializeDescriptor(json: string): Float32Array {
  return new Float32Array(JSON.parse(json));
}
