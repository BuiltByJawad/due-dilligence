const fs = require("fs/promises");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../storage/db");
const { buildChunks, extractText } = require("../indexing/pipeline");
const { embedText } = require("../utils/embeddings");
const { PROJECT_STATUS, REQUEST_STATUS } = require("../models/status");

async function listDocuments() {
  const result = await pool.query("SELECT * FROM documents ORDER BY created_at DESC");
  return result.rows;
}

async function getDocument(documentId) {
  const result = await pool.query("SELECT * FROM documents WHERE id=$1", [documentId]);
  return result.rows[0] ?? null;
}

async function indexDocumentAsync(file, requestId, onRequestUpdate) {
  const documentId = uuidv4();
  const now = new Date();
  await pool.query(
    "INSERT INTO documents (id, filename, content_type, created_at, status, page_count, text_length, text) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [documentId, file.originalname, file.mimetype, now, REQUEST_STATUS.PENDING, 0, 0, ""],
  );

  setImmediate(async () => {
    try {
      const text = await extractText(file.path, file.mimetype);
      const chunks = buildChunks(documentId, text);
      await pool.query("DELETE FROM document_chunks WHERE document_id=$1", [documentId]);
      for (const chunk of chunks) {
        const embedding = embedText(chunk.text);
        const vectorLiteral = `[${embedding.join(",")}]`;
        await pool.query(
          "INSERT INTO document_chunks (id, document_id, text, embedding) VALUES ($1, $2, $3, $4::vector)",
          [chunk.id, documentId, chunk.text, vectorLiteral],
        );
      }
      await pool.query(
        "UPDATE documents SET status=$1, page_count=$2, text_length=$3, text=$4 WHERE id=$5",
        [REQUEST_STATUS.SUCCESS, 1, text.length, text, documentId],
      );
      await pool.query("UPDATE projects SET status=$1 WHERE scope='ALL_DOCS'", [PROJECT_STATUS.OUTDATED]);
      await onRequestUpdate(requestId, REQUEST_STATUS.SUCCESS);
    } catch (error) {
      await onRequestUpdate(requestId, REQUEST_STATUS.FAILED, error.message);
    } finally {
      await fs.unlink(file.path).catch(() => null);
    }
  });

  return documentId;
}

module.exports = {
  listDocuments,
  getDocument,
  indexDocumentAsync,
};
