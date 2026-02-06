import { ChangeEvent, DragEvent, useState } from "react";

import Section from "../components/Section";
import {
  Answer,
  AnswerStatus,
  DocumentInfo,
  DocumentScope,
  EvaluationResult,
  ProjectInfo,
  Question,
} from "../types";
import type { DashboardActions, DashboardState } from "../state/useDashboard";

const STATUS_LABELS: Record<AnswerStatus, string> = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
  MANUAL_UPDATED: "Manual",
  MISSING_DATA: "Missing",
};

interface DashboardPageProps {
  state: DashboardState;
  actions: DashboardActions;
  answerMap: Map<string, Answer>;
}

export default function DashboardPage({ state, actions, answerMap }: DashboardPageProps) {
  const [isDragging, setIsDragging] = useState(false);
  const {
    documents,
    projects,
    project,
    questions,
    evaluations,
    isBusy,
    projectName,
    questionnaireId,
    scope,
    selectedDocs,
    manualEdits,
    activeProjectId,
    isLoadingDocuments,
    isLoadingProject,
    projectLoadError,
    pendingProjectUpdateRequestId,
    pendingGenerateAnswersRequestId,
    busyAction,
    answerPage,
    answersPerPage,
    totalQuestions,
    totalAnswers,
    manualEditsCount,
  } = state;
  const isProjectUpdating = Boolean(pendingProjectUpdateRequestId || pendingGenerateAnswersRequestId);
  const isGeneratingAnswers = Boolean(pendingGenerateAnswersRequestId) || busyAction === "GENERATE_ANSWERS";
  const isUpdatingScope = Boolean(pendingProjectUpdateRequestId) || busyAction === "UPDATE_SCOPE";
  const isEvaluating = busyAction === "EVALUATE";
  const shouldShowAnswerSkeleton =
    Boolean(activeProjectId) && (isLoadingProject || (questions.length === 0 && !projectLoadError));
  const isActionLocked = isBusy || isProjectUpdating;
  const buttonBase =
    "inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70";
  const primaryButton = `${buttonBase} bg-[#101419] text-white hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-12px_rgba(16,20,25,0.5)]`;
  const secondaryButton = `${buttonBase} bg-[#f1e9de] text-[#101419]`;
  const ghostButton = `${buttonBase} border border-[#e0d6c8] bg-transparent text-[#101419]`;
  const cardBase = "rounded-2xl border border-[#efe7dd] bg-[#fcfbfa] p-4 md:p-5";
  const spotlightCard =
    "rounded-2xl border border-[#efe7dd] bg-[linear-gradient(140deg,#ffffff_0%,#f6efe6_100%)] p-4 md:p-5";
  const tagClass = "inline-flex items-center rounded-full bg-[#efe4d6] px-3 py-1 text-xs font-medium text-[#101419]";
  const smallText = "text-sm text-[#4b4f53]";
  const skeletonGradient =
    "bg-[linear-gradient(90deg,#efe7dd_0%,#f7f2ea_50%,#efe7dd_100%)] bg-[length:200%_100%] animate-shimmer";
  const labelClass = "block text-sm font-semibold text-[#2b2f33]";
  const fieldClass = "flex flex-col gap-2";
  const inputBase =
    "mt-1 w-full rounded-xl border border-[#d7cabb] bg-[#fdfaf6] px-4 py-3 text-sm text-[#101419] transition focus:border-[#9a6a3a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9a6a3a]/30";
  const selectBase =
    `${inputBase} appearance-none bg-white pr-10 bg-[url('data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%236b6f74' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 8l4 4 4-4'/%3E%3C/svg%3E')] bg-no-repeat bg-[right_14px_center] bg-[length:16px]`;
  const textareaClass = `${inputBase} min-h-[96px] resize-y`;
  const dropzoneBase =
    "flex min-h-[120px] cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#d1c3b2] bg-white/70 p-4 text-center transition";
  const dropzoneActive = "border-[#9a6a3a] bg-[#fff3e6] -translate-y-0.5";
  const gridTwoCol = "grid gap-4 lg:grid-cols-2";
  const statLabel = "block text-[0.7rem] uppercase tracking-[0.1em] text-[#6b6f74]";
  const statValue = "text-lg font-semibold text-[#101419]";
  const skeletonLine = `h-3 rounded-full ${skeletonGradient}`;
  const skeletonLineShort = `h-3 w-1/2 rounded-full ${skeletonGradient}`;
  const skeletonBlock = `h-11 rounded-xl ${skeletonGradient}`;
  const skeletonButton = `h-10 w-[140px] rounded-full ${skeletonGradient}`;
  const pageButtonBase =
    "flex h-9 min-w-[36px] items-center justify-center rounded-[10px] border border-black/20 bg-white px-2 text-sm font-semibold text-black transition hover:bg-neutral-50";
  const pageButtonActive =
    "border-black bg-[#efe4d6] text-black ring-2 ring-black/30 shadow-[0_6px_18px_-14px_rgba(0,0,0,0.35)]";
  const answerCardClass =
    "rounded-2xl border border-[#efe7dd] bg-white p-4 md:p-5 [content-visibility:auto] [contain-intrinsic-size:1px_420px]";

  const LoadingDots = () => (
    <span className="ml-2 inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
    </span>
  );

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (isActionLocked) return;
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    void actions.handleUpload(file);
  };

  const totalAnswerPages = Math.max(1, Math.ceil(totalQuestions / answersPerPage));
  const clampedAnswerPage = Math.min(answerPage, totalAnswerPages);
  const answerStartIndex = (clampedAnswerPage - 1) * answersPerPage;
  const answerEndIndex = answerStartIndex + answersPerPage;

  const paginationItems = buildPaginationItems(clampedAnswerPage, totalAnswerPages);

  function buildPaginationItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
    if (totalPages <= 11) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    const pages = new Set<number>();
    for (let page = 1; page <= 5; page += 1) {
      pages.add(page);
    }
    for (let page = totalPages - 4; page <= totalPages; page += 1) {
      pages.add(page);
    }

    for (let page = currentPage - 2; page <= currentPage + 2; page += 1) {
      if (page > 1 && page < totalPages) {
        pages.add(page);
      }
    }

    const sortedPages = Array.from(pages).sort((a, b) => a - b);
    const items: Array<number | "ellipsis"> = [];
    sortedPages.forEach((page, index) => {
      if (index === 0) {
        items.push(page);
        return;
      }
      const previous = sortedPages[index - 1];
      if (page - previous === 2) {
        items.push(previous + 1);
      } else if (page - previous > 2) {
        items.push("ellipsis");
      }
      items.push(page);
    });
    return items;
  }

  const renderAnswerPagination = () => (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[rgba(16,20,25,0.06)] bg-[#fdf8f1] px-4 py-3">
      <span className={smallText}>
        Showing {totalQuestions === 0 ? 0 : answerStartIndex + 1}–{Math.min(answerEndIndex, totalQuestions)} of {totalQuestions}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={ghostButton}
          onClick={() => actions.setAnswerPage(Math.max(1, clampedAnswerPage - 1))}
          disabled={clampedAnswerPage === 1}
        >
          Previous
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {paginationItems.map((item, index) =>
            item === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-2 text-sm font-semibold text-[#6b6f74]">
                ...
              </span>
            ) : (
              item === clampedAnswerPage ? (
                <span
                  key={`page-${item}`}
                  className={`${pageButtonBase} ${pageButtonActive}`}
                  aria-current="page"
                >
                  {item}
                </span>
              ) : (
                <button
                  key={`page-${item}`}
                  className={pageButtonBase}
                  onClick={() => actions.setAnswerPage(item)}
                >
                  {item}
                </button>
              )
            ),
          )}
        </div>
        <button
          className={ghostButton}
          onClick={() => actions.setAnswerPage(Math.min(totalAnswerPages, clampedAnswerPage + 1))}
          disabled={clampedAnswerPage === totalAnswerPages}
        >
          Next
        </button>
      </div>
    </div>
  );

  return (
    <>
      <Section
        title="Document Management"
        description="Upload and index reference documents. New uploads automatically refresh ALL_DOCS projects."
      >
        <div className={gridTwoCol}>
          <div className={spotlightCard}>
            <label className={labelClass}>Upload new document</label>
            <label
              htmlFor="file"
              className={`${dropzoneBase} ${isDragging ? dropzoneActive : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                id="file"
                type="file"
                className="sr-only"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  void actions.handleUpload(event.target.files?.[0] ?? null)
                }
                disabled={isActionLocked}
              />
              <div>
                <p className="text-sm font-semibold text-[#101419]">Drag & drop files here</p>
                <p className={smallText}>or click to browse · PDF/DOCX/XLSX/PPTX</p>
              </div>
            </label>
            <div className="mt-4 flex flex-wrap gap-6">
              <div>
                <span className={statLabel}>Indexed docs</span>
                <strong className={statValue}>{documents.length}</strong>
              </div>
              <div>
                <span className={statLabel}>Active projects</span>
                <strong className={statValue}>{projects.length}</strong>
              </div>
            </div>
          </div>
          <div className={cardBase}>
            <h3 className="font-serif text-lg font-semibold text-[#101419]">Indexed Documents</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {isLoadingDocuments && documents.length === 0 && (
                <>
                  <span className={`h-7 w-32 rounded-full ${skeletonGradient}`} />
                  <span className={`h-7 w-32 rounded-full ${skeletonGradient}`} />
                  <span className={`h-7 w-32 rounded-full ${skeletonGradient}`} />
                </>
              )}
              {!isLoadingDocuments && documents.length === 0 && (
                <span className={smallText}>No documents indexed yet.</span>
              )}
              {documents.map((doc: DocumentInfo) => (
                <span key={doc.id} className={tagClass}>
                  {doc.filename}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Create Project" description="Bundle questionnaire files with the right reference documents.">
        <div className={gridTwoCol}>
          <div className={cardBase}>
            {isBusy && documents.length === 0 ? (
              <div className="grid gap-3">
                <span className={skeletonLineShort} />
                <span className={skeletonBlock} />
                <span className={skeletonLineShort} />
                <span className={skeletonBlock} />
                <span className={skeletonLineShort} />
                <span className={skeletonBlock} />
                <span className={skeletonButton} />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className={fieldClass}>
                  <label className={labelClass}>Project name</label>
                  <input
                    className={inputBase}
                    value={projectName}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => actions.setProjectName(event.target.value)}
                  />
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Questionnaire document</label>
                  <select
                    className={selectBase}
                    value={questionnaireId}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => actions.setQuestionnaireId(event.target.value)}
                  >
                    <option value="">Select questionnaire PDF</option>
                    {documents.map((doc: DocumentInfo) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.filename}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={fieldClass}>
                  <label className={labelClass}>Scope</label>
                  <select
                    className={selectBase}
                    value={scope}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      actions.setScope(event.target.value as DocumentScope)
                    }
                  >
                    <option value="ALL_DOCS">All indexed documents</option>
                    <option value="SELECTED_DOCS">Selected documents only</option>
                  </select>
                </div>
                {scope === "SELECTED_DOCS" && (
                  <div className={fieldClass}>
                    <label className={labelClass}>Reference documents</label>
                    <select
                      className={selectBase}
                      multiple
                      value={selectedDocs}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                        actions.setSelectedDocs(
                          Array.from(event.target.selectedOptions, (option) =>
                            (option as HTMLOptionElement).value,
                          ),
                        )
                      }
                    >
                      {documents.map((doc: DocumentInfo) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.filename}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  className={`${primaryButton} mt-2`}
                  onClick={() => void actions.handleCreateProject()}
                  disabled={isActionLocked}
                >
                  {isBusy ? (
                    <span className="inline-flex items-center">
                      Creating project
                      <LoadingDots />
                    </span>
                  ) : (
                    "Create project"
                  )}
                </button>
              </div>
            )}
          </div>
          <div className={cardBase}>
            <h3 className="font-serif text-lg font-semibold text-[#101419]">Projects</h3>
            <div className="mt-3 grid gap-3">
              {projects.length === 0 && <p className={smallText}>No projects created yet.</p>}
              {projects.map((proj: ProjectInfo) => (
                <button
                  key={proj.id}
                  className={proj.id === state.activeProjectId ? secondaryButton : ghostButton}
                  onClick={() => actions.setActiveProjectId(proj.id)}
                >
                  <span className="text-left text-sm font-semibold">{proj.name}</span>
                  <span className="ml-auto text-xs text-[#6b6f74]">
                    {proj.id === state.activeProjectId && isProjectUpdating ? "UPDATING" : proj.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Project Detail" description="Run answer generation, tweak scope, and audit outcomes.">
        {!project && isLoadingProject && (
          <div className={gridTwoCol}>
            <div className={cardBase}>
              <div className="grid gap-3">
                <span className={skeletonLine} />
                <span className={skeletonLineShort} />
                <span className={skeletonLineShort} />
                <div className="flex flex-wrap gap-2">
                  <span className={skeletonButton} />
                  <span className={skeletonButton} />
                  <span className={skeletonButton} />
                </div>
              </div>
            </div>
            <div className={cardBase}>
              <div className="grid gap-3">
                <span className={skeletonLineShort} />
                <span className={skeletonBlock} />
              </div>
            </div>
          </div>
        )}
        {!project && !isBusy && <p className={smallText}>Select a project to view questions and answers.</p>}
        {project && (
          <div className={gridTwoCol}>
            <div className={cardBase}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-serif text-lg font-semibold text-[#101419]">{project.name}</h3>
                  <p className={smallText}>Status: {isProjectUpdating ? "UPDATING" : project.status}</p>
                  <p className={smallText}>Scope: {project.scope}</p>
                </div>
                <span className={tagClass}>{project.scope}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button className={primaryButton} onClick={() => void actions.handleGenerateAnswers()} disabled={isActionLocked}>
                  {isGeneratingAnswers ? (
                    <span className="inline-flex items-center">
                      Generating answers
                      <LoadingDots />
                    </span>
                  ) : (
                    "Generate answers"
                  )}
                </button>
                <button className={secondaryButton} onClick={() => void actions.handleUpdateScope()} disabled={isActionLocked}>
                  {isUpdatingScope ? (
                    <span className="inline-flex items-center">
                      Updating scope
                      <LoadingDots />
                    </span>
                  ) : (
                    "Update scope"
                  )}
                </button>
                <button className={ghostButton} onClick={() => void actions.handleEvaluate()} disabled={isActionLocked}>
                  {isEvaluating ? (
                    <span className="inline-flex items-center">
                      Evaluating
                      <LoadingDots />
                    </span>
                  ) : (
                    "Evaluate"
                  )}
                </button>
              </div>
            </div>
            <div className={cardBase}>
              <h3 className="font-serif text-lg font-semibold text-[#101419]">Question Summary</h3>
              <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
                <div>
                  <span className={statLabel}>Questions</span>
                  <strong className={statValue}>{totalQuestions}</strong>
                </div>
                <div>
                  <span className={statLabel}>Answers</span>
                  <strong className={statValue}>{totalAnswers}</strong>
                </div>
                <div>
                  <span className={statLabel}>Manual edits</span>
                  <strong className={statValue}>{manualEditsCount}</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section title="Answer Review" description="Confirm, reject, or edit AI responses with citations.">
        {projectLoadError && <p className={smallText}>{projectLoadError}</p>}
        {renderAnswerPagination()}
        <div className="grid gap-3">
          {shouldShowAnswerSkeleton && (
            <div className={answerCardClass}>
              <div className="grid gap-3">
                <span className={skeletonLine} />
                <span className={skeletonBlock} />
                <div className="flex flex-wrap gap-2">
                  <span className={skeletonButton} />
                  <span className={skeletonButton} />
                  <span className={skeletonButton} />
                </div>
              </div>
            </div>
          )}
          {questions.map((question: Question) => {
            const answer = answerMap.get(question.id);
            return (
              <div key={question.id} className={answerCardClass}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#101419]">{question.text}</h3>
                    <p className={smallText}>Section: {question.section}</p>
                  </div>
                  {answer && <span className={tagClass}>{STATUS_LABELS[answer.status]}</span>}
                </div>
                {answer ? (
                  <div className="mt-3 space-y-3">
                    <p className="text-sm text-[#101419]">{answer.answer_text}</p>
                    <p className={smallText}>Confidence: {answer.confidence.toFixed(2)}</p>
                    <div className="flex flex-wrap gap-2">
                      {answer.citations.map((citation: Answer["citations"][number]) => (
                        <span key={citation.chunk_id} className={tagClass}>
                          {citation.excerpt.slice(0, 80)}...
                        </span>
                      ))}
                    </div>
                    <div className={fieldClass}>
                      <label className={labelClass}>Manual edit</label>
                      <textarea
                        className={textareaClass}
                        rows={3}
                        value={manualEdits[answer.id] ?? answer.manual_answer ?? ""}
                        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                          actions.setManualEdits({
                            ...manualEdits,
                            [answer.id]: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className={primaryButton} onClick={() => void actions.handleUpdateAnswer(answer, "CONFIRMED")} disabled={isActionLocked}>
                        Confirm
                      </button>
                      <button className={secondaryButton} onClick={() => void actions.handleUpdateAnswer(answer, "REJECTED")} disabled={isActionLocked}>
                        Reject
                      </button>
                      <button className={ghostButton} onClick={() => void actions.handleUpdateAnswer(answer, "MANUAL_UPDATED")} disabled={isActionLocked}>
                        Save manual
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className={smallText}>No answer yet.</p>
                )}
              </div>
            );
          })}
        </div>
        {renderAnswerPagination()}
      </Section>

      <Section title="Evaluation Report" description="Compare AI responses to manual edits and score quality.">
        {isLoadingProject && evaluations.length === 0 ? (
          <div className={cardBase}>
            <div className="grid gap-3">
              <span className={skeletonLine} />
              <span className={skeletonBlock} />
              <span className={skeletonLineShort} />
            </div>
          </div>
        ) : evaluations.length === 0 ? (
          <p className={smallText}>Run evaluation to compare AI answers with manual edits.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {evaluations.map((result: EvaluationResult) => (
              <div key={result.id} className={cardBase}>
                <p className={smallText}>Similarity: {result.similarity_score.toFixed(2)}</p>
                <p className="text-sm text-[#101419]">{result.notes}</p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
