const express = require("express");
const multer = require("multer");
const path = require("path");

const { pool } = require("../storage/db");
const { createRequest, updateRequest, getRequest } = require("../services/requests");
const { listDocuments, getDocument, indexDocumentAsync } = require("../services/documents");
const {
  listProjects,
  getProjectRecord,
  getProject,
  createProjectAsync,
  updateProjectAsync,
  generateAnswersAsync,
  getProjectAnswersPage,
} = require("../services/projects");
const { evaluateProject } = require("../services/evaluation");

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, "..", "..", "uploads") });

router.get("/", (req, res) => {
  res.json({ message: "Due Diligence Agent API" });
});

router.get("/health", (req, res) => {
  res.json({ ok: true });
});

router.get("/list-documents", async (req, res) => {
  const documents = await listDocuments();
  res.json({ documents });
});

router.get("/list-projects", async (req, res) => {
  const projects = await listProjects();
  res.json({ projects });
});

router.get("/get-document", async (req, res) => {
  const { document_id: documentId } = req.query;
  const document = await getDocument(documentId);
  if (!document) {
    res.status(404).json({ detail: "Document not found" });
    return;
  }
  res.json({ document });
});

router.get("/get-project-info", async (req, res) => {
  const { project_id: projectId } = req.query;
  const { project, questions, answers } = await getProjectRecord(projectId);
  res.json({ project, questions, answers });
});

router.get("/get-project-answers-page", async (req, res) => {
  const { project_id: projectId, limit, offset } = req.query;
  const pageLimit = Number(limit ?? 30);
  const pageOffset = Number(offset ?? 0);
  if (!projectId) {
    res.status(400).json({ detail: "project_id is required" });
    return;
  }
  const { project, questions, answers, totalQuestions, totalAnswers, manualEdits } = await getProjectAnswersPage(
    projectId,
    pageLimit,
    pageOffset,
  );
  if (!project) {
    res.status(404).json({ detail: "Project not found" });
    return;
  }
  res.json({
    project,
    questions,
    answers,
    total_questions: totalQuestions,
    total_answers: totalAnswers,
    manual_edits: manualEdits,
  });
});

router.get("/get-project-status", async (req, res) => {
  const { project_id: projectId } = req.query;
  const project = await getProject(projectId);
  if (!project) {
    res.status(404).json({ detail: "Project not found" });
    return;
  }
  res.json({ project_id: project.id, status: project.status });
});

router.get("/get-request-status", async (req, res) => {
  const { request_id: requestId } = req.query;
  const request = await getRequest(requestId);
  if (!request) {
    res.status(404).json({ detail: "Request not found" });
    return;
  }
  res.json({ request });
});

router.post("/index-document-async", upload.single("file"), async (req, res) => {
  const requestId = await createRequest();
  try {
    const file = req.file;
    if (!file) {
      throw new Error("No file uploaded");
    }
    const documentId = await indexDocumentAsync(file, requestId, updateRequest);
    res.json({ request_id: requestId, document_id: documentId });
  } catch (error) {
    await updateRequest(requestId, "FAILED", error.message);
    res.status(400).json({ detail: "Failed to index document" });
  }
});

router.post("/create-project-async", async (req, res) => {
  const requestId = await createRequest();
  try {
    const projectId = await createProjectAsync(req.body, requestId, updateRequest);
    res.json({ request_id: requestId, project_id: projectId });
  } catch (error) {
    await updateRequest(requestId, "FAILED", error.message);
    res.status(400).json({ detail: "Failed to create project" });
  }
});

router.post("/update-project-async", async (req, res) => {
  const requestId = await createRequest();
  try {
    await updateProjectAsync(req.body, requestId, updateRequest);
    res.json({ request_id: requestId, project_id: req.body.project_id });
  } catch (error) {
    await updateRequest(requestId, "FAILED", error.message);
    res.status(400).json({ detail: "Failed to update project" });
  }
});

router.post("/generate-single-answer", async (req, res) => {
  const { project_id: projectId, question_id: questionId } = req.body;
  const questionResult = await pool.query("SELECT * FROM questions WHERE id=$1", [questionId]);
  if (!questionResult.rows.length) {
    res.status(404).json({ detail: "Question not found" });
    return;
  }
  const question = questionResult.rows[0];
  const answerPayload = await generateAnswer(projectId, question);
  const answerId = uuidv4();
  const now = new Date();
  await pool.query(
    "INSERT INTO answers (id, project_id, question_id, answer_text, is_answerable, confidence, citations, status, created_at, updated_at, manual_answer) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
    [
      answerId,
      projectId,
      questionId,
      answerPayload.answerText,
      answerPayload.isAnswerable,
      answerPayload.confidence,
      JSON.stringify(answerPayload.citations),
      ANSWER_STATUS.DRAFT,
      now,
      now,
      null,
    ],
  );
  res.json({
    answer: {
      id: answerId,
      project_id: projectId,
      question_id: questionId,
      answer_text: answerPayload.answerText,
      is_answerable: answerPayload.isAnswerable,
      confidence: answerPayload.confidence,
      citations: answerPayload.citations,
      status: ANSWER_STATUS.DRAFT,
      created_at: now,
      updated_at: now,
      manual_answer: null,
    },
  });
});

router.post("/generate-all-answers", async (req, res) => {
  const requestId = await createRequest();
  try {
    await generateAnswersAsync(req.body, requestId, updateRequest);
    res.json({ request_id: requestId, project_id: req.body.project_id });
  } catch (error) {
    await updateRequest(requestId, "FAILED", error.message);
    res.status(400).json({ detail: "Failed to generate answers" });
  }
});

router.post("/update-answer", async (req, res) => {
  const { pool: dbPool } = require("../storage/db");
  const { answer_id: answerId, status } = req.body;
  const shouldUpdateManualAnswer = Object.prototype.hasOwnProperty.call(req.body, "manual_answer");
  const manualAnswerRaw = shouldUpdateManualAnswer ? req.body.manual_answer : undefined;
  const manualAnswer = typeof manualAnswerRaw === "string" ? manualAnswerRaw.trim() : manualAnswerRaw;
  if (!answerId || !status) {
    res.status(400).json({ detail: "answer_id and status are required" });
    return;
  }
  if (shouldUpdateManualAnswer) {
    if (manualAnswer !== null && typeof manualAnswer !== "string") {
      res.status(400).json({ detail: "manual_answer must be a string or null" });
      return;
    }
    if (typeof manualAnswer === "string" && manualAnswer.length === 0) {
      res.status(400).json({ detail: "manual_answer cannot be empty" });
      return;
    }
    if (typeof manualAnswer === "string" && manualAnswer.length > 20000) {
      res.status(400).json({ detail: "manual_answer is too long" });
      return;
    }
  }
  const now = new Date();
  const result = shouldUpdateManualAnswer
    ? await dbPool.query(
        "UPDATE answers SET status=$1, manual_answer=$2, updated_at=$3 WHERE id=$4 RETURNING *",
        [status, manualAnswer, now, answerId],
      )
    : await dbPool.query(
        "UPDATE answers SET status=$1, updated_at=$2 WHERE id=$3 RETURNING *",
        [status, now, answerId],
      );
  if (!result.rows.length) {
    res.status(404).json({ detail: "Answer not found" });
    return;
  }
  res.json({ answer: result.rows[0] });
});

router.post("/evaluate-project", async (req, res) => {
  const projectId = req.query.project_id;
  const results = await evaluateProject(projectId);
  res.json({ project_id: projectId, results });
});

module.exports = {
  router,
};
