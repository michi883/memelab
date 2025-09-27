import { STATUS_MESSAGES } from './constants.js';

export const elements = {
  trendingCard: document.getElementById('trending-card'),
  trendingImage: document.getElementById('trending-image'),
  trendingTitle: document.getElementById('trending-title'),
  trendingAuthor: document.getElementById('trending-author'),
  trendingUps: document.getElementById('trending-ups'),
  trendingLink: document.getElementById('trending-link'),
  trendingStatus: document.getElementById('trending-status'),
  loadingOverlay: document.getElementById('loading-overlay'),
  nextTrendingButton: document.getElementById('next-trending'),
  analyzeButton: document.getElementById('analyze-meme'),
  analysisPanel: document.getElementById('analysis-panel'),
  analysisStatus: document.getElementById('analysis-status'),
  analysisSummary: document.getElementById('analysis-summary'),
  analysisTags: document.getElementById('analysis-tags'),
  infoToggle: document.getElementById('humor-info'),
  remixPanel: document.getElementById('remix-panel'),
  remixQuickInput: document.getElementById('remix-quick-input'),
  remixInput: document.getElementById('remix-input'),
  remixStatus: document.getElementById('remix-status'),
  remixFrame: document.getElementById('remix-frame'),
  remixVisual: document.getElementById('remix-visual'),
  remixToggleButton: document.getElementById('remix-toggle'),
  memeVisuals: document.querySelector('.meme-visuals'),
  yearBadge: document.getElementById('year')
};

if (elements.analyzeButton) {
  elements.analyzeButton.disabled = true;
}

if (elements.yearBadge) {
  elements.yearBadge.textContent = String(new Date().getFullYear());
}

if (elements.remixToggleButton) {
  elements.remixToggleButton.disabled = true;
  elements.remixToggleButton.setAttribute('aria-expanded', 'false');
}

export function setTrendingStatus(message, isError = false) {
  const { trendingStatus } = elements;
  if (!trendingStatus) {
    return;
  }

  trendingStatus.textContent = message || '';
  trendingStatus.classList.toggle('is-error', Boolean(message) && isError);
}

export function setLoadingOverlay(active) {
  const { loadingOverlay } = elements;
  if (!loadingOverlay) {
    return;
  }

  loadingOverlay.classList.toggle('is-hidden', !active);
}

export function resetAnalysisPanel() {
  const { analysisPanel, analysisTags, analysisStatus, analysisSummary, infoToggle, remixFrame, remixVisual, memeVisuals, analyzeButton } = elements;
  if (!analysisPanel || !analysisTags || !analysisStatus) {
    return;
  }

  analysisPanel.classList.add('is-hidden');
  analysisPanel.classList.remove('is-loading');
  analysisTags.innerHTML = '';
  analysisStatus.textContent = '';
  if (analysisSummary) {
    analysisSummary.textContent = '';
    analysisSummary.classList.add('is-hidden');
  }
  const explainer = document.getElementById('humor-explainer');
  if (explainer) {
    explainer.classList.add('is-hidden');
  }
  if (infoToggle) {
    infoToggle.setAttribute('aria-expanded', 'false');
  }
  if (analyzeButton) {
    analyzeButton.disabled = true;
  }
  setRemixAvailability(false);
  if (remixFrame) {
    remixFrame.classList.add('is-hidden');
  }
  if (remixVisual) {
    remixVisual.removeAttribute('src');
  }
  if (memeVisuals) {
    memeVisuals.classList.remove('is-flipping');
  }
  setRemixStatus('');
}

export function showAnalysisLoading() {
  const { analysisPanel, analysisStatus, analysisTags, analysisSummary } = elements;
  if (!analysisPanel || !analysisStatus || !analysisTags) {
    return;
  }

  analysisPanel.classList.remove('is-hidden');
  analysisPanel.classList.add('is-loading');
  analysisTags.innerHTML = '';
  analysisStatus.textContent = STATUS_MESSAGES.analysisLoading;
  if (analysisSummary) {
    analysisSummary.textContent = '';
    analysisSummary.classList.add('is-hidden');
  }
}

export function renderAnalysis(result) {
  const { analysisPanel, analysisStatus, analysisTags, analysisSummary } = elements;
  if (!analysisPanel || !analysisStatus || !analysisTags) {
    return;
  }

  analysisPanel.classList.remove('is-hidden');
  analysisPanel.classList.remove('is-loading');

  const provider = (result?.meta?.provider || result?.source || '').toString().toLowerCase();
  const fallback = Boolean(result?.meta?.fallback);
  const reason = result?.meta?.reason ? String(result.meta.reason) : '';
  const formattedReason = reason
    ? reason
        .split('&')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const cleaned = part.replace(/_/g, ' ');
          const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
          return capitalized.replace(/Api\b/gi, 'API');
        })
        .join(' & ')
    : '';
  let statusLabel = 'Humor Analysis';
  if (fallback) {
    statusLabel += formattedReason ? ` (fallback – ${formattedReason})` : ' (fallback)';
  } else if (provider) {
    const readableProvider = provider === 'gpt-5' ? 'GPT-5' : provider.charAt(0).toUpperCase() + provider.slice(1);
    statusLabel += ` (${readableProvider})`;
  }
  analysisStatus.textContent = statusLabel;

  const { categories = {}, tags = [] } = result || {};
  const baseTags = tags.length
    ? tags
    : [...(categories.format || []), ...(categories.cognitive || []), ...(categories.emotional || [])];
  const uniqueTags = Array.from(new Set(baseTags.filter(Boolean)));

  if (analysisSummary) {
    const summaryText = typeof result?.summary === 'string' ? result.summary.trim() : '';
    analysisSummary.textContent = summaryText || '';
    analysisSummary.classList.toggle('is-hidden', !summaryText);
  }

  analysisTags.innerHTML = '';
  uniqueTags.forEach((tag, index) => {
    const bubble = document.createElement('span');
    bubble.className = 'analysis-tag';
    bubble.style.setProperty('--bubble-index', String(index));
    bubble.textContent = tag;
    analysisTags.appendChild(bubble);
  });
}

export function showAnalysisError(message) {
  const { analysisPanel, analysisStatus, analysisTags, analysisSummary } = elements;
  if (!analysisPanel || !analysisStatus || !analysisTags) {
    return;
  }

  analysisPanel.classList.remove('is-hidden');
  analysisPanel.classList.remove('is-loading');
  analysisTags.innerHTML = '';
  analysisStatus.textContent = message;
  if (analysisSummary) {
    analysisSummary.textContent = '';
    analysisSummary.classList.add('is-hidden');
  }
}

export function setRemixStatus(message, isError = false) {
  const { remixStatus } = elements;
  if (!remixStatus) {
    return;
  }

  remixStatus.textContent = message || '';
  remixStatus.classList.toggle('is-error', Boolean(message) && isError);
}

export function setRemixAvailability(enabled) {
  const { remixPanel, remixQuickInput, remixToggleButton, remixInput } = elements;
  if (remixPanel) {
    remixPanel.classList.toggle('is-disabled', !enabled);
  }
  if (remixQuickInput) {
    remixQuickInput.classList.toggle('is-hidden', !enabled);
  }
  if (remixToggleButton) {
    remixToggleButton.disabled = !enabled;
  }
  if (remixInput) {
    remixInput.disabled = !enabled;
    if (!enabled) {
      remixInput.value = '';
    }
  }
}

export function toggleRemixLoading(active) {
  const { remixToggleButton, remixQuickInput, remixInput } = elements;
  const disabled = Boolean(active);

  if (remixToggleButton) {
    remixToggleButton.disabled = disabled;
  }
  if (remixQuickInput) {
    remixQuickInput.classList.toggle('is-loading', disabled);
  }
  if (remixInput) {
    remixInput.disabled = disabled;
  }
}

export function animateRemixGallery() {
  const { memeVisuals } = elements;
  if (!memeVisuals) {
    return;
  }

  memeVisuals.classList.add('is-flipping');
  setTimeout(() => {
    memeVisuals.classList.remove('is-flipping');
  }, 650);
}

export function setRemixPanelVisibility(visible) {
  const { remixPanel, remixToggleButton, remixQuickInput, remixInput } = elements;
  if (!remixPanel && !remixQuickInput) {
    return;
  }

  const shouldShow = Boolean(visible);
  if (remixPanel) {
    remixPanel.classList.toggle('is-hidden', !shouldShow);
  }
  if (remixQuickInput) {
    remixQuickInput.classList.toggle('is-hidden', !shouldShow);
  }

  if (remixToggleButton) {
    remixToggleButton.setAttribute('aria-expanded', String(shouldShow));
  }

  if (shouldShow && remixInput && typeof remixInput.focus === 'function') {
    remixInput.focus({ preventScroll: true });
  }
}

export function setImageSource(url, { forceRefresh = false } = {}) {
  const { trendingImage } = elements;
  if (!trendingImage) {
    return;
  }

  if (forceRefresh) {
    trendingImage.src = '';
  }

  trendingImage.src = url;
}
