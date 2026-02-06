const { v4: uuidv4 } = require("uuid");
const { chunkText } = require("../utils/text");
const { extractText } = require("./parsers");

function buildChunks(documentId, text) {
  return chunkText(text, 500).map((chunk) => ({
    id: uuidv4(),
    document_id: documentId,
    text: chunk,
  }));
}

module.exports = {
  buildChunks,
  extractText,
};
