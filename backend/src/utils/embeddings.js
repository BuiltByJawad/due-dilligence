const crypto = require("crypto");

const EMBEDDING_DIM = 128;

function hashToken(token) {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return parseInt(hash.slice(0, 8), 16);
}

function embedText(text) {
  const vector = Array(EMBEDDING_DIM).fill(0);
  const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const index = hashToken(token) % EMBEDDING_DIM;
    vector[index] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return vector;
  }
  return vector.map((value) => value / norm);
}

module.exports = {
  EMBEDDING_DIM,
  embedText,
};
