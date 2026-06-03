const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const DATA_DIR = path.join(os.homedir(), '.wiki-dx-viewer');
const EMBEDDINGS_DIR = path.join(DATA_DIR, 'embeddings');
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const MAX_CHARS_PER_PAGE = 8000;

let pipelineInstance = null;

async function getEmbedder() {
  if (!pipelineInstance) {
    const { pipeline } = await import('@xenova/transformers');
    pipelineInstance = await pipeline('feature-extraction', MODEL_NAME);
  }
  return pipelineInstance;
}

function contentHash(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function getIndexPath(wikiId) {
  return path.join(EMBEDDINGS_DIR, `${wikiId}.json`);
}

function loadIndex(wikiId) {
  const indexPath = getIndexPath(wikiId);
  if (!fs.existsSync(indexPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  } catch {
    return [];
  }
}

function saveIndex(wikiId, entries) {
  if (!fs.existsSync(EMBEDDINGS_DIR)) {
    fs.mkdirSync(EMBEDDINGS_DIR, { recursive: true });
  }
  fs.writeFileSync(getIndexPath(wikiId), JSON.stringify(entries));
}

async function getEmbedding(text) {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

async function getEmbeddings(texts) {
  const embedder = await getEmbedder();
  const results = [];
  for (const text of texts) {
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    results.push(Array.from(output.data));
  }
  return results;
}

/**
 * Index wiki pages. Only re-embeds pages whose content has changed.
 */
async function indexPages(wikiId, pages, { onProgress } = {}) {
  const existingIndex = loadIndex(wikiId);
  const existingMap = new Map(existingIndex.map(e => [e.path, e]));

  const needsEmbedding = [];
  const unchanged = [];

  for (const page of pages) {
    const text = prepareText(page.title, page.content);
    const hash = contentHash(text);
    const existing = existingMap.get(page.path);
    if (existing && existing.hash === hash) {
      unchanged.push(existing);
    } else {
      needsEmbedding.push({ path: page.path, title: page.title, text, hash });
    }
  }

  const newEntries = [];

  for (let i = 0; i < needsEmbedding.length; i++) {
    const item = needsEmbedding[i];
    const embedding = await getEmbedding(item.text);
    newEntries.push({
      path: item.path,
      title: item.title,
      hash: item.hash,
      embedding,
    });

    if (onProgress) {
      onProgress(i + 1, needsEmbedding.length);
    }
  }

  const finalIndex = [...unchanged, ...newEntries];
  saveIndex(wikiId, finalIndex);

  return { indexed: newEntries.length, skipped: unchanged.length, total: finalIndex.length };
}

function prepareText(title, content) {
  const text = `${title}\n\n${content}`;
  return text.slice(0, MAX_CHARS_PER_PAGE);
}

/**
 * Search pages by semantic similarity.
 */
async function searchByEmbedding(wikiId, query, { topK = 15 } = {}) {
  const index = loadIndex(wikiId);
  if (index.length === 0) return null;

  const queryEmbedding = await getEmbedding(query);

  const scored = index.map(entry => ({
    path: entry.path,
    title: entry.title,
    similarity: cosineSimilarity(queryEmbedding, entry.embedding),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}

/**
 * Search across all wikis by semantic similarity.
 */
async function searchAllWikisByEmbedding(wikiIds, query, { topK = 15 } = {}) {
  const queryEmbedding = await getEmbedding(query);

  let allScored = [];
  let anyIndexExists = false;

  for (const wikiId of wikiIds) {
    const index = loadIndex(wikiId);
    if (index.length === 0) continue;
    anyIndexExists = true;

    for (const entry of index) {
      allScored.push({
        path: entry.path,
        title: entry.title,
        wikiId,
        similarity: cosineSimilarity(queryEmbedding, entry.embedding),
      });
    }
  }

  if (!anyIndexExists) return null;

  allScored.sort((a, b) => b.similarity - a.similarity);
  return allScored.slice(0, topK);
}

function hasIndex(wikiId) {
  const indexPath = getIndexPath(wikiId);
  if (!fs.existsSync(indexPath)) return false;
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    return index.length > 0;
  } catch {
    return false;
  }
}

module.exports = {
  indexPages,
  searchByEmbedding,
  searchAllWikisByEmbedding,
  hasIndex,
  loadIndex,
  cosineSimilarity,
  getEmbedding,
  getEmbeddings,
  EMBEDDINGS_DIR,
};
