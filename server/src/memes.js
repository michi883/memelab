import fetch from 'node-fetch';
import { mockMemes } from './data/mockMemes.js';
import { offlineMemes } from './data/offlineMemes.js';

const REDDIT_HOT_URL = 'https://www.reddit.com/r/memes/hot.json';
let offlineIndex = 0;

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

export async function getTrendingMeme(req, res) {
  const offlineRequested = req.query.offline === 'true';

  if (offlineRequested) {
    return respondWithOfflineMeme(req, res);
  }

  const { after } = req.query;
  const url = new URL(REDDIT_HOT_URL);
  url.searchParams.set('limit', '5');
  url.searchParams.set('raw_json', '1');
  if (after) {
    url.searchParams.set('after', after);
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MemeLabStarter/0.1 (contact: dev@meme.lab)'
      }
    });

    if (!response.ok) {
      console.warn('Reddit request failed with status', response.status);
      return respondWithOfflineMeme(req, res, 'Reddit request failed');
    }

    const payload = await response.json();
    const children = payload?.data?.children ?? [];
    const listingAfter = payload?.data?.after ?? null;

    const imagePost = children
      .map((child) => child?.data)
      .find((post) => isImagePost(post));

    if (!imagePost) {
      return respondWithOfflineMeme(req, res, 'No image meme found in this batch');
    }

    const nextAfter = typeof imagePost.name === 'string' ? imagePost.name : listingAfter;
    const imageUrl = selectImageUrl(imagePost);

    const meme = {
      id: imagePost.id,
      title: imagePost.title,
      imageUrl,
      author: imagePost.author,
      ups: imagePost.ups,
      permalink: `https://www.reddit.com${imagePost.permalink}`,
      createdAt: new Date(imagePost.created_utc * 1000).toISOString()
    };

    res.json({ data: meme, page: { after: nextAfter, offline: false } });
  } catch (error) {
    console.error('Failed to fetch trending meme:', error);
    return respondWithOfflineMeme(req, res, 'Failed to fetch trending meme');
  }
}

export async function analyzeMeme(req, res) {
  const { title = '', imageUrl = '', offline = false, sourceOffline = false } = req.body || {};

  if (!title && !imageUrl) {
    return res.status(400).json({ error: 'Provide a meme title or imageUrl for analysis' });
  }

  const offlineRequested = Boolean(offline || sourceOffline);
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY);
  const shouldUseGPT = !offlineRequested && hasApiKey;

  let analysis;

  if (shouldUseGPT) {
    try {
      analysis = await fetchAnalysisFromGPT(title, imageUrl);
    } catch (error) {
      console.error('GPT-5 analysis failed:', error);
      analysis = buildMockAnalysis(title, imageUrl);
      const reasonMessage = error.message ? `GPT-5 error: ${error.message}` : 'GPT-5 analysis failed';
      analysis.meta = {
        ...(analysis.meta || {}),
        provider: 'mock',
        fallback: true,
        reason: reasonMessage
      };
    }
  } else {
    analysis = buildMockAnalysis(title, imageUrl);
    const reasons = [];
    if (offlineRequested) {
      reasons.push('offline mode');
    }
    if (!hasApiKey) {
      reasons.push('missing API key');
    }
    if (reasons.length) {
      analysis.meta = {
        ...(analysis.meta || {}),
        provider: 'mock',
        fallback: true,
        reason: reasons.join(' & ')
      };
    }
  }

  res.json({ data: analysis });
}

function respondWithOfflineMeme(req, res, reason) {
  const meme = nextOfflineMeme(req);

  if (!meme) {
    const errorMessage = reason || 'Offline cache is empty';
    return res.status(502).json({ error: errorMessage });
  }

  const page = { after: null, offline: true };
  if (reason) {
    page.reason = reason;
  }

  return res.json({ data: meme, page });
}

function nextOfflineMeme(req) {
  if (!offlineMemes.length) {
    return null;
  }

  const meme = offlineMemes[offlineIndex];
  offlineIndex = (offlineIndex + 1) % offlineMemes.length;

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const relativePath = `/static/cache/${meme.fileName}`;

  return {
    id: meme.id,
    title: meme.title,
    imageUrl: `${baseUrl}${relativePath}`,
    author: meme.author,
    ups: meme.ups,
    permalink: `${baseUrl}${relativePath}`,
    createdAt: meme.createdAt
  };
}

function buildMockAnalysis(title, imageUrl) {
  const normalizedTitle = String(title || '').toLowerCase();
  const normalizedImageUrl = String(imageUrl || '').toLowerCase();

  const formatTags = pickFormatTags(normalizedTitle, normalizedImageUrl);
  const cognitiveTags = pickCognitiveTags(normalizedTitle, normalizedImageUrl);
  const emotionalTags = pickEmotionalTags(normalizedTitle);

  const tags = [...new Set([...formatTags, ...cognitiveTags, ...emotionalTags])].slice(0, 3);
  const summary = composeSummary(title, formatTags, cognitiveTags, emotionalTags);

  return {
    meme: { title, imageUrl },
    categories: {
      format: formatTags,
      cognitive: cognitiveTags,
      emotional: emotionalTags
    },
    tags,
    summary,
    source: 'mock',
    meta: {
      provider: 'mock',
      fallback: false
    }
  };
}

async function fetchAnalysisFromGPT(title, imageUrl) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
  const promptLines = [
    "You are Meme Lab's Humor Genome analyst.",
    'Classify the meme using only the predefined label sets for format, cognitive style, and emotional tone.',
    `Format options: ${FORMAT_TAGS.join(', ')}`,
    `Cognitive options: ${COGNITIVE_TAGS.join(', ')}`,
    `Emotional options: ${EMOTIONAL_TAGS.join(', ')}`,
    'Output strictly as JSON in this shape:',
    '{ "summary": string, "categories": { "format": string[], "cognitive": string[], "emotional": string[] }, "tags": string[] }',
    'Only choose labels from the provided lists; omit unknown labels.',
    "The summary should be one sentence explaining the meme's humor, referencing the visuals and/or title as needed."
  ];

  const content = [
    {
      type: 'input_text',
      text: promptLines.join(' ')
    },
    {
      type: 'input_text',
      text: `Title: ${title || 'unknown'}.`
    }
  ];

  if (imageUrl) {
    content.push({ type: 'input_image', image_url: imageUrl });
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'user',
          content
        }
      ]
    })
  });

  if (!response.ok) {
    const errorBody = await safeReadJSON(response);
    const message = errorBody?.error?.message || `GPT request failed with status ${response.status}`;
    throw new Error(message);
  }

  const body = await response.json();
  const outputText = extractTextFromResponse(body);
  const parsed = parseJsonFromText(outputText);
  const formatTags = normalizeCategoryList(parsed?.categories?.format || parsed?.format, FORMAT_TAGS);
  const cognitiveTags = normalizeCategoryList(parsed?.categories?.cognitive || parsed?.cognitive, COGNITIVE_TAGS);
  const emotionalTags = normalizeCategoryList(parsed?.categories?.emotional || parsed?.emotional, EMOTIONAL_TAGS);
  const extraTags = normalizeCategoryList(parsed?.tags, ALL_TAGS);

  const tags = [...new Set([...formatTags, ...cognitiveTags, ...emotionalTags, ...extraTags])].slice(0, 3);

  if (!tags.length) {
    throw new Error('GPT-5 returned no recognizable tags');
  }

  const summary = typeof parsed?.summary === 'string' && parsed.summary.trim()
    ? parsed.summary.trim()
    : composeSummary(title, formatTags, cognitiveTags, emotionalTags);

  return {
    meme: { title, imageUrl },
    categories: {
      format: formatTags,
      cognitive: cognitiveTags,
      emotional: emotionalTags
    },
    tags,
    summary,
    source: 'gpt-5',
    meta: {
      provider: 'gpt-5',
      fallback: false
    }
  };
}

async function downloadImageAsBase64(imageUrl) {
  if (!imageUrl) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(imageUrl, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    const byteLength = buffer.byteLength;
    const maxBytes = 1.5 * 1024 * 1024; // roughly 1.5MB
    if (!byteLength || byteLength > maxBytes) {
      return null;
    }

    return Buffer.from(buffer).toString('base64');
  } catch (error) {
    return null;
  }
}

async function safeReadJSON(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

function extractTextFromResponse(body) {
  if (!body) {
    return '';
  }

  if (typeof body.output_text === 'string' && body.output_text.trim()) {
    return body.output_text.trim();
  }

  const dataText = body?.data?.[0]?.content?.[0]?.text;
  if (typeof dataText === 'string' && dataText.trim()) {
    return dataText.trim();
  }

  const outputEntries = Array.isArray(body?.output) ? body.output : [];
  for (const entry of outputEntries) {
    if (entry && typeof entry.text === 'string' && entry.text.trim()) {
      return entry.text.trim();
    }

    if (entry?.type === 'message' && Array.isArray(entry.content)) {
      for (const part of entry.content) {
        const textValue = extractTextFromPart(part);
        if (textValue) {
          return textValue;
        }
      }
    }
  }

  const choices = Array.isArray(body?.choices) ? body.choices : [];
  for (const choice of choices) {
    const content = choice?.message?.content;
    if (Array.isArray(content)) {
      for (const part of content) {
        const textValue = extractTextFromPart(part);
        if (textValue) {
          return textValue;
        }
      }
    } else if (typeof content === 'string' && content.trim()) {
      return content.trim();
    }
  }

  return '';
}

function extractTextFromPart(part) {
  if (!part) {
    return '';
  }

  if (typeof part === 'string' && part.trim()) {
    return part.trim();
  }

  if (typeof part.text === 'string' && part.text.trim()) {
    return part.text.trim();
  }

  if (part?.text && typeof part.text.value === 'string' && part.text.value.trim()) {
    return part.text.value.trim();
  }

  if (typeof part.value === 'string' && part.value.trim()) {
    return part.value.trim();
  }

  return '';
}

function parseJsonFromText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    throw new Error('Empty response from GPT-5');
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Unable to parse GPT-5 response as JSON');
  }
}

function normalizeCategoryList(value, allowed) {
  const allowedMap = new Map(allowed.map((tag) => [tag.toLowerCase(), tag]));
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
      ? value.split(',')
      : [];

  const normalized = [];
  list.forEach((item) => {
    const cleaned = String(item || '').trim();
    if (!cleaned) {
      return;
    }
    const lower = cleaned.toLowerCase();
    let match = allowedMap.get(lower) || TAG_SYNONYMS.get(lower);

    if (!match) {
      for (const [key, valueTag] of TAG_SYNONYMS.entries()) {
        if (lower.includes(key)) {
          match = valueTag;
          break;
        }
      }
    }

    if (!match) {
      for (const [key, valueTag] of allowedMap.entries()) {
        if (lower.includes(key)) {
          match = valueTag;
          break;
        }
      }
    }

    if (match && !normalized.includes(match)) {
      normalized.push(match);
    }
  });

  return normalized;
}

const FORMAT_PHRASES = {
  'Reaction': 'a reaction-style setup',
  'Dialogue': 'a two-voice dialogue layout',
  'Narrative': 'a storyboard-style progression',
  'Absurdist Visual': 'an absurd visual punchline',
  'Juxtaposition': 'a split-frame contrast'
};

const COGNITIVE_PHRASES = {
  'Literal': 'a literal punchline',
  'Wordplay': 'a wordplay twist',
  'Subversion': 'a bait-and-switch twist',
  'Meta': 'a self-aware meta joke',
  'Exaggeration': 'an over-the-top exaggeration'
};

const EMOTIONAL_PHRASES = {
  'Wholesome': 'warm wholesome lift',
  'Playful': 'playful energy',
  'Sarcastic': 'biting sarcasm',
  'Self-Deprecating': 'self-deprecating shrug',
  'Dark': 'dark edge'
};

function composeSummary(title, formatTags, cognitiveTags, emotionalTags) {
  const subject = title && String(title).trim() ? `“${String(title).trim()}”` : 'This meme';
  const formatPhrase = describeFormat(formatTags);
  const cognitivePhrase = describeCognitive(cognitiveTags);
  const emotionalPhrase = describeEmotional(emotionalTags);

  const clauses = [];
  if (formatPhrase) {
    clauses.push(`uses ${formatPhrase}`);
  }
  if (cognitivePhrase) {
    clauses.push(`leans on ${cognitivePhrase}`);
  }
  if (emotionalPhrase) {
    clauses.push(`lands with a ${emotionalPhrase} vibe`);
  }

  if (!clauses.length) {
    return `${subject} delivers a quick laugh.`;
  }

  return `${subject} ${joinClauses(clauses)}.`;
}

function describeFormat(tags) {
  return joinList((tags || []).map((tag) => FORMAT_PHRASES[tag]).filter(Boolean));
}

function describeCognitive(tags) {
  return joinList((tags || []).map((tag) => COGNITIVE_PHRASES[tag]).filter(Boolean));
}

function describeEmotional(tags) {
  return joinList((tags || []).map((tag) => EMOTIONAL_PHRASES[tag]).filter(Boolean));
}

function joinList(items) {
  const list = [...new Set(items.filter(Boolean))];
  if (!list.length) {
    return '';
  }
  if (list.length === 1) {
    return list[0];
  }
  if (list.length === 2) {
    return `${list[0]} and ${list[1]}`;
  }
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
}

function joinClauses(clauses) {
  const list = clauses.filter(Boolean);
  if (!list.length) {
    return '';
  }
  if (list.length === 1) {
    return list[0];
  }
  if (list.length === 2) {
    return `${list[0]} and ${list[1]}`;
  }
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
}

const FORMAT_TAGS = [
  'Reaction',
  'Dialogue',
  'Narrative',
  'Absurdist Visual',
  'Juxtaposition'
];

const COGNITIVE_TAGS = [
  'Literal',
  'Wordplay',
  'Subversion',
  'Meta',
  'Exaggeration'
];

const EMOTIONAL_TAGS = [
  'Wholesome',
  'Playful',
  'Sarcastic',
  'Self-Deprecating',
  'Dark'
];

const TAG_SYNONYMS = new Map([
  ['absurd', 'Absurdist Visual'],
  ['absurdist', 'Absurdist Visual'],
  ['surreal', 'Absurdist Visual'],
  ['reaction', 'Reaction'],
  ['reaction shot', 'Reaction'],
  ['dialog', 'Dialogue'],
  ['conversation', 'Dialogue'],
  ['two panel', 'Juxtaposition'],
  ['contrast', 'Juxtaposition'],
  ['story', 'Narrative'],
  ['storytelling', 'Narrative'],
  ['pun', 'Wordplay'],
  ['word play', 'Wordplay'],
  ['twist', 'Subversion'],
  ['meta', 'Meta'],
  ['self aware', 'Meta'],
  ['exaggerated', 'Exaggeration'],
  ['literal', 'Literal'],
  ['wholesome', 'Wholesome'],
  ['heartwarming', 'Wholesome'],
  ['playful', 'Playful'],
  ['silly', 'Playful'],
  ['sarcasm', 'Sarcastic'],
  ['snarky', 'Sarcastic'],
  ['self deprecating', 'Self-Deprecating'],
  ['self-deprecating', 'Self-Deprecating'],
  ['dark', 'Dark'],
  ['edgy', 'Dark'],
  ['nihilistic', 'Dark']
]);

const ALL_TAGS = [...FORMAT_TAGS, ...COGNITIVE_TAGS, ...EMOTIONAL_TAGS];

function pickFormatTags(title, imageUrl = '') {
  const tags = new Set();
  const text = String(title || '');
  const url = String(imageUrl || '');

  if (/(pov|when|my face when|me )/i.test(text) || /^me[^a-z]/i.test(text)) {
    tags.add('Reaction');
  }

  if (/(vs\.?|versus|against|before and after|side by side|split screen|comparison)/i.test(text) || /two[-\s]?panel|split/i.test(text)) {
    tags.add('Juxtaposition');
  }

  if (/(story|chapter|episode|journey|quest|arc|progress|timeline|panel)/i.test(text) || /comic|storyboard|timeline/.test(url)) {
    tags.add('Narrative');
  }

  if (/(dialogue|dialog|chat|chatgpt|conversation|text thread|group chat)/i.test(text) || /me:|you:|them:/i.test(text) || (text.match(/"/g) || []).length >= 4) {
    tags.add('Dialogue');
  }

  if (/(absurd|surreal|dream|void|chaos|nonsense)/i.test(text)) {
    tags.add('Absurdist Visual');
  }

  if (!tags.size) {
    if (/reaction/i.test(text)) {
      tags.add('Reaction');
    } else if (/chat|dialog/i.test(text)) {
      tags.add('Dialogue');
    } else if (/story|panel/i.test(text)) {
      tags.add('Narrative');
    } else {
      tags.add('Absurdist Visual');
    }
  }

  return Array.from(tags).slice(0, 2);
}

function pickCognitiveTags(title, imageUrl = '') {
  const text = String(title || '');
  const tags = new Set();

  if (/(pun|wordplay|play on words|double meaning|dad joke|homophone)/i.test(text)) {
    tags.add('Wordplay');
  }
  if (/(meta|fourth wall|self-aware|about the meme|template joke|breaking the format)/i.test(text)) {
    tags.add('Meta');
  }
  if (/(twist|plot twist|unexpected|surprise|but then|however|bait and switch)/i.test(text)) {
    tags.add('Subversion');
  }
  if (/(exagger|literally|soooo|super|mega|over the top|infinite|million|1000|hyperbole)/i.test(text)) {
    tags.add('Exaggeration');
  }
  if (/(explain|just)/i.test(text) && !tags.size) {
    tags.add('Literal');
  }

  if (!tags.size) {
    tags.add('Literal');
  }

  return Array.from(tags).slice(0, 2);
}

function pickEmotionalTags(title) {
  const text = String(title || '');
  const tags = new Set();

  if (/(wholesome|heartwarming|pure|wholesomeness)/i.test(text)) {
    tags.add('Wholesome');
  }
  if (/(lol|haha|lmao|rofl|silly|goofy|playful|chaotic|funny)/i.test(text)) {
    tags.add('Playful');
  }
  if (/(sarcasm|sarcastic|snark|mock|eye roll|ironic|deadpan)/i.test(text)) {
    tags.add('Sarcastic');
  }
  if (/(self-deprecating|self deprecating|i'm the problem|i am the problem|i ruin|i fail|my fault)/i.test(text)) {
    tags.add('Self-Deprecating');
  }
  if (/(dark|edgy|nihil|doom|apocalypse|bleak|grim|void|kill|dead)/i.test(text)) {
    tags.add('Dark');
  }

  if (!tags.size) {
    if (/heart| wholesome/i.test(text)) {
      tags.add('Wholesome');
    } else {
      tags.add('Playful');
    }
  }

  return Array.from(tags).slice(0, 2);
}

function isImagePost(post) {
  if (!post) {
    return false;
  }

  if (post.post_hint === 'image') {
    return true;
  }

  const url = post.url_overridden_by_dest || post.url;
  return typeof url === 'string' && /(\.jpeg|\.jpg|\.png|\.gif)$/i.test(url);
}

function selectImageUrl(post) {
  const rawUrl = post.url_overridden_by_dest || post.url || post?.preview?.images?.[0]?.source?.url;
  return typeof rawUrl === 'string' ? rawUrl.replace(/&amp;/g, '&') : '';
}
