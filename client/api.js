import { API_BASE_URL } from './constants.js';

async function parseError(response, fallbackMessage) {
  let message = fallbackMessage;
  try {
    const body = await response.json();
    message = body?.error || message;
  } catch {
    // Ignore parse errors and keep the fallback message.
  }
  return new Error(message);
}

export async function getTrending({ after, query } = {}) {
  const params = new URLSearchParams();
  if (after) {
    params.set('after', after);
  }
  if (query) {
    params.set('q', query);
  }
  const queryString = params.toString();
  const url = `${API_BASE_URL}/memes/trending${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw await parseError(response, 'Failed to fetch trending meme');
  }

  return response.json();
}

export async function analyzeMeme({ title, imageUrl }) {
  const response = await fetch(`${API_BASE_URL}/memes/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, imageUrl })
  });

  if (!response.ok) {
    throw await parseError(response, 'Analysis failed');
  }

  return response.json();
}

export async function remixMeme({ imageUrl, instructions }) {
  const response = await fetch(`${API_BASE_URL}/memes/remix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl, instructions })
  });

  if (!response.ok) {
    throw await parseError(response, 'Remix failed');
  }

  return response.json();
}
