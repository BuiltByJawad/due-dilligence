import type {
  Answer,
  AnswerStatus,
  DocumentInfo,
  DocumentScope,
  EvaluationResult,
  ProjectInfo,
  Question,
  RequestStatusInfo,
} from "../types";

const API_BASE = "http://localhost:8000";

const DEFAULT_TIMEOUT_MS = 20000;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

interface CreateProjectResponse {
  request_id: string;
  project_id: string;
}

interface IndexDocumentResponse {
  request_id: string;
  document_id: string;
}

interface ProjectInfoResponse {
  project: ProjectInfo;
  questions: Question[];
  answers: Answer[];
}

interface ProjectAnswersPageResponse {
  project: ProjectInfo;
  questions: Question[];
  answers: Answer[];
  total_questions: number;
  total_answers: number;
  manual_edits: number;
}

interface ListProjectsResponse {
  projects: ProjectInfo[];
}

interface ListDocumentsResponse {
  documents: DocumentInfo[];
}

interface RequestStatusResponse {
  request: RequestStatusInfo;
}

interface EvaluationReportResponse {
  project_id: string;
  results: EvaluationResult[];
}

interface AnswerResponse {
  answer: Answer;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Request failed");
  }
  return (await response.json()) as T;
}

export async function indexDocument(file: File): Promise<IndexDocumentResponse> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetchWithTimeout(`${API_BASE}/index-document-async`, {
    method: "POST",
    body,
  });
  return handleResponse(response);
}

export async function listDocuments(): Promise<DocumentInfo[]> {
  const response = await fetchWithTimeout(`${API_BASE}/list-documents`);
  const data = await handleResponse<ListDocumentsResponse>(response);
  return data.documents;
}

export async function listProjects(): Promise<ProjectInfo[]> {
  const response = await fetchWithTimeout(`${API_BASE}/list-projects`);
  const data = await handleResponse<ListProjectsResponse>(response);
  return data.projects;
}

export async function createProject(payload: {
  name: string;
  questionnaire_document_id: string;
  scope: DocumentScope;
  document_ids?: string[];
}): Promise<CreateProjectResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/create-project-async`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function updateProject(payload: {
  project_id: string;
  scope: DocumentScope;
  document_ids?: string[];
}): Promise<CreateProjectResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/update-project-async`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function getProjectInfo(projectId: string): Promise<ProjectInfoResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/get-project-info?project_id=${projectId}`);
  return handleResponse(response);
}

export async function getProjectAnswersPage(
  projectId: string,
  limit: number,
  offset: number,
): Promise<ProjectAnswersPageResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/get-project-answers-page?project_id=${projectId}&limit=${limit}&offset=${offset}`,
  );
  return handleResponse(response);
}

export async function getProjectStatus(projectId: string): Promise<ProjectInfo["status"]> {
  const response = await fetchWithTimeout(`${API_BASE}/get-project-status?project_id=${projectId}`);
  const data = await handleResponse<{ project_id: string; status: ProjectInfo["status"] }>(
    response,
  );
  return data.status;
}

export async function getRequestStatus(requestId: string): Promise<RequestStatusInfo> {
  const response = await fetchWithTimeout(`${API_BASE}/get-request-status?request_id=${requestId}`);
  const data = await handleResponse<RequestStatusResponse>(response);
  return data.request;
}

export async function generateSingleAnswer(projectId: string, questionId: string): Promise<Answer> {
  const response = await fetchWithTimeout(`${API_BASE}/generate-single-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, question_id: questionId }),
  });
  const data = await handleResponse<AnswerResponse>(response);
  return data.answer;
}

export async function generateAllAnswers(projectId: string): Promise<CreateProjectResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/generate-all-answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId }),
  });
  return handleResponse(response);
}

export async function updateAnswer(
  answerId: string,
  status: AnswerStatus,
  manualAnswer?: string,
): Promise<Answer> {
  const response = await fetchWithTimeout(`${API_BASE}/update-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      answer_id: answerId,
      status,
      manual_answer: manualAnswer,
    }),
  });
  const data = await handleResponse<AnswerResponse>(response);
  return data.answer;
}

export async function evaluateProject(projectId: string): Promise<EvaluationResult[]> {
  const response = await fetchWithTimeout(`${API_BASE}/evaluate-project?project_id=${projectId}`, {
    method: "POST",
  });
  const data = await handleResponse<EvaluationReportResponse>(response);
  return data.results;
}
