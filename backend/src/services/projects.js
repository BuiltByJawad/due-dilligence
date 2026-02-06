const { v4: uuidv4 } = require("uuid");
const { pool } = require("../storage/db");
const { ANSWER_STATUS, PROJECT_STATUS, REQUEST_STATUS } = require("../models/status");
const { parseQuestionnaire } = require("./questionnaire");
const { generateAnswer } = require("./answers");
const { listDocuments } = require("./documents");

const ANSWER_BATCH_SIZE = 250;
const ANSWER_CONCURRENCY = 10;

function chunkArray(values, size) {
  const chunks = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

async function insertAnswersBatch(projectId, answers) {
  if (!answers.length) return;
  const now = new Date();
  const values = [];
  const placeholders = answers.map((answer, idx) => {
    const base = idx * 11;
    values.push(
      answer.id,
      projectId,
      answer.question_id,
      answer.answer_text,
      answer.is_answerable,
      answer.confidence,
      JSON.stringify(answer.citations),
      ANSWER_STATUS.DRAFT,
      now,
      now,
      null,
    );
    return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11})`;
  });
  await pool.query(
    `INSERT INTO answers (id, project_id, question_id, answer_text, is_answerable, confidence, citations, status, created_at, updated_at, manual_answer) VALUES ${placeholders.join(",")}`,
    values,
  );
}

async function listProjects() {
  const result = await pool.query("SELECT * FROM projects ORDER BY created_at DESC");
  return result.rows;
}

async function getProjectRecord(projectId) {
  const projectResult = await pool.query("SELECT * FROM projects WHERE id=$1", [projectId]);
  const project = projectResult.rows[0] ?? null;
  const questions = (await pool.query("SELECT * FROM questions WHERE project_id=$1 ORDER BY order_index", [projectId])).rows;
  const answers = (await pool.query("SELECT * FROM answers WHERE project_id=$1", [projectId])).rows;
  return { project, questions, answers };
}

async function getProjectAnswersPage(projectId, limit, offset) {
  const projectResult = await pool.query("SELECT * FROM projects WHERE id=$1", [projectId]);
  const project = projectResult.rows[0] ?? null;
  if (!project) {
    return { project: null, questions: [], answers: [], totalQuestions: 0 };
  }
  const totalQuestions = Number(
    (await pool.query("SELECT COUNT(*) FROM questions WHERE project_id=$1", [projectId])).rows[0]?.count ?? 0,
  );
  const totalAnswers = Number(
    (await pool.query("SELECT COUNT(*) FROM answers WHERE project_id=$1", [projectId])).rows[0]?.count ?? 0,
  );
  const manualEdits = Number(
    (await pool.query("SELECT COUNT(*) FROM answers WHERE project_id=$1 AND manual_answer IS NOT NULL", [projectId])).rows[0]
      ?.count ?? 0,
  );
  const questions = (
    await pool.query(
      "SELECT * FROM questions WHERE project_id=$1 ORDER BY order_index LIMIT $2 OFFSET $3",
      [projectId, limit, offset],
    )
  ).rows;
  const questionIds = questions.map((question) => question.id);
  const answers = questionIds.length
    ? (await pool.query("SELECT * FROM answers WHERE project_id=$1 AND question_id = ANY($2)", [projectId, questionIds]))
        .rows
    : [];
  return { project, questions, answers, totalQuestions, totalAnswers, manualEdits };
}

async function getProject(projectId) {
  const projectResult = await pool.query("SELECT * FROM projects WHERE id=$1", [projectId]);
  return projectResult.rows[0] ?? null;
}

async function createProjectAsync(payload, requestId, onRequestUpdate) {
  const projectId = uuidv4();
  const now = new Date();
  const docs = payload.scope === "ALL_DOCS" ? (await listDocuments()).map((doc) => doc.id) : payload.document_ids || [];
  await pool.query(
    "INSERT INTO projects (id, name, questionnaire_document_id, status, scope, document_ids, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [projectId, payload.name, payload.questionnaire_document_id, PROJECT_STATUS.CREATING, payload.scope, JSON.stringify(docs), now, now],
  );

  setImmediate(async () => {
    try {
      const documentResult = await pool.query("SELECT text FROM documents WHERE id=$1", [payload.questionnaire_document_id]);
      const questionnaireText = documentResult.rows[0]?.text || "";
      const parsed = await parseQuestionnaire(questionnaireText);
      let orderIndex = 1;
      for (const question of parsed.questions) {
        await pool.query(
          "INSERT INTO questions (id, project_id, section, order_index, text) VALUES ($1, $2, $3, $4, $5)",
          [uuidv4(), projectId, question.section, orderIndex, question.text],
        );
        orderIndex += 1;
      }
      await pool.query("UPDATE projects SET status=$1, updated_at=$2 WHERE id=$3", [PROJECT_STATUS.READY, new Date(), projectId]);
      await onRequestUpdate(requestId, REQUEST_STATUS.SUCCESS);
    } catch (error) {
      await onRequestUpdate(requestId, REQUEST_STATUS.FAILED, error.message);
    }
  });

  return projectId;
}

async function updateProjectAsync(payload, requestId, onRequestUpdate) {
  const docs = payload.scope === "ALL_DOCS" ? (await listDocuments()).map((doc) => doc.id) : payload.document_ids || [];
  await pool.query(
    "UPDATE projects SET scope=$1, document_ids=$2, status=$3, updated_at=$4 WHERE id=$5",
    [payload.scope, JSON.stringify(docs), PROJECT_STATUS.UPDATING, new Date(), payload.project_id],
  );

  setImmediate(async () => {
    try {
      const questions = (await pool.query("SELECT * FROM questions WHERE project_id=$1 ORDER BY order_index", [payload.project_id])).rows;
      const documentIds = (
        await pool.query("SELECT document_ids FROM projects WHERE id=$1", [payload.project_id])
      ).rows[0]?.document_ids || [];
      await pool.query("DELETE FROM answers WHERE project_id=$1", [payload.project_id]);
      const answers = await mapWithConcurrency(questions, ANSWER_CONCURRENCY, async (question) => {
        const answerPayload = await generateAnswer(payload.project_id, question, documentIds);
        return {
          id: uuidv4(),
          question_id: question.id,
          answer_text: answerPayload.answerText,
          is_answerable: answerPayload.isAnswerable,
          confidence: answerPayload.confidence,
          citations: answerPayload.citations,
        };
      });
      for (const batch of chunkArray(answers, ANSWER_BATCH_SIZE)) {
        await insertAnswersBatch(payload.project_id, batch);
      }
      await pool.query("UPDATE projects SET status=$1, updated_at=$2 WHERE id=$3", [PROJECT_STATUS.READY, new Date(), payload.project_id]);
      await onRequestUpdate(requestId, REQUEST_STATUS.SUCCESS);
    } catch (error) {
      await onRequestUpdate(requestId, REQUEST_STATUS.FAILED, error.message);
    }
  });
}

async function generateAnswersAsync(payload, requestId, onRequestUpdate) {
  await pool.query("UPDATE projects SET status=$1, updated_at=$2 WHERE id=$3", [
    PROJECT_STATUS.UPDATING,
    new Date(),
    payload.project_id,
  ]);

  setImmediate(async () => {
    try {
      const questions = (await pool.query("SELECT * FROM questions WHERE project_id=$1 ORDER BY order_index", [payload.project_id])).rows;
      const documentIds = (
        await pool.query("SELECT document_ids FROM projects WHERE id=$1", [payload.project_id])
      ).rows[0]?.document_ids || [];
      await pool.query("DELETE FROM answers WHERE project_id=$1", [payload.project_id]);
      const answers = await mapWithConcurrency(questions, ANSWER_CONCURRENCY, async (question) => {
        const answerPayload = await generateAnswer(payload.project_id, question, documentIds);
        return {
          id: uuidv4(),
          question_id: question.id,
          answer_text: answerPayload.answerText,
          is_answerable: answerPayload.isAnswerable,
          confidence: answerPayload.confidence,
          citations: answerPayload.citations,
        };
      });
      for (const batch of chunkArray(answers, ANSWER_BATCH_SIZE)) {
        await insertAnswersBatch(payload.project_id, batch);
      }
      await pool.query("UPDATE projects SET status=$1, updated_at=$2 WHERE id=$3", [
        PROJECT_STATUS.READY,
        new Date(),
        payload.project_id,
      ]);
      await onRequestUpdate(requestId, REQUEST_STATUS.SUCCESS);
    } catch (error) {
      await onRequestUpdate(requestId, REQUEST_STATUS.FAILED, error.message);
    }
  });
}

module.exports = {
  listProjects,
  getProjectRecord,
  getProjectAnswersPage,
  getProject,
  createProjectAsync,
  updateProjectAsync,
  generateAnswersAsync,
};
