const { pool } = require("../storage/db");
const { embedText } = require("../utils/embeddings");

async function generateAnswer(projectId, question, documentIdsOverride = null) {
  const documentIds = documentIdsOverride ?? (
    (await pool.query("SELECT document_ids FROM projects WHERE id=$1", [projectId])).rows[0]?.document_ids || []
  );
  if (!documentIds.length) {
    return {
      answerText: "No relevant data found in indexed documents.",
      isAnswerable: false,
      confidence: 0.1,
      citations: [],
    };
  }

  const vector = embedText(question.text);
  const vectorLiteral = `[${vector.join(",")}]`;
  const result = await pool.query(
    "SELECT id, document_id, text, embedding <-> $1::vector as distance FROM document_chunks WHERE document_id = ANY($2) ORDER BY embedding <-> $1::vector LIMIT 5",
    [vectorLiteral, documentIds],
  );
  if (!result.rows.length) {
    return {
      answerText: "No relevant data found in indexed documents.",
      isAnswerable: false,
      confidence: 0.1,
      citations: [],
    };
  }
  const best = result.rows[0];
  const score = Math.max(0, 1 - Number(best.distance));
  return {
    answerText: best.text.slice(0, 600),
    isAnswerable: true,
    confidence: Math.min(0.9, 0.6 + score * 0.4),
    citations: [
      {
        chunk_id: best.id,
        document_id: best.document_id,
        excerpt: best.text.slice(0, 400),
        score,
      },
    ],
  };
}

module.exports = {
  generateAnswer,
};
