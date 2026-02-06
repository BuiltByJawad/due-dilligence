const { v4: uuidv4 } = require("uuid");
const { pool } = require("../storage/db");
const { keywordOverlapScore } = require("../utils/text");

async function evaluateProject(projectId) {
  const answers = (await pool.query("SELECT * FROM answers WHERE project_id=$1", [projectId])).rows;
  const results = [];
  for (const answer of answers) {
    if (!answer.manual_answer) {
      continue;
    }
    const similarity = keywordOverlapScore(answer.manual_answer, answer.answer_text);
    const resultId = uuidv4();
    const now = new Date();
    const notes = "Keyword overlap between manual and AI answer.";
    await pool.query(
      "INSERT INTO evaluations (id, project_id, answer_id, human_answer, similarity_score, notes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [resultId, projectId, answer.id, answer.manual_answer, similarity, notes, now],
    );
    results.push({
      id: resultId,
      project_id: projectId,
      answer_id: answer.id,
      human_answer: answer.manual_answer,
      similarity_score: similarity,
      notes,
      created_at: now,
    });
  }
  return results;
}

module.exports = {
  evaluateProject,
};
