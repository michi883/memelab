const API_BASE_URL = 'http://localhost:5000/api';
const memeList = document.getElementById('meme-list');
const memeTemplate = document.getElementById('meme-template');
const memeForm = document.getElementById('meme-form');
const yearBadge = document.getElementById('year');

if (yearBadge) {
  yearBadge.textContent = String(new Date().getFullYear());
}

async function fetchMemes() {
  try {
    const response = await fetch(`${API_BASE_URL}/memes`);
    if (!response.ok) {
      throw new Error('Failed to fetch memes');
    }

    const { data } = await response.json();
    renderMemes(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error(error);
    renderMemes([]);
  }
}

function renderMemes(memes) {
  memeList.innerHTML = '';

  if (!memes.length) {
    memeList.innerHTML = '<p>No memes yet. Start by adding one above!</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  memes.forEach((meme) => {
    const clone = memeTemplate.content.cloneNode(true);
    const image = clone.querySelector('[data-role="image"]');
    const title = clone.querySelector('[data-role="title"]');
    const timestamp = clone.querySelector('[data-role="timestamp"]');

    image.src = meme.imageUrl;
    image.alt = meme.title;
    title.textContent = meme.title;
    timestamp.textContent = new Date(meme.createdAt).toLocaleString();

    fragment.appendChild(clone);
  });

  memeList.appendChild(fragment);
}

memeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(memeForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch(`${API_BASE_URL}/memes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error || 'Could not create meme');
    }

    memeForm.reset();
    fetchMemes();
  } catch (error) {
    alert(error.message);
  }
});

fetchMemes();
