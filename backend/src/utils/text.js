const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function chunkText(text, maxLength = 500) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }
  const sentences = normalized.split(SENTENCE_SPLIT);
  const chunks = [];
  let buffer = "";
  for (const sentence of sentences) {
    if ((buffer + " " + sentence).trim().length > maxLength && buffer) {
      chunks.push(buffer.trim());
      buffer = sentence;
    } else {
      buffer = `${buffer} ${sentence}`.trim();
    }
  }
  if (buffer) {
    chunks.push(buffer.trim());
  }
  return chunks;
}

function keywordOverlapScore(text, query) {
  const tokens = new Set(normalizeText(text).toLowerCase().split(" "));
  const queryTokens = normalizeText(query).toLowerCase().split(" ");
  if (queryTokens.length === 0) {
    return 0;
  }
  let matches = 0;
  for (const token of queryTokens) {
    if (tokens.has(token)) {
      matches += 1;
    }
  }
  return matches / queryTokens.length;
}

module.exports = {
  chunkText,
  keywordOverlapScore,
  normalizeLines,
  normalizeText,
};
