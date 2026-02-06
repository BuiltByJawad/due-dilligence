export type ProjectStatus = "CREATING" | "READY" | "OUTDATED" | "UPDATING" | "ERROR";

export type AnswerStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "REJECTED"
  | "MANUAL_UPDATED"
  | "MISSING_DATA";

export type RequestStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";

export type DocumentScope = "ALL_DOCS" | "SELECTED_DOCS";

export interface Citation {
  chunk_id: string;
  document_id: string;
  excerpt: string;
  score: number;
}

export interface Answer {
  id: string;
  project_id: string;
  question_id: string;
  answer_text: string;
  is_answerable: boolean;
  confidence: number;
  citations: Citation[];
  status: AnswerStatus;
  created_at: string;
  updated_at: string;
  manual_answer?: string | null;
}

export interface Question {
  id: string;
  project_id: string;
  section: string;
  order: number;
  text: string;
}

export interface DocumentInfo {
  id: string;
  filename: string;
  content_type: string;
  created_at: string;
  status: RequestStatus;
  page_count: number;
  text_length: number;
}

export interface ProjectInfo {
  id: string;
  name: string;
  questionnaire_document_id: string;
  status: ProjectStatus;
  scope: DocumentScope;
  document_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface RequestStatusInfo {
  id: string;
  status: RequestStatus;
  message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvaluationResult {
  id: string;
  project_id: string;
  answer_id: string;
  human_answer: string;
  similarity_score: number;
  notes: string;
  created_at: string;
}
