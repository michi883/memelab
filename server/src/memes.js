import fetch from 'node-fetch';
import { mockMemes } from './data/mockMemes.js';

const REDDIT_HOT_URL = 'https://www.reddit.com/r/memes/hot.json';
const REDDIT_SEARCH_URL = 'https://www.reddit.com/r/memes/search.json';
const DEFAULT_IMAGE_MIME_TYPE = 'image/png';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-image-preview';

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
  const { after } = req.query;
  const rawQuery = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
  const query = rawQuery.slice(0, 120);
  const usingSearch = Boolean(query);
  const url = new URL(usingSearch ? REDDIT_SEARCH_URL : REDDIT_HOT_URL);
  const limit = usingSearch ? '20' : '5';

  url.searchParams.set('limit', limit);
  url.searchParams.set('raw_json', '1');

  if (usingSearch) {
    url.searchParams.set('q', query);
    url.searchParams.set('restrict_sr', '1');
    url.searchParams.set('sort', 'relevance');
    url.searchParams.set('t', 'all');
  }

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
      return res.status(502).json({ error: 'Reddit request failed' });
    }

    const payload = await response.json();
    const children = payload?.data?.children ?? [];
    const listingAfter = payload?.data?.after ?? null;

    const normalizedQuery = query.toLowerCase();

    const imagePost = children
      .map((child) => child?.data)
      .find((post) => isImagePost(post) && matchesQuery(post, normalizedQuery));

    if (!imagePost) {
      if (usingSearch) {
        return res.status(404).json({ error: `No memes found for "${query}". Try another keyword.` });
      }
      return res.status(502).json({ error: 'No image meme found in this batch' });
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

    return res.json({
      data: meme,
      page: { after: nextAfter },
      ...(usingSearch ? { query } : {}),
      capabilities: { remix: Boolean(GEMINI_API_KEY) }
    });
  } catch (error) {
    console.error('Failed to fetch trending meme:', error);
    return res.status(502).json({ error: 'Failed to fetch trending meme' });
  }
}

export async function analyzeMeme(req, res) {
  const { title = '', imageUrl = '' } = req.body || {};

  if (!imageUrl) {
    return res.status(400).json({ error: 'Provide a meme imageUrl for analysis.' });
  }

  if (!OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Analyzing memes requires a configured OpenAI API key.' });
  }

  try {
    const { base64, contentType } = await downloadImageAsBase64(imageUrl);

    if (!base64) {
      return res.status(502).json({ error: 'Failed to download meme image for analysis.' });
    }

    const analysis = await analyzeImageWithOpenAI({ title, imageUrl, base64, contentType });
    return res.json({ data: analysis });
  } catch (error) {
    console.error('Meme analysis failed:', error);
    return res.status(502).json({ error: 'Analysis failed. Please try again later.' });
  }
}

export async function remixMeme(req, res) {
  const { imageUrl = '', instructions = '' } = req.body || {};
  const trimmedInstructions = instructions.trim();

  if (!trimmedInstructions) {
    return res.status(400).json({ error: 'Remix instructions are required.' });
  }

  if (!imageUrl) {
    return res.status(400).json({ error: 'Original meme imageUrl is required.' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: 'Remixing requires a configured Gemini API key.' });
  }

  try {
    const { base64, contentType } = await downloadImageAsBase64(imageUrl);

    if (!base64) {
      return res.status(502).json({ error: 'Failed to fetch the original meme image for remixing.' });
    }

    const generation = await requestGeminiRemix({
      base64,
      contentType: contentType || DEFAULT_IMAGE_MIME_TYPE,
      instructions: trimmedInstructions
    });
    const remix = extractInlineImage(generation);

    if (!remix) {
      return res.status(502).json({ error: 'Gemini did not return a remixed image.' });
    }

    const remixMime = remix.mimeType || DEFAULT_IMAGE_MIME_TYPE;
    const dataUrl = `data:${remixMime};base64,${remix.data}`;

    return res.json({ editedImageUrl: dataUrl });
  } catch (error) {
    console.error('Remix failed:', error);
    return res.status(502).json({ error: 'Remix failed. Please try again later.' });
  }
}

function isImagePost(post) {
  if (!post) {
    return false;
  }

  if (post.post_hint === 'image') {
    return true;
  }

  const url = post?.url_overridden_by_dest || post?.url;
  return typeof url === 'string' && /(\.jpe?g|\.png|\.gif)$/i.test(url);
}

function selectImageUrl(post) {
  const rawUrl =
    post?.url_overridden_by_dest || post?.url || post?.preview?.images?.[0]?.source?.url;
  return typeof rawUrl === 'string' ? rawUrl.replace(/&amp;/g, '&') : '';
}

function matchesQuery(post, normalizedQuery) {
  if (!normalizedQuery) {
    return true;
  }

  const terms = normalizedQuery
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (!terms.length) {
    return true;
  }

  const title = (post?.title || '').toLowerCase();
  const selftext = (post?.selftext || '').toLowerCase();
  const flair = (post?.link_flair_text || '').toLowerCase();

  return terms.some((term) => title.includes(term) || selftext.includes(term) || flair.includes(term));
}

async function analyzeImageWithOpenAI({ title, imageUrl, base64, contentType }) {
  const systemPrompt =
    "You are Meme Lab's humor scientist. Analyze memes with playful, precise language and respond in JSON.";
  const instructions = [
    'Analyze the provided meme image.',
    'Reply with two lines only:',
    'Summary: <three concise sentence (<=100 words)>',
    'Tags: <up to 3 short descriptors separated by commas>'
  ];
  if (title) {
    instructions.push(`Meme title: ${title}`);
  }

  const dataUrl = `data:${contentType || DEFAULT_IMAGE_MIME_TYPE};base64,${base64}`;
  const attempts = [
    { label: 'structured-text', useSchema: false, extra: [] },
    {
      label: 'fallback-json',
      useSchema: false,
      extra: ['Respond ONLY with two lines: Summary: ..., Tags: tag1, tag2']
    }
  ];

  let parsed = null;
  let finalModelText = '';
  let finalRawBody = '';
  let finishReason = null;
  let successfulAttempt = null;

  for (const attempt of attempts) {
    const attemptInstructions = [...instructions, ...attempt.extra];
    debugLogAnalysis({ scope: 'attempt', label: attempt.label });
    const { payload, rawBody, status } = await callOpenAIForAnalysis({
      dataUrl,
      systemPrompt,
      instructions: attemptInstructions,
      useSchema: attempt.useSchema
    });

    finalRawBody = rawBody;
    finishReason = payload?.choices?.[0]?.finish_reason || null;
    debugLogAnalysis({
      scope: 'openai-response',
      attempt: attempt.label,
      status,
      finish_reason: finishReason,
      length: rawBody.length
    });

    const modelText = extractModelText(payload);
    finalModelText = modelText || '';
    debugLogAnalysis({ scope: 'model-text', attempt: attempt.label, snippet: finalModelText.slice(0, 200) });

    parsed = attempt.label === 'structured-text' ? parseStructuredText(finalModelText) : parseAnalysisText(finalModelText);
    if (parsed) {
      successfulAttempt = attempt.label;
      break;
    }

    debugLogAnalysis({
      scope: 'retry',
      attempt: attempt.label,
      message: 'parsed result empty',
      finish_reason: finishReason
    });
  }

  const fallback = buildFallbackAnalysis(title, imageUrl);
  const result = parsed || fallback;
  const usedFallback = !parsed;

  debugLogAnalysis({
    scope: 'result',
    fallback: usedFallback,
    attempt: successfulAttempt,
    finish_reason: finishReason
  });

  return {
    meme: { title, imageUrl },
    categories: { format: [], cognitive: [], emotional: [] },
    tags: result.tags,
    summary: result.summary,
    source: 'openai',
    meta: {
      provider: OPENAI_MODEL,
      fallback: usedFallback,
      attempt: successfulAttempt,
      ...(finishReason ? { finishReason } : {}),
      ...(usedFallback
        ? {
            reason:
              finishReason === 'length'
                ? 'model truncated output (length)'
                : 'parse failure after retries',
            raw: finalModelText || finalRawBody.slice(0, 400)
          }
        : {})
    }
  };
}

function extractModelText(payload) {
  const choice = payload?.choices?.[0];
  const content = choice?.message?.content ?? choice?.delta?.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (typeof part?.text === 'string') {
          return part.text;
        }
        if (typeof part?.content === 'string') {
          return part.content;
        }
        if (typeof part?.output_text === 'string') {
          return part.output_text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  return '';
}

function parseAnalysisText(text) {
  if (!text) {
    debugLogAnalysis({ scope: 'parse', message: 'empty content' });
    return null;
  }

  const attemptParse = (jsonString) => {
    const parsed = JSON.parse(jsonString);
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    const tags = Array.isArray(parsed.tags) ? parsed.tags.map((tag) => String(tag).trim()).filter(Boolean) : [];

    if (!summary) {
      return null;
    }

    return {
      summary,
      tags: tags.slice(0, 3)
    };
  };

  try {
    return attemptParse(cleanupJsonBlock(text));
  } catch (error) {
    debugLogAnalysis({ scope: 'parse', message: 'primary parse failed', error: error.message });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return attemptParse(jsonMatch[0]);
      } catch (innerError) {
        debugLogAnalysis({ scope: 'parse', message: 'fallback parse failed', error: innerError.message });
        return null;
      }
    }
    debugLogAnalysis({ scope: 'parse', message: 'no JSON pattern found' });
    return null;
  }
}

function parseStructuredText(text) {
  if (!text) {
    debugLogAnalysis({ scope: 'parse-structured', message: 'empty content' });
    return null;
  }

  // Try JSON first (allowing for capitalised keys)
  try {
    const cleaned = cleanupJsonBlock(text);
    if (cleaned.startsWith('{')) {
      const parsed = JSON.parse(cleaned);
      const summaryKey = Object.keys(parsed).find((key) => key.toLowerCase() === 'summary');
      const tagsKey = Object.keys(parsed).find((key) => key.toLowerCase() === 'tags');

      const summary = summaryKey ? String(parsed[summaryKey] || '').trim() : '';
      const tagsValue = tagsKey ? parsed[tagsKey] : [];
      const tags = Array.isArray(tagsValue)
        ? tagsValue.map((tag) => String(tag).trim()).filter(Boolean)
        : String(tagsValue || '')
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);

      if (summary) {
        return { summary, tags: tags.slice(0, 3) };
      }
    }
  } catch {
    // ignore JSON errors and fall through to regex parsing
  }

  const summaryMatch = text.match(/summary\s*[:\-]\s*(.+)/i);
  const tagsMatch = text.match(/tags\s*[:\-]\s*(.+)/i);

  const summary = summaryMatch ? summaryMatch[1].trim() : '';
  const tags = tagsMatch
    ? tagsMatch[1]
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  if (!summary) {
    debugLogAnalysis({ scope: 'parse-structured', message: 'missing summary', raw: text.slice(0, 200) });
    return null;
  }

  return { summary, tags };
}

function cleanupJsonBlock(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }

  const withoutFences = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  if (withoutFences.startsWith('{') && withoutFences.endsWith('}')) {
    return withoutFences;
  }

  const jsonMatch = withoutFences.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : withoutFences;
}

async function callOpenAIForAnalysis({ dataUrl, systemPrompt, instructions, useSchema }) {
  const body = {
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: instructions.join('\n') },
          { type: 'image_url', image_url: { url: dataUrl } }
        ]
      }
    ],
    max_completion_tokens: 512
  };

  if (useSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'meme_analysis',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['summary'],
          properties: {
            summary: {
              type: 'string',
              maxLength: 180
            },
            tags: {
              type: 'array',
              items: { type: 'string', maxLength: 40 },
              maxItems: 3
            }
          }
        }
      }
    };
  }

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(`OpenAI request failed (${response.status}): ${rawBody}`.trim());
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    throw new Error(`OpenAI returned non-JSON response: ${error.message}`);
  }

  return { payload, rawBody, status: response.status };
}

function buildFallbackAnalysis(title, imageUrl) {
  const summary = title
    ? `“${title}” delivers a quick laugh.`
    : 'This meme delivers a quick laugh.';

  return {
    summary,
    tags: ['Playful'],
    meme: { title, imageUrl }
  };
}

async function safeReadResponseText(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

async function downloadImageAsBase64(imageUrl) {
  if (!imageUrl) {
    return { base64: null, contentType: null };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(imageUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return { base64: null, contentType: null };
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || DEFAULT_IMAGE_MIME_TYPE;
    return { base64: Buffer.from(buffer).toString('base64'), contentType };
  } catch {
    return { base64: null, contentType: null };
  }
}

function extractInlineImage(result) {
  const candidates = result?.candidates || result?.response?.candidates || [];

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];
    for (const part of parts) {
      const inlineData = part?.inlineData;
      if (inlineData?.data) {
        return {
          data: inlineData.data,
          mimeType: inlineData.mimeType
        };
      }
    }
  }

  return null;
}

function debugLogAnalysis(details) {
  if (process.env.NODE_ENV === 'test' || process.env.DISABLE_ANALYSIS_DEBUG === 'true') {
    return;
  }

  const entry = {
    ts: new Date().toISOString(),
    ...details
  };

  console.log('[analysis-debug]', JSON.stringify(entry));
}

async function requestGeminiRemix({ base64, contentType, instructions }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_MODEL
  )}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: base64,
              mimeType: contentType
            }
          },
          {
            text: `Remix this meme while keeping it shareable and fun. Instructions: ${instructions}`
          }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ['IMAGE']
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const details = await safeReadResponseText(response);
    throw new Error(`Gemini request failed (${response.status}): ${details}`.trim());
  }

  return response.json();
}
