import { mockMemes } from '../data/mockMemes.js';

export function getMemes(req, res) {
  res.json({ data: mockMemes });
}

export function createMeme(req, res) {
  const { title, imageUrl } = req.body;

  if (!title || !imageUrl) {
    return res.status(400).json({ error: 'Both title and imageUrl are required' });
  }

  const newMeme = {
    id: String(Date.now()),
    title,
    imageUrl,
    createdAt: new Date().toISOString()
  };

  mockMemes.unshift(newMeme);

  res.status(201).json({ data: newMeme });
}
