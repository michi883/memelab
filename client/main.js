import {
  STATUS_MESSAGES,
  RATING_STORAGE_KEY,
  HUMOR_FINGERPRINT_KEY,
  HUMOR_FINGERPRINT_CATEGORIES
} from './constants.js';
import { getTrending, analyzeMeme as requestAnalysis, remixMeme as requestRemix } from './api.js';
import {
  elements,
  setTrendingStatus,
  setLoadingOverlay,
  resetAnalysisPanel,
  showAnalysisLoading,
  renderAnalysis,
  showAnalysisError,
  setRemixAvailability,
  setRemixStatus,
  setSearchWarning,
  toggleRemixLoading,
  animateRemixGallery,
  setImageSource,
  setRemixPanelVisibility,
  updateRatingCounts,
  triggerThumbAnimation,
  triggerMemeWiggle,
  renderHumorFingerprint,
  setFingerprintCollapsed
} from './ui.js';

const {
  trendingCard,
  trendingTitle,
  trendingAuthor,
  trendingUps,
  trendingLink,
  searchForm,
  searchInput,
  searchSubmit,
  analyzeButton,
  infoToggle,
  remixToggleButton,
  remixPanel,
  remixFrame,
  remixVisual,
  downloadOriginalButton,
  downloadRemixButton
} = elements;

let trendingAfter = null;
let lastSearchQuery = '';
let trendingLoading = false;
let currentMeme = null;
let remixInProgress = false;
let remixSupported = false;
let pendingFetchRequest = null;
const REMIX_PROMPT_MESSAGE = 'Describe how you want to remix this meme above.';
const REMIX_HINT_MESSAGE = 'Type remix instructions above and press Remix (or Cmd/Ctrl+Enter).';
let originalImageUrl = '';
let remixImageUrl = '';

const ratingStore = loadRatings();
const fingerprintDefaults = HUMOR_FINGERPRINT_CATEGORIES.reduce((acc, { key }) => {
  acc[key] = 0.35;
  return acc;
}, {});
const fingerprint = loadFingerprint();
let fingerprintCollapsed = loadFingerprintCollapsed();

if (fingerprintCollapsed === null) {
  fingerprintCollapsed = true;
  persistFingerprintCollapsed(true);
}

renderHumorFingerprint(fingerprint);
setFingerprintCollapsed(fingerprintCollapsed);

function loadRatings() {
  if (typeof localStorage === 'undefined') {
    return {};
  }

  try {
    const raw = localStorage.getItem(RATING_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistRatings() {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(RATING_STORAGE_KEY, JSON.stringify(ratingStore));
  } catch {
    // ignore persistence failures in UX experiment
  }
}

function getRatingKey(slot, meme = currentMeme) {
  const baseId = meme?.id || meme?.imageUrl || 'unknown';
  return `${baseId}:${slot}`;
}

function getRatingEntry(slot, meme = currentMeme) {
  const key = getRatingKey(slot, meme);
  if (!ratingStore[key]) {
    ratingStore[key] = { up: 0, down: 0, vote: null };
  }
  return ratingStore[key];
}

function syncRatingDisplay(slot, meme = currentMeme) {
  if (!meme) {
    updateRatingCounts(slot, { up: 0, down: 0, vote: null });
    return;
  }

  const entry = getRatingEntry(slot, meme);
  updateRatingCounts(slot, entry);
}

function getMemeForSlot(slot) {
  if (!currentMeme) {
    return null;
  }

  if (slot === 'remix') {
    if (!remixFrame || remixFrame.classList.contains('is-hidden') || !remixVisual?.src) {
      return null;
    }
  }

  return currentMeme;
}

const FINGERPRINT_EFFECTS = {
  original: {
    up: { delight: 0.07, warmth: 0.06, edge: -0.04 },
    down: { edge: 0.07, delight: -0.05, warmth: -0.03 }
  },
  remix: {
    up: { chaos: 0.07, wit: 0.05, warmth: -0.02 },
    down: { edge: 0.07, chaos: -0.04, wit: -0.03 }
  }
};

function loadFingerprint() {
  if (typeof localStorage === 'undefined') {
    return { ...fingerprintDefaults };
  }

  try {
    const raw = localStorage.getItem(HUMOR_FINGERPRINT_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...fingerprintDefaults, ...parsed };
  } catch {
    return { ...fingerprintDefaults };
  }
}

function persistFingerprint() {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(HUMOR_FINGERPRINT_KEY, JSON.stringify(fingerprint));
  } catch {
    // ignore storage issues
  }
}

function loadFingerprintCollapsed() {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(HUMOR_FINGERPRINT_COLLAPSED_KEY);
    if (stored === null) {
      return null;
    }
    return stored === 'true';
  } catch {
    return null;
  }
}

function persistFingerprintCollapsed(value) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(HUMOR_FINGERPRINT_COLLAPSED_KEY, value ? 'true' : 'false');
  } catch {
    // ignore
  }
}

function applyFingerprintEffect(effect = {}, multiplier = 1) {
  Object.entries(effect).forEach(([metric, delta]) => {
    const base = fingerprint[metric] ?? fingerprintDefaults[metric] ?? 0;
    fingerprint[metric] = clampFraction(base + delta * multiplier);
  });
}

function updateFingerprintForVote(slot, newVote, previousVote) {
  const effects = FINGERPRINT_EFFECTS[slot] || {};

  if (previousVote && effects[previousVote]) {
    applyFingerprintEffect(effects[previousVote], -1);
  }

  if (newVote && effects[newVote]) {
    applyFingerprintEffect(effects[newVote], 1);
  }

  persistFingerprint();
  renderHumorFingerprint(fingerprint);
}

function clampFraction(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.min(1, Math.max(0, numeric));
}

function handleRatingClick(button) {
  const container = button.closest('.meme-rating');
  if (!container) {
    return;
  }

  const slot = container.dataset.memeSlot || 'original';
  const direction = button.dataset.direction === 'down' ? 'down' : 'up';
  const memeForSlot = getMemeForSlot(slot);

  if (!memeForSlot) {
    if (slot === 'remix') {
      setRemixStatus('Remix the meme before rating it.', true);
    }
    return;
  }

  const entry = getRatingEntry(slot, memeForSlot);
  const previousVote = entry.vote;

  if (previousVote === direction) {
    entry[direction] = Math.max(0, (entry[direction] || 0) - 1);
    entry.vote = null;
  } else {
    if (previousVote) {
      entry[previousVote] = Math.max(0, (entry[previousVote] || 0) - 1);
    }
    entry[direction] = (entry[direction] || 0) + 1;
    entry.vote = direction;
  }

  updateFingerprintForVote(slot, entry.vote, previousVote);
  persistRatings();
  updateRatingCounts(slot, entry);
  triggerThumbAnimation(button);
  triggerMemeWiggle(slot);
}

document.querySelectorAll('.meme-rating .thumb-button').forEach((button) => {
  button.addEventListener('click', () => handleRatingClick(button));
});

function clearCurrentMeme() {
  currentMeme = null;
  if (analyzeButton) {
    analyzeButton.disabled = true;
  }
  setRemixAvailability(false);
  setRemixStatus('');
  setSearchWarning('');
  syncRatingDisplay('original', null);
  syncRatingDisplay('remix', null);
}

async function fetchTrendingMeme({ resetCursor = false, query: overrideQuery, allowDuplicate = false } = {}) {
  if (!trendingCard) {
    return;
  }

  if (trendingLoading) {
    pendingFetchRequest = { resetCursor, query: overrideQuery, allowDuplicate };
    return;
  }

  const previousMeme = currentMeme;
  const rawQuery = typeof overrideQuery === 'string' ? overrideQuery : searchInput?.value || '';
  const activeQuery = rawQuery.trim();
  const isSearch = Boolean(activeQuery);

  if (resetCursor) {
    trendingAfter = null;
  }

  if (searchInput) {
    searchInput.value = activeQuery;
  }

  resetAnalysisPanel();
  clearCurrentMeme();
  setTrendingStatus('');
  setRemixAvailability(false);

  trendingLoading = true;
  if (searchInput) {
    searchInput.disabled = true;
  }
  if (searchSubmit) {
    searchSubmit.disabled = true;
  }

  trendingCard.classList.remove('is-hidden');
  setLoadingOverlay(true);

  try {
    const params = {};
    if (trendingAfter) {
      params.after = trendingAfter;
    }
    if (isSearch) {
      params.query = activeQuery;
    }

    const payload = await getTrending(params);
    const meme = payload?.data;
    const page = payload?.page || {};
    remixSupported = Boolean(payload?.capabilities?.remix);

    if (!meme || !meme.imageUrl) {
      throw new Error('Meme response is missing data');
    }

    trendingAfter = page.after ?? null;
    lastSearchQuery = isSearch ? activeQuery : '';
    const wasDuplicate =
      !allowDuplicate &&
      previousMeme &&
      previousMeme.imageUrl &&
      previousMeme.imageUrl === meme.imageUrl;

    if (wasDuplicate && page.after) {
      pendingFetchRequest = { resetCursor: false, query: activeQuery, allowDuplicate: true };
      return;
    }

    setImageSource(meme.imageUrl);
    originalImageUrl = meme.imageUrl;
    if (trendingTitle) {
      trendingTitle.textContent = meme.title || 'Untitled meme';
    }
    if (trendingAuthor) {
      trendingAuthor.textContent = meme.author ? `u/${meme.author}` : 'unknown';
    }
    if (trendingUps) {
      const upsValue = typeof meme.ups === 'number' ? meme.ups.toLocaleString() : '0';
      trendingUps.textContent = upsValue;
    }
    if (trendingLink) {
      trendingLink.href = meme.permalink || '#';
      trendingLink.textContent = 'View source';
    }

    currentMeme = {
      id: meme.id || '',
      title: meme.title || '',
      imageUrl: meme.imageUrl || ''
    };

    syncRatingDisplay('original', currentMeme);
    syncRatingDisplay('remix', currentMeme);

    if (analyzeButton) {
      analyzeButton.disabled = false;
    }

    if (remixFrame) {
      remixFrame.classList.add('is-hidden');
    }
    if (remixVisual) {
      remixVisual.removeAttribute('src');
    }
    remixImageUrl = '';
    if (remixSupported) {
      setRemixStatus(REMIX_HINT_MESSAGE);
      setSearchWarning('');
    } else {
      setRemixStatus('Remixing requires a configured Gemini API key.', true);
      setSearchWarning('');
    }
    setRemixAvailability(remixSupported && Boolean(currentMeme.imageUrl));

    setTrendingStatus('');
  } catch (error) {
    console.error(error);
    setTrendingStatus(error.message || 'Failed to fetch meme', true);
  } finally {
    trendingLoading = false;
    if (searchInput) {
      searchInput.disabled = false;
    }
    if (searchSubmit) {
      searchSubmit.disabled = false;
    }
    if (analyzeButton) {
      analyzeButton.disabled = !currentMeme;
    }
    const canRemix = remixSupported && Boolean(currentMeme?.imageUrl);
    setRemixAvailability(canRemix);
    setLoadingOverlay(false);

    const hasPending = Boolean(pendingFetchRequest);
    if (hasPending) {
      const nextRequest = pendingFetchRequest;
      pendingFetchRequest = null;
      void fetchTrendingMeme(nextRequest);
    }
  }
}

async function analyzeCurrentMeme(meme) {
  if (!meme || (!meme.title && !meme.imageUrl)) {
    return;
  }

  showAnalysisLoading();
  if (analyzeButton) {
    analyzeButton.disabled = true;
  }

  try {
    const payload = await requestAnalysis({ title: meme.title, imageUrl: meme.imageUrl });
    renderAnalysis(payload?.data);
  } catch (error) {
    console.error(error);
    showAnalysisError(error.message || 'Analysis failed');
  } finally {
    if (analyzeButton) {
      analyzeButton.disabled = !currentMeme;
    }
  }
}

async function remixCurrentMeme(meme, instructions) {
  if (!meme || remixInProgress) {
    return;
  }

  remixInProgress = true;
  toggleRemixLoading(true);
  setRemixStatus(STATUS_MESSAGES.remixing);

  try {
    const payload = await requestRemix({ imageUrl: meme.imageUrl, instructions });
    const editedImageUrl = payload?.editedImageUrl;

    if (!editedImageUrl) {
      throw new Error('Nano Banana did not return a remixed image.');
    }

    if (remixFrame) {
      remixFrame.classList.remove('is-hidden');
    }

    if (remixVisual) {
      remixVisual.src = editedImageUrl;
      remixVisual.alt = `Remixed meme based on ${meme.title || 'original'}`;
    }
    remixImageUrl = editedImageUrl;

    animateRemixGallery();
    setRemixStatus(STATUS_MESSAGES.remixReady);
    syncRatingDisplay('remix', currentMeme);
  } catch (error) {
    console.error(error);
    setRemixStatus(error.message || STATUS_MESSAGES.remixFailed, true);
  } finally {
    remixInProgress = false;
    toggleRemixLoading(false);
  }
}

if (searchForm) {
  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const queryValue = searchInput ? searchInput.value.trim() : '';
    if (!queryValue) {
      setSearchWarning('');
      fetchTrendingMeme({ resetCursor: false });
      return;
    }

    const isNewQuery = queryValue !== lastSearchQuery;
    setSearchWarning('');
    fetchTrendingMeme({ resetCursor: isNewQuery, query: queryValue });
  });
}

if (analyzeButton) {
  analyzeButton.addEventListener('click', () => {
    if (!currentMeme) {
      setTrendingStatus('Search for a meme first to analyze.', true);
      return;
    }

    analyzeCurrentMeme(currentMeme);
  });
}

setRemixPanelVisibility(false);

function triggerRemix() {
  if (!currentMeme || !currentMeme.imageUrl) {
    setRemixStatus('Search for a meme first to remix.', true);
    return;
  }

  if (!remixSupported) {
    setRemixStatus('Remixing requires a configured Gemini API key.', true);
    return;
  }

  const instructions = searchInput ? searchInput.value.trim() : '';
  if (!instructions) {
    setRemixStatus('', false);
    setSearchWarning(REMIX_PROMPT_MESSAGE);
    if (searchInput) {
      searchInput.focus({ preventScroll: true });
    }
    return;
  }

  setSearchWarning('');
  remixCurrentMeme(currentMeme, instructions);
}

if (searchInput) {
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      triggerRemix();
    }
  });
  searchInput.addEventListener('input', () => {
    if (!searchInput.value.trim()) {
      return;
    }
    const statusEl = elements.remixStatus;
    if (!statusEl) {
      return;
    }
    if (statusEl.textContent === REMIX_PROMPT_MESSAGE || statusEl.textContent === REMIX_HINT_MESSAGE) {
      setRemixStatus('');
    }
    setSearchWarning('');
  });
}

function triggerDownload(url, filename) {
  if (!url) {
    return;
  }

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

if (downloadOriginalButton) {
  downloadOriginalButton.addEventListener('click', () => {
    if (!currentMeme || !originalImageUrl) {
      setRemixStatus('Fetch a meme before downloading.', true);
      return;
    }
    const filename = `${currentMeme.title || 'original-meme'}.jpg`;
    triggerDownload(originalImageUrl, filename);
    setRemixStatus('Original meme downloaded.');
  });
}

if (downloadRemixButton) {
  downloadRemixButton.addEventListener('click', () => {
    if (!remixImageUrl) {
      setRemixStatus('Remix the meme before downloading.', true);
      return;
    }
    const filename = `${currentMeme?.title || 'remixed-meme'}-remix.jpg`;
    triggerDownload(remixImageUrl, filename);
    setRemixStatus('Remixed meme downloaded.');
  });
}

if (remixToggleButton) {
  remixToggleButton.addEventListener('click', () => {
    if (remixToggleButton.disabled) {
      return;
    }

    triggerRemix();
  });
}

if (infoToggle) {
  infoToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const expanded = infoToggle.getAttribute('aria-expanded') === 'true';
    infoToggle.setAttribute('aria-expanded', String(!expanded));
    const details = document.getElementById('humor-explainer');
    if (details) {
      details.classList.toggle('is-hidden', expanded);
    }
  });
}

syncRatingDisplay('original', null);
syncRatingDisplay('remix', null);
fetchTrendingMeme();
setRemixAvailability(false);

const fingerprintToggleButton = elements.fingerprintToggle;
const fingerprintFab = elements.fingerprintFab;

if (fingerprintToggleButton) {
  fingerprintToggleButton.addEventListener('click', () => {
    fingerprintCollapsed = !fingerprintCollapsed;
    setFingerprintCollapsed(fingerprintCollapsed);
    persistFingerprintCollapsed(fingerprintCollapsed);
  });
}

if (fingerprintFab) {
  fingerprintFab.addEventListener('click', () => {
    fingerprintCollapsed = false;
    setFingerprintCollapsed(false);
    persistFingerprintCollapsed(false);
  });
}
