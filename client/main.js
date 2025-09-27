import { STATUS_MESSAGES } from './constants.js';
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
  toggleRemixLoading,
  animateRemixGallery,
  setImageSource,
  setRemixPanelVisibility
} from './ui.js';

const {
  trendingCard,
  trendingTitle,
  trendingAuthor,
  trendingUps,
  trendingLink,
  nextTrendingButton,
  analyzeButton,
  remixInput,
  infoToggle,
  remixToggleButton,
  remixPanel,
  remixFrame,
  remixVisual
} = elements;

let trendingAfter = null;
let trendingLoading = false;
let currentMeme = null;
let remixInProgress = false;
let remixSupported = false;

function clearCurrentMeme() {
  currentMeme = null;
  if (analyzeButton) {
    analyzeButton.disabled = true;
  }
  setRemixAvailability(false);
}

async function fetchTrendingMeme(resetCursor = false) {
  if (!nextTrendingButton || !trendingCard) {
    return;
  }

  if (trendingLoading) {
    return;
  }

  if (resetCursor) {
    trendingAfter = null;
  }

  resetAnalysisPanel();
  clearCurrentMeme();
  setTrendingStatus('');

  trendingLoading = true;
  nextTrendingButton.disabled = true;
  trendingCard.classList.remove('is-hidden');
  setLoadingOverlay(true);

  try {
    const afterParam = trendingAfter ? { after: trendingAfter } : undefined;
    const payload = await getTrending(afterParam);
    const meme = payload?.data;
    const page = payload?.page || {};
    remixSupported = Boolean(payload?.capabilities?.remix);

    if (!meme || !meme.imageUrl) {
      throw new Error('Trending meme response is missing data');
    }

    trendingAfter = page.after ?? null;

    setImageSource(meme.imageUrl);
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

    if (analyzeButton) {
      analyzeButton.disabled = false;
    }

    if (remixFrame) {
      remixFrame.classList.add('is-hidden');
    }
    if (remixVisual) {
      remixVisual.removeAttribute('src');
    }
    setRemixStatus(remixSupported ? '' : 'Remixing requires a configured Gemini API key.', !remixSupported);
    setRemixAvailability(remixSupported && Boolean(currentMeme.imageUrl));

    setTrendingStatus('');
  } catch (error) {
    console.error(error);
    setTrendingStatus(error.message || 'Failed to fetch trending meme', true);
  } finally {
    trendingLoading = false;
    if (nextTrendingButton) {
      nextTrendingButton.disabled = false;
    }
    if (analyzeButton) {
      analyzeButton.disabled = !currentMeme;
    }
    const canRemix = remixSupported && Boolean(currentMeme?.imageUrl);
    setRemixAvailability(canRemix);
    setLoadingOverlay(false);
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

    animateRemixGallery();
    setRemixStatus(STATUS_MESSAGES.remixReady);
  } catch (error) {
    console.error(error);
    setRemixStatus(error.message || STATUS_MESSAGES.remixFailed, true);
  } finally {
    remixInProgress = false;
    toggleRemixLoading(false);
  }
}

if (nextTrendingButton) {
  nextTrendingButton.addEventListener('click', () => {
    setRemixAvailability(false);
    fetchTrendingMeme();
  });
}

if (analyzeButton) {
  analyzeButton.addEventListener('click', () => {
    if (!currentMeme) {
      setTrendingStatus('Fetch a meme first to analyze.', true);
      return;
    }

    analyzeCurrentMeme(currentMeme);
  });
}

setRemixPanelVisibility(false);

function triggerRemix() {
  if (!currentMeme || !currentMeme.imageUrl) {
    setRemixStatus('Fetch a meme first to remix.', true);
    return;
  }

  if (!remixSupported) {
    setRemixStatus('Remixing requires a configured Gemini API key.', true);
    return;
  }

  const instructions = remixInput ? remixInput.value.trim() : '';
  if (!instructions) {
    setRemixStatus('Describe how you want to remix this meme.', true);
    if (remixInput) {
      remixInput.focus({ preventScroll: true });
    }
    return;
  }

  remixCurrentMeme(currentMeme, instructions);
}

if (remixInput) {
  remixInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      triggerRemix();
    }
  });
  remixInput.addEventListener('blur', () => {
    if (remixInput.value.trim()) {
      setRemixStatus('');
    }
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

fetchTrendingMeme();
setRemixAvailability(false);
