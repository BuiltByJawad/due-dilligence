import { useEffect, useMemo, useRef, useState } from "react";

import {
  createProject,
  evaluateProject,
  generateAllAnswers,
  getProjectAnswersPage,
  getRequestStatus,
  indexDocument,
  listDocuments,
  listProjects,
  updateAnswer,
  updateProject,
} from "../services/api";
import {
  Answer,
  AnswerStatus,
  DocumentInfo,
  DocumentScope,
  EvaluationResult,
  ProjectInfo,
  Question,
  RequestStatusInfo,
} from "../types";

export interface DashboardState {
  documents: DocumentInfo[];
  isLoadingDocuments: boolean;
  isLoadingProject: boolean;
  projectLoadError: string | null;
  projects: ProjectInfo[];
  project: ProjectInfo | null;
  pendingProjectUpdateRequestId: string | null;
  pendingGenerateAnswersRequestId: string | null;
  busyAction: BusyAction | null;
  answerPage: number;
  answersPerPage: number;
  totalQuestions: number;
  totalAnswers: number;
  manualEditsCount: number;
  questions: Question[];
  answers: Answer[];
  evaluations: EvaluationResult[];
  statusMessage: string | null;
  isBusy: boolean;
  projectName: string;
  questionnaireId: string;
  scope: DocumentScope;
  selectedDocs: string[];
  manualEdits: Record<string, string>;
  activeProjectId: string | null;
  requestIds: string[];
  requestStatuses: Record<string, RequestStatusInfo>;
}

export interface DashboardActions {
  setProjectName: (value: string) => void;
  setQuestionnaireId: (value: string) => void;
  setScope: (value: DocumentScope) => void;
  setSelectedDocs: (docs: string[]) => void;
  setManualEdits: (edits: Record<string, string>) => void;
  setActiveProjectId: (value: string) => void;
  setAnswerPage: (page: number) => void;
  handleUpload: (file: File | null) => Promise<void>;
  handleCreateProject: () => Promise<void>;
  handleGenerateAnswers: () => Promise<void>;
  handleUpdateAnswer: (answer: Answer, status: AnswerStatus) => Promise<void>;
  handleUpdateScope: () => Promise<void>;
  handleEvaluate: () => Promise<void>;
  refreshRequestStatus: (requestId: string) => Promise<void>;
}

export interface DashboardContext {
  state: DashboardState;
  actions: DashboardActions;
  answerMap: Map<string, Answer>;
}

export type BusyAction =
  | "INDEX_DOCUMENT"
  | "CREATE_PROJECT"
  | "GENERATE_ANSWERS"
  | "UPDATE_SCOPE"
  | "UPDATE_ANSWER"
  | "EVALUATE";

type StoredRequestIdRecord = {
  id: string;
  createdAt: number;
};

export function useDashboard(): DashboardContext {
  const CACHE_TTL_MS = 15000;
  const dashboardCacheKey = "ddq_dashboard_cache";
  const projectCacheKeyPrefix = "ddq_project_cache_";
  const activeProjectKey = "ddq_active_project_id";
  const answersPageCacheKeyPrefix = "ddq_answers_page_cache_";
  const requestIdsKey = "ddq_request_ids";
  const REQUEST_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
  const MAX_REQUEST_IDS = 200;
  const ANSWERS_PER_PAGE = 20;
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [projectLoadError, setProjectLoadError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(activeProjectKey);
  });
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [pendingProjectUpdateRequestId, setPendingProjectUpdateRequestId] = useState<string | null>(null);
  const [pendingGenerateAnswersRequestId, setPendingGenerateAnswersRequestId] = useState<string | null>(null);
  const [answerPage, setAnswerPage] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [manualEditsCount, setManualEditsCount] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationResult[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const [projectName, setProjectName] = useState("MiniMax DDQ");
  const [questionnaireId, setQuestionnaireId] = useState<string>("");
  const [scope, setScope] = useState<DocumentScope>("ALL_DOCS");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [manualEdits, setManualEdits] = useState<Record<string, string>>({});
  const [requestIds, setRequestIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const now = Date.now();
    try {
      const stored = window.localStorage.getItem(requestIdsKey);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      const records: StoredRequestIdRecord[] = Array.isArray(parsed)
        ? parsed
            .map((item: unknown): StoredRequestIdRecord | null => {
              if (typeof item === "string") {
                return { id: item, createdAt: now };
              }
              if (
                item &&
                typeof item === "object" &&
                "id" in item &&
                "createdAt" in item &&
                typeof (item as { id: unknown }).id === "string" &&
                typeof (item as { createdAt: unknown }).createdAt === "number"
              ) {
                return { id: (item as { id: string }).id, createdAt: (item as { createdAt: number }).createdAt };
              }
              return null;
            })
            .filter((item): item is StoredRequestIdRecord => Boolean(item))
        : [];
      const cutoff = now - REQUEST_RETENTION_MS;
      const pruned = records
        .filter((record) => record.createdAt >= cutoff)
        .slice(0, MAX_REQUEST_IDS);
      window.localStorage.setItem(requestIdsKey, JSON.stringify(pruned));
      return pruned.map((record) => record.id);
    } catch {
      return [];
    }
  });
  const [requestStatuses, setRequestStatuses] = useState<Record<string, RequestStatusInfo>>({});
  const dashboardCacheRef = useRef<number>(0);
  const projectCacheRef = useRef<Record<string, number>>({});
  const answersPageCacheRef = useRef<
    Record<
      string,
      Record<
        number,
        {
          timestamp: number;
          project: ProjectInfo;
          questions: Question[];
          answers: Answer[];
          totalQuestions: number;
          totalAnswers: number;
          manualEdits: number;
        }
      >
    >
  >({});

  const persistActiveProjectId = (value: string | null) => {
    setActiveProjectIdState(value);
    if (typeof window === "undefined") return;
    if (value) {
      window.localStorage.setItem(activeProjectKey, value);
    } else {
      window.localStorage.removeItem(activeProjectKey);
    }
  };

  const addRequestId = (requestId: string) => {
    if (typeof window === "undefined") {
      setRequestIds((prev) => [requestId, ...prev].slice(0, MAX_REQUEST_IDS));
      return;
    }
    const now = Date.now();
    setRequestIds((prev) => {
      try {
        const stored = window.localStorage.getItem(requestIdsKey);
        const parsed: unknown = stored ? JSON.parse(stored) : [];
        const existing: StoredRequestIdRecord[] = Array.isArray(parsed)
          ? parsed
              .map((item: unknown): StoredRequestIdRecord | null => {
                if (typeof item === "string") {
                  return { id: item, createdAt: now };
                }
                if (
                  item &&
                  typeof item === "object" &&
                  "id" in item &&
                  "createdAt" in item &&
                  typeof (item as { id: unknown }).id === "string" &&
                  typeof (item as { createdAt: unknown }).createdAt === "number"
                ) {
                  return { id: (item as { id: string }).id, createdAt: (item as { createdAt: number }).createdAt };
                }
                return null;
              })
              .filter((item): item is StoredRequestIdRecord => Boolean(item))
          : [];

        const next = [{ id: requestId, createdAt: now }, ...existing.filter((record) => record.id !== requestId)];
        const cutoff = now - REQUEST_RETENTION_MS;
        const pruned = next
          .filter((record) => record.createdAt >= cutoff)
          .slice(0, MAX_REQUEST_IDS);
        window.localStorage.setItem(requestIdsKey, JSON.stringify(pruned));
        return pruned.map((record) => record.id);
      } catch {
        const nextIds = [requestId, ...prev.filter((id) => id !== requestId)].slice(0, MAX_REQUEST_IDS);
        window.localStorage.setItem(requestIdsKey, JSON.stringify(nextIds.map((id) => ({ id, createdAt: now }))));
        return nextIds;
      }
    });
  };

  const answerMap = useMemo(() => {
    const map = new Map<string, Answer>();
    answers.forEach((answer: Answer) => map.set(answer.question_id, answer));
    return map;
  }, [answers]);

  useEffect(() => {
    hydrateDashboardCache();
    void refreshDashboard({ force: false });
  }, []);

  useEffect(() => {
    const pendingRequestIds = requestIds.filter((requestId) => {
      const status = requestStatuses[requestId]?.status;
      return status !== "SUCCESS" && status !== "FAILED";
    });
    if (!pendingRequestIds.length) return;
    void refreshAllRequestStatuses(pendingRequestIds);
    const interval = window.setInterval(() => {
      void refreshAllRequestStatuses(pendingRequestIds);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [requestIds, requestStatuses]);

  useEffect(() => {
    if (!pendingProjectUpdateRequestId) return;
    const status = requestStatuses[pendingProjectUpdateRequestId]?.status;
    if (status === "SUCCESS" || status === "FAILED") {
      setPendingProjectUpdateRequestId(null);
    }
  }, [pendingProjectUpdateRequestId, requestStatuses]);

  useEffect(() => {
    if (!pendingGenerateAnswersRequestId) return;
    const status = requestStatuses[pendingGenerateAnswersRequestId]?.status;
    if (status === "SUCCESS" || status === "FAILED") {
      setPendingGenerateAnswersRequestId(null);
      if (project) {
        clearAnswersCache(project.id);
        void loadAnswersPage(project.id, answerPage, true);
      }
    }
  }, [pendingGenerateAnswersRequestId, requestStatuses, project, answerPage]);

  useEffect(() => {
    const shouldPollProjects = projects.some((project) => project.status !== "READY");
    if (!shouldPollProjects) return;
    const interval = window.setInterval(() => {
      void refreshDashboard({ force: true });
    }, 4000);
    return () => window.clearInterval(interval);
  }, [projects]);

  function hydrateDashboardCache(): void {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(dashboardCacheKey);
      if (!raw) return;
      const cached = JSON.parse(raw) as {
        documents: DocumentInfo[];
        projects: ProjectInfo[];
        activeProjectId: string | null;
        timestamp: number;
      };
      const isFresh = Date.now() - cached.timestamp <= CACHE_TTL_MS;
      if (isFresh) {
        setDocuments(cached.documents);
        setProjects(cached.projects);
        const fallbackProjectId =
          cached.activeProjectId ?? window.localStorage.getItem(activeProjectKey) ?? cached.projects[0]?.id ?? null;
        if (fallbackProjectId && !activeProjectId) {
          persistActiveProjectId(fallbackProjectId);
        }
        dashboardCacheRef.current = cached.timestamp;
      }
    } catch {
      // Ignore cache errors.
    }
  }

  async function refreshDashboard({ force }: { force: boolean }): Promise<void> {
    const now = Date.now();
    const isFresh = now - dashboardCacheRef.current <= CACHE_TTL_MS;
    if (!force && isFresh) return;
    setIsLoadingDocuments(true);
    try {
      const [docs, projs] = await Promise.all([listDocuments(), listProjects()]);
      setDocuments(docs);
      setProjects(projs);
      dashboardCacheRef.current = now;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          dashboardCacheKey,
          JSON.stringify({ documents: docs, projects: projs, activeProjectId, timestamp: now }),
        );
      }
      if (projs.length) {
        const hasActiveProject = activeProjectId ? projs.some((project) => project.id === activeProjectId) : false;
        if (!hasActiveProject) {
          persistActiveProjectId(projs[0].id);
        }
      }
    } finally {
      setIsLoadingDocuments(false);
    }
  }

  function hydrateProjectCache(projectId: string): { project: ProjectInfo; questions: Question[]; answers: Answer[] } | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(`${projectCacheKeyPrefix}${projectId}`);
      if (!raw) return null;
      const cached = JSON.parse(raw) as {
        project: ProjectInfo;
        questions: Question[];
        answers: Answer[];
        timestamp: number;
      };
      const isFresh = Date.now() - cached.timestamp <= CACHE_TTL_MS;
      if (!isFresh) return null;
      projectCacheRef.current[projectId] = cached.timestamp;
      return { project: cached.project, questions: cached.questions, answers: cached.answers };
    } catch {
      return null;
    }
  }

  async function loadProject(projectId: string, force = false): Promise<void> {
    await loadAnswersPage(projectId, 1, force);
  }

  function clearAnswersCache(projectId: string): void {
    delete answersPageCacheRef.current[projectId];
    delete projectCacheRef.current[projectId];
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(`${projectCacheKeyPrefix}${projectId}`);
      const prefix = `${answersPageCacheKeyPrefix}${projectId}_`;
      for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
        const key = window.localStorage.key(index);
        if (key && key.startsWith(prefix)) {
          window.localStorage.removeItem(key);
        }
      }
    }
  }

  function getCachedAnswersPage(projectId: string, page: number) {
    const cached = answersPageCacheRef.current[projectId]?.[page];
    if (cached) {
      if (Date.now() - cached.timestamp > CACHE_TTL_MS) return null;
      return cached;
    }
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(`${answersPageCacheKeyPrefix}${projectId}_${page}`);
      if (!raw) return null;
      const stored = JSON.parse(raw) as {
        timestamp: number;
        project: ProjectInfo;
        questions: Question[];
        answers: Answer[];
        totalQuestions: number;
        totalAnswers: number;
        manualEdits: number;
      };
      if (Date.now() - stored.timestamp > CACHE_TTL_MS) return null;
      if (!answersPageCacheRef.current[projectId]) {
        answersPageCacheRef.current[projectId] = {};
      }
      answersPageCacheRef.current[projectId][page] = stored;
      return stored;
    } catch {
      return null;
    }
  }

  async function prefetchAnswersPage(projectId: string, page: number, totalPages: number): Promise<void> {
    if (page > totalPages) return;
    if (getCachedAnswersPage(projectId, page)) return;
    const offset = (page - 1) * ANSWERS_PER_PAGE;
    try {
      const data = await getProjectAnswersPage(projectId, ANSWERS_PER_PAGE, offset);
      if (!answersPageCacheRef.current[projectId]) {
        answersPageCacheRef.current[projectId] = {};
      }
      const cachedPage = {
        timestamp: Date.now(),
        project: data.project,
        questions: data.questions,
        answers: data.answers,
        totalQuestions: data.total_questions,
        totalAnswers: data.total_answers,
        manualEdits: data.manual_edits,
      };
      answersPageCacheRef.current[projectId][page] = cachedPage;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `${answersPageCacheKeyPrefix}${projectId}_${page}`,
          JSON.stringify(cachedPage),
        );
      }
    } catch {
      // Ignore prefetch errors.
    }
  }

  async function loadAnswersPage(projectId: string, page: number, force = false): Promise<void> {
    const cached = getCachedAnswersPage(projectId, page);
    if (!force && cached) {
      setProject(cached.project);
      setQuestions(cached.questions);
      setAnswers(cached.answers);
      setTotalQuestions(cached.totalQuestions);
      setTotalAnswers(cached.totalAnswers);
      setManualEditsCount(cached.manualEdits);
      setEvaluations([]);
      setProjectLoadError(null);
      return;
    }
    setProjectLoadError(null);
    setIsLoadingProject(true);
    try {
      const offset = (page - 1) * ANSWERS_PER_PAGE;
      const data = await getProjectAnswersPage(projectId, ANSWERS_PER_PAGE, offset);
      setProject(data.project);
      setQuestions(data.questions);
      setAnswers(data.answers);
      setTotalQuestions(data.total_questions);
      setTotalAnswers(data.total_answers);
      setManualEditsCount(data.manual_edits);
      setEvaluations([]);
      if (!answersPageCacheRef.current[projectId]) {
        answersPageCacheRef.current[projectId] = {};
      }
      answersPageCacheRef.current[projectId][page] = {
        timestamp: Date.now(),
        project: data.project,
        questions: data.questions,
        answers: data.answers,
        totalQuestions: data.total_questions,
        totalAnswers: data.total_answers,
        manualEdits: data.manual_edits,
      };
      const totalPages = Math.max(1, Math.ceil(data.total_questions / ANSWERS_PER_PAGE));
      void prefetchAnswersPage(projectId, page + 1, totalPages);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load project answers.";
      setProjectLoadError(message);
      setStatusMessage(message);
    } finally {
      setIsLoadingProject(false);
    }
  }

  useEffect(() => {
    if (activeProjectId) {
      setAnswerPage(1);
      void loadAnswersPage(activeProjectId, 1, false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (activeProjectId) {
      void loadAnswersPage(activeProjectId, answerPage, false);
    }
  }, [activeProjectId, answerPage]);

  async function handleUpload(file: File | null): Promise<void> {
    if (!file) return;
    setBusyAction("INDEX_DOCUMENT");
    setIsBusy(true);
    setStatusMessage("Indexing document...");
    try {
      const response = await indexDocument(file);
      addRequestId(response.request_id);
      void refreshRequestStatus(response.request_id);
      await refreshDashboard({ force: true });
      setStatusMessage("Document indexed.");
    } catch (error) {
      setStatusMessage((error as Error).message);
    } finally {
      setIsBusy(false);
      setBusyAction(null);
    }
  }

  async function handleCreateProject(): Promise<void> {
    if (!questionnaireId) {
      setStatusMessage("Select a questionnaire document first.");
      return;
    }
    setBusyAction("CREATE_PROJECT");
    setIsBusy(true);
    setStatusMessage("Creating project...");
    try {
      const response = await createProject({
        name: projectName,
        questionnaire_document_id: questionnaireId,
        scope,
        document_ids: scope === "SELECTED_DOCS" ? selectedDocs : undefined,
      });
      addRequestId(response.request_id);
      persistActiveProjectId(response.project_id);
      await refreshRequestStatus(response.request_id);
      await refreshDashboard({ force: true });
      clearAnswersCache(response.project_id);
      await loadAnswersPage(response.project_id, 1, true);
      setStatusMessage("Project created.");
    } catch (error) {
      setStatusMessage((error as Error).message);
    } finally {
      setIsBusy(false);
      setBusyAction(null);
    }
  }

  async function handleGenerateAnswers(): Promise<void> {
    if (!project) return;
    setBusyAction("GENERATE_ANSWERS");
    setIsBusy(true);
    setStatusMessage("Generating answers...");
    try {
      const response = await generateAllAnswers(project.id);
      addRequestId(response.request_id);
      setPendingGenerateAnswersRequestId(response.request_id);
      await refreshRequestStatus(response.request_id);
      setStatusMessage("Answer generation started.");
    } catch (error) {
      setStatusMessage((error as Error).message);
    } finally {
      setIsBusy(false);
      setBusyAction(null);
    }
  }

  async function handleUpdateAnswer(answer: Answer, status: AnswerStatus): Promise<void> {
    setBusyAction("UPDATE_ANSWER");
    setIsBusy(true);
    try {
      const manualAnswerRaw = status === "MANUAL_UPDATED" ? manualEdits[answer.id] : undefined;
      const manualAnswer = typeof manualAnswerRaw === "string" ? manualAnswerRaw.trim() : undefined;
      if (status === "MANUAL_UPDATED" && (!manualAnswer || manualAnswer.length === 0)) {
        setStatusMessage("Manual edit cannot be empty.");
        return;
      }
      await updateAnswer(answer.id, status, manualAnswer);
      if (project) {
        clearAnswersCache(project.id);
        await loadAnswersPage(project.id, answerPage, true);
      }
    } catch (error) {
      setStatusMessage((error as Error).message);
    } finally {
      setIsBusy(false);
      setBusyAction(null);
    }
  }

  async function handleUpdateScope(): Promise<void> {
    if (!project) return;
    setBusyAction("UPDATE_SCOPE");
    setIsBusy(true);
    setStatusMessage("Updating project scope...");
    try {
      const response = await updateProject({
        project_id: project.id,
        scope,
        document_ids: scope === "SELECTED_DOCS" ? selectedDocs : undefined,
      });
      addRequestId(response.request_id);
      setPendingProjectUpdateRequestId(response.request_id);
      await refreshRequestStatus(response.request_id);
      clearAnswersCache(project.id);
      await loadAnswersPage(project.id, answerPage, true);
      await refreshDashboard({ force: true });
      setStatusMessage("Project scope updated.");
    } catch (error) {
      setStatusMessage((error as Error).message);
    } finally {
      setIsBusy(false);
      setBusyAction(null);
    }
  }

  async function handleEvaluate(): Promise<void> {
    if (!project) return;
    setBusyAction("EVALUATE");
    setIsBusy(true);
    setStatusMessage("Evaluating answers...");
    try {
      const results = await evaluateProject(project.id);
      setEvaluations(results);
      setStatusMessage("Evaluation complete.");
    } catch (error) {
      setStatusMessage((error as Error).message);
    } finally {
      setIsBusy(false);
      setBusyAction(null);
    }
  }

  async function refreshRequestStatus(requestId: string): Promise<void> {
    const request = await getRequestStatus(requestId);
    setRequestStatuses((prev) => ({ ...prev, [requestId]: request }));
  }

  async function refreshAllRequestStatuses(pendingIds: string[]): Promise<void> {
    await Promise.all(pendingIds.map((requestId) => refreshRequestStatus(requestId)));
  }

  return {
    state: {
      documents,
      isLoadingDocuments,
      isLoadingProject,
      projectLoadError,
      projects,
      project,
      pendingProjectUpdateRequestId,
      pendingGenerateAnswersRequestId,
      busyAction,
      answerPage,
      answersPerPage: ANSWERS_PER_PAGE,
      totalQuestions,
      totalAnswers,
      manualEditsCount,
      questions,
      answers,
      evaluations,
      statusMessage,
      isBusy,
      projectName,
      questionnaireId,
      scope,
      selectedDocs,
      manualEdits,
      activeProjectId,
      requestIds,
      requestStatuses,
    },
    actions: {
      setProjectName,
      setQuestionnaireId,
      setScope,
      setSelectedDocs,
      setManualEdits,
      setActiveProjectId: (value: string) => persistActiveProjectId(value),
      setAnswerPage,
      handleUpload,
      handleCreateProject,
      handleGenerateAnswers,
      handleUpdateAnswer,
      handleUpdateScope,
      handleEvaluate,
      refreshRequestStatus,
    },
    answerMap,
  };
}
