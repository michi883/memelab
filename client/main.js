const API_BASE_URL = 'http://localhost:5000/api';

const settingsContainer = document.querySelector('.settings');
const settingsToggle = document.getElementById('settings-toggle');
const settingsMenu = document.getElementById('settings-menu');

const trendingCard = document.getElementById('trending-card');
const trendingImage = document.getElementById('trending-image');
const trendingTitle = document.getElementById('trending-title');
const trendingAuthor = document.getElementById('trending-author');
const trendingUps = document.getElementById('trending-ups');
const trendingLink = document.getElementById('trending-link');
const trendingStatus = document.getElementById('trending-status');
const offlineIndicator = document.getElementById('offline-indicator');
const loadingOverlay = document.getElementById('loading-overlay');
const nextTrendingButton = document.getElementById('next-trending');
const analyzeButton = document.getElementById('analyze-meme');
const analysisPanel = document.getElementById('analysis-panel');
const analysisStatus = document.getElementById('analysis-status');
const analysisSummary = document.getElementById('analysis-summary');
const analysisTags = document.getElementById('analysis-tags');
const infoToggle = document.getElementById('humor-info');
const toggleOfflineButton = document.getElementById('toggle-offline');
const yearBadge = document.getElementById('year');

let trendingAfter = null;
let trendingLoading = false;
let offlineMode = false;
let currentMeme = null;

if (analyzeButton) {
  analyzeButton.disabled = true;
}

if (yearBadge) {
  yearBadge.textContent = String(new Date().getFullYear());
}

function setTrendingStatus(message, isError = false) {
  if (!trendingStatus) {
    return;
  }

  trendingStatus.textContent = message || '';
  trendingStatus.classList.toggle('is-error', Boolean(message) && isError);
}

function setOfflineIndicator(active, message) {
  if (!offlineIndicator) {
    return;
  }

  offlineIndicator.classList.toggle('is-hidden', !active);
  if (active && message) {
    offlineIndicator.textContent = message;
  } else if (active) {
    offlineIndicator.textContent = 'Offline mode';
  }
}

function setLoadingOverlay(active) {
  if (!loadingOverlay) {
    return;
  }

  loadingOverlay.classList.toggle('is-hidden', !active);
}

function resetAnalysisPanel() {
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
  currentMeme = null;
  if (analyzeButton) {
    analyzeButton.disabled = true;
  }
}

function showAnalysisLoading() {
  if (!analysisPanel || !analysisStatus || !analysisTags) {
    return;
  }

  analysisPanel.classList.remove('is-hidden');
  analysisPanel.classList.add('is-loading');
  analysisTags.innerHTML = '';
  analysisStatus.textContent = 'Analyzing humor genome…';
  if (analysisSummary) {
    analysisSummary.textContent = '';
    analysisSummary.classList.add('is-hidden');
  }
}

function renderAnalysis(result) {
  if (!analysisPanel || !analysisTags || !analysisStatus) {
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
          return capitalized.replace(/Api/gi, 'API');
        })
        .join(' & ')
    : '';
  let statusLabel = 'Humor Genome labels';
  if (fallback) {
    statusLabel += formattedReason ? ` (fallback – ${formattedReason})` : ' (fallback)';
  } else if (provider) {
    const readableProvider = provider === 'gpt-5' ? 'GPT-5' : provider.charAt(0).toUpperCase() + provider.slice(1);
    statusLabel += ` (${readableProvider})`;
  }
  analysisStatus.textContent = statusLabel;

  const { categories = {}, tags = [] } = result || {};
  const baseTags = tags.length ? tags : [
    ...(categories.format || []),
    ...(categories.cognitive || []),
    ...(categories.emotional || [])
  ];
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

function showAnalysisError(message) {
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

function updateOfflineToggle() {
  if (!toggleOfflineButton) {
    return;
  }

  toggleOfflineButton.textContent = offlineMode ? 'Go Online' : 'Go Offline';
  toggleOfflineButton.setAttribute('aria-pressed', String(offlineMode));
}

function setSettingsOpen(open) {
  if (!settingsContainer || !settingsToggle) {
    return;
  }

  settingsContainer.classList.toggle('is-open', open);
  settingsToggle.setAttribute('aria-expanded', String(open));

  if (open && settingsMenu) {
    settingsMenu.focus?.();
  }
}

function toggleSettingsMenu() {
  if (!settingsContainer) {
    return;
  }

  const isOpen = settingsContainer.classList.contains('is-open');
  setSettingsOpen(!isOpen);
}

function setImageSource(url, { forceRefresh = false } = {}) {
  if (!trendingImage) {
    return;
  }

  if (forceRefresh) {
    // Clearing first ensures the browser requests the new asset even if the
    // URL matches the previous one or the cached image is still in memory.
    trendingImage.src = '';
  }

  trendingImage.src = url;
}

async function fetchTrendingMeme(resetCursor = false) {
  if (!nextTrendingButton || !trendingCard) {
    return;
  }

  if (trendingLoading) {
    return;
  }

  resetAnalysisPanel();
  if (analyzeButton) {
    analyzeButton.disabled = true;
  }

  if (resetCursor) {
    trendingAfter = null;
  }

  trendingLoading = true;
  nextTrendingButton.disabled = true;
  trendingCard.classList.remove('is-hidden');
  setLoadingOverlay(true);
  setTrendingStatus('');

  const params = new URLSearchParams();
  if (offlineMode) {
    params.set('offline', 'true');
  } else if (trendingAfter) {
    params.set('after', trendingAfter);
  }

  const queryString = params.toString();
  const url = `${API_BASE_URL}/memes/trending${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      let message = 'Failed to fetch trending meme';
      try {
        const body = await response.json();
        message = body?.error || message;
      } catch {
        // Ignore parse errors and keep the default message.
      }
      throw new Error(message);
    }

    const payload = await response.json();
    const meme = payload?.data;
    const page = payload?.page;

    if (!meme || !meme.imageUrl) {
      throw new Error('Trending meme response is missing data');
    }

    if (!offlineMode && page?.offline !== true) {
      trendingAfter = page?.after ?? null;
    } else {
      trendingAfter = null;
    }

    const forceRefresh = offlineMode || page?.offline === true;

    setImageSource(meme.imageUrl, { forceRefresh });
    trendingImage.alt = meme.title || 'Trending meme';
    trendingTitle.textContent = meme.title || 'Untitled meme';
    trendingAuthor.textContent = meme.author ? `u/${meme.author}` : 'unknown';
    trendingUps.textContent = typeof meme.ups === 'number' ? meme.ups.toLocaleString() : '0';
    trendingLink.href = meme.permalink || '#';
    trendingLink.textContent = page?.offline === true ? 'View cached copy' : 'View source';

    currentMeme = { title: meme.title || '', imageUrl: meme.imageUrl || '', sourceOffline: offlineMode || page?.offline === true };
    if (analyzeButton) {
      analyzeButton.disabled = false;
    }

    trendingCard.classList.remove('is-hidden');

    if (page?.offline === true || offlineMode) {
      const origin = page?.offline === true ? 'Offline cache active.' : 'Offline mode enabled.';
      const reason = page?.reason ? `${page.reason}.` : '';
      const message = `${origin} ${reason}`.trim() || 'Offline mode';
      setTrendingStatus(`${origin} ${reason} Showing cached meme.`.trim(), false);
      setOfflineIndicator(true, message);
    } else {
      setTrendingStatus('');
      setOfflineIndicator(false);
    }
  } catch (error) {
    console.error(error);
    setTrendingStatus(error.message, true);
  } finally {
    trendingLoading = false;
    if (nextTrendingButton) {
      nextTrendingButton.disabled = false;
    }
    if (analyzeButton) {
      analyzeButton.disabled = !currentMeme;
    }
    setLoadingOverlay(false);
  }
}

async function analyzeMeme(meme) {
  if (!meme || (!meme.title && !meme.imageUrl)) {
    return;
  }

  showAnalysisLoading();
  if (analyzeButton) {
    analyzeButton.disabled = true;
  }

  try {
    const offline = Boolean(meme.sourceOffline || offlineMode);
    const response = await fetch(`${API_BASE_URL}/memes/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: meme.title,
        imageUrl: meme.imageUrl,
        sourceOffline: offline,
        offline
      })
    });

    if (!response.ok) {
      let message = 'Analysis failed';
      try {
        const body = await response.json();
        message = body?.error || message;
      } catch {
        // ignore JSON parse errors
      }
      throw new Error(message);
    }

    const payload = await response.json();
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

if (nextTrendingButton) {
  nextTrendingButton.addEventListener('click', () => {
    fetchTrendingMeme();
  });
}

if (analyzeButton) {
  analyzeButton.addEventListener('click', () => {
    if (!currentMeme) {
      setTrendingStatus('Fetch a meme first to analyze.', true);
      return;
    }

    analyzeMeme(currentMeme);
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

if (settingsToggle) {
  settingsToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleSettingsMenu();
  });
}

if (toggleOfflineButton) {
  toggleOfflineButton.addEventListener('click', (event) => {
    event.stopPropagation();
    offlineMode = !offlineMode;
    updateOfflineToggle();

    const statusMessage = offlineMode
      ? 'Offline mode enabled. Serving memes from cache.'
      : 'Back online. Fetching memes from Reddit.';

    setTrendingStatus(statusMessage, false);
    setOfflineIndicator(offlineMode, offlineMode ? 'Offline mode enabled' : undefined);
    setSettingsOpen(false);
    fetchTrendingMeme(true);
  });

  updateOfflineToggle();
}

if (settingsContainer) {
  document.addEventListener('click', (event) => {
    if (!settingsContainer.classList.contains('is-open')) {
      return;
    }

    if (!settingsContainer.contains(event.target)) {
      setSettingsOpen(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && settingsContainer.classList.contains('is-open')) {
      setSettingsOpen(false);
    }
  });
}

fetchTrendingMeme();
