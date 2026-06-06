/** True on iOS, iPadOS, and macOS Safari/Chrome. */
export function isAppleDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMac = /Macintosh|Mac OS X/.test(ua);
  return isIOS || isMac;
}

/**
 * Mic constraints tuned for voice capture on AirPods and other Bluetooth headsets.
 * Apple routes the AirPods mic automatically; these settings improve clarity and
 * reduce echo/feedback common with wireless earbuds.
 */
export function getRecordingConstraints() {
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: { ideal: 1 },
      sampleRate: { ideal: isAppleDevice() ? 48000 : 44100 },
      sampleSize: { ideal: 16 },
    },
    video: false,
  };
}

const MIME_CANDIDATES = [
  { mimeType: 'audio/mp4;codecs=mp4a', extension: 'm4a' },
  { mimeType: 'audio/mp4', extension: 'm4a' },
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
];

export function getSupportedRecorderFormat() {
  if (typeof MediaRecorder === 'undefined') {
    return null;
  }

  if (isAppleDevice()) {
    for (const candidate of MIME_CANDIDATES.filter((c) => c.extension === 'm4a')) {
      if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
        return candidate;
      }
    }
  }

  for (const candidate of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return candidate;
    }
  }

  return { mimeType: '', extension: 'webm' };
}

/**
 * Request microphone access with headset-friendly constraints.
 * Falls back to plain audio if the browser rejects advanced constraints.
 */
export async function getVoiceInputStream() {
  const constraints = getRecordingConstraints();
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch {
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }
}

/**
 * Create a MediaRecorder configured for the current platform.
 * Uses 1s timeslices for reliable capture on mobile Safari.
 */
export function createVoiceRecorder(stream) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Voice recording is not supported in this browser.');
  }

  const format = getSupportedRecorderFormat();
  const options = {};
  if (format?.mimeType) {
    options.mimeType = format.mimeType;
    if (isAppleDevice()) {
      options.audioBitsPerSecond = 128000;
    }
  }

  const recorder = new MediaRecorder(stream, options);
  const mimeType = recorder.mimeType || format?.mimeType || 'audio/webm';
  const extension = format?.extension || (mimeType.includes('mp4') ? 'm4a' : 'webm');

  return { recorder, mimeType, extension };
}
