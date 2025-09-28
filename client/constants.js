export const API_BASE_URL = 'http://localhost:5000/api';

export const STATUS_MESSAGES = {
  analysisLoading: 'Analyzing humor genome…',
  remixing: 'Remixing with Meme Splicer…',
  remixReady: 'Remix ready. Flip between versions!',
  remixFailed: 'Remix failed.'
};

export const RATING_STORAGE_KEY = 'memeLabThumbRatings';
export const HUMOR_FINGERPRINT_KEY = 'memeLabFingerprint';
export const HUMOR_FINGERPRINT_COLLAPSED_KEY = 'memeLabFingerprintCollapsed';
export const HUMOR_FINGERPRINT_CATEGORIES = [
  { key: 'delight', label: 'Delight' },
  { key: 'wit', label: 'Wit' },
  { key: 'chaos', label: 'Chaos' },
  { key: 'warmth', label: 'Warmth' },
  { key: 'edge', label: 'Edge' }
];
