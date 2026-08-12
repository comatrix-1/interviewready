# Saved Resume Selection Design

**Status:** Ready for implementation (see `docs/superpowers/plans/2026-08-12-saved-resume-selection.md`)

## Overview

Let a user choose a database-saved resume or upload a new PDF that is parsed, saved, selected, previewed, and eligible for ATS analysis. Saved resumes are user-owned, immutable JSON Resume snapshots stored in PostgreSQL; the frontend lists them after login and only an explicit selection (or a successful upload-save) enables analysis.

## Background / Problem

Today a parsed resume lives only in per-session shared memory. It is lost when the session resets, there is no way to persist a resume across sessions, and there is no catalog a user can choose from. The only paths into analysis are uploading a PDF (ephemeral) or pasting manual JSON. This spec adds durable, user-scoped resume records and an explicit selection that drives the preview and gates analysis.

## Goals

- Persist parsed `Resume` JSON snapshots per user in PostgreSQL.
- List the caller's saved resumes after login, newest first.
- Selecting a saved resume drives `currentResume` and the preview without re-running extraction.
- Uploading a new PDF parses it, saves it, selects it, and then runs analysis.
- "Analyze Resume" is disabled until a saved resume is selected.
- Keep the existing manual JSON flow working.

## Non-Goals

- Deletion or renaming of saved resumes.
- Storing uploaded PDF bytes (only parsed JSON is stored).
- An in-memory fallback store.
- Redesigning the manual JSON flow.
- Real authentication (identity remains `X-User-Id` with the `dev-user` fallback).

## Constraints

- Saved resumes are available only when `DATABASE_URL` is configured; there is no memory implementation.
- Consequence (intended): without `DATABASE_URL`, PDF uploads cannot be saved and PDF-based analysis is unavailable. The manual JSON flow remains the only analysis path.
- Store parsed `Resume` JSON, not PDF bytes.
- Scope records to the request identity (`X-User-Id`, `dev-user` fallback).
- Do not re-run extraction when a user selects an existing resume.
- Run `npm run lint:all` after implementation.

## Backend Design

### Data Model

New `saved_resumes` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | `String` PK | UUID (`uuid4`) |
| `user_id` | `String`, indexed | **Plain indexed string, NOT a FK** — see below |
| `filename` | `String` | Non-empty |
| `resume_data` | `JSONB` | `Resume.model_dump(mode="json")` snapshot |
| `created_at` | `DateTime(tz)`, server default | `func.now()` |

**FK decision (resolved):** `user_id` deliberately has **no foreign key** to `users.username`, matching the existing `SessionModel.user_id` precedent. Users rows are created only via `POST /users/login`; an FK would 500 on the `dev-user` fallback (requests without `X-User-Id`) and would force store tests to create `users` rows.

The existing normalized `ResumeModel` is unchanged — it cannot faithfully reconstruct the JSON Resume contract.

### Store (`app/db/resume_store.py`)

```python
@dataclass(frozen=True)
class SavedResumeRecord:
    id: str
    filename: str
    created_at: datetime
    resume: Resume

async def create(self, *, user_id: str, filename: str, resume: Resume) -> SavedResumeRecord: ...
async def list_for_user(self, *, user_id: str) -> list[SavedResumeRecord]: ...
```

- `build_resume_store()` raises a named `ResumePersistenceUnavailableError` when `async_session_factory is None`. No memory implementation.
- `get_resume_store()` is a lazy/cached accessor in `app/api/v1/services.py` so database-free app imports still work; route invocation gets the explicit unavailable error.
- List uses one query filtered to the caller, ordered `created_at DESC, id DESC`.
- Round trip: serialize with `model_dump(mode="json")`, validate with `Resume.model_validate`.

### API (`app/api/v1/endpoints/resumes.py`, prefix `/resumes`)

```
GET  /api/v1/resumes -> 200 {"resumes": [{"id", "filename", "createdAt", "resume"}]}
POST /api/v1/resumes -> 201 {"id", "filename", "createdAt", "resume"}
```

- Owner derived **only** from `resolve_user_id(request)`; never accepted in the request body.
- `CreateSavedResumeRequest(filename, resume)` with a `field_validator` that strips the filename and rejects a blank result (Pydantic → 422).
- Response uses camelCase `createdAt` aliases.
- `POST` registered with `status_code=201` (FastAPI defaults to 200).
- **Error mapping:** only `ResumePersistenceUnavailableError` → 503 `Saved resumes require DATABASE_URL to be configured.` Pydantic handles 422; unexpected DB errors propagate to server logs.
- Registered under the existing rate limit.

## Frontend Design

### API client (`frontend/api/resumes.ts`)

```ts
export interface SavedResume {
  id: string;
  filename: string;
  createdAt: string;
  resume: Resume;
}
export const listSavedResumes = (authToken: string): Promise<SavedResume[]>;
export const createSavedResume = (
  authToken: string,
  payload: Pick<SavedResume, "filename" | "resume">,
): Promise<SavedResume>;
```

- Uses `API_BASE_URL`, `Authorization: Bearer`, and `getUserHeaders()` (so unauthenticated calls fall back to `dev-user` on the backend).
- Parses error JSON `detail` when present.

### Workflow state (`useWorkflowState.ts`, `types/workflow.ts`)

- `SharedState` gains `selectedResumeId: string | null`.
- `currentResume` defaults to `null` (was `DEFAULT_RESUME`).
- Stale-local-storage check extended: missing/invalid `selectedResumeId` (or missing `atsReport`) resets to defaults.
- `defaultState` is exported so tests can assert the null defaults.
- `history` remains session-local history, not a resume catalog.
- Removed `DEFAULT_RESUME` imports become dead and are deleted (`useWorkflowState.ts` in this task, `App.tsx` in the UI task).

### UploadStep UI

- Labelled native `<select id="saved-resume-select">` with a disabled placeholder option, listing `savedResumes` by filename; disabled while loading.
- Empty-state copy when there are no saved resumes.
- File input stays below the select and remains usable without a selection.
- `Analyze Resume` button always rendered, `disabled={!selectedResumeId || isUploading || isLoadingResumes}`.
- Manual JSON block unchanged.

Props:

```ts
interface UploadStepProps {
  savedResumes: SavedResume[];
  selectedResumeId: string | null;
  isUploading: boolean;
  isLoadingResumes: boolean;
  onSelectResume: (resumeId: string) => void;
  onUploadSubmit: (file: File) => Promise<void>; // parse -> save -> analyze
  onAnalyzeResume: () => Promise<void>;          // analyze the selected saved resume
  manualResumeText: string;
  manualResumeError?: string | null;
  onManualResumeChange: (value: string) => void;
  onManualSubmit: () => void;
}
```

### WorkflowController (`App.tsx`)

- Loads `listSavedResumes(authToken)` on mount (the controller remounts per identity change because the provider resets `sessionReady` on login/logout). If the list call fails (e.g. 503 without `DATABASE_URL`), show a quiet "saved resumes unavailable" hint rather than a blocking error banner, keeping the manual flow usable.
- `handleSelectResume(resumeId)`: locate the record, atomically set `selectedResumeId` + `currentResume`, and clear derived reports (`atsReport`, `criticIssues`, `alignmentReport`).
- `handleUploadSubmit(file)`: PDF check → extract (`processPdfFile`) → if parse succeeds, `createSavedResume` → prepend to dropdown, set selection state → run ATS + critic via a shared `runAtsAndCritic(resume)` helper. Parse or save failure aborts before analysis: an unsaved upload must never appear selectable or analyzable.
- `handleAnalyzeResume()`: requires `selectedResumeId` and `currentResume`, then calls the existing `processExistingResume`, which does **not** append to `history` (re-analyzing a selection never duplicates it in session history).
- `processPdfFile` stays as-is (its `responseData` is no longer read by the upload path).

### ResumePreview

- Prop type widened from `resume: Resume` to `resume: Resume | null`; the existing falsy branch renders the empty workspace.
- `App.tsx` passes `state.currentResume` directly (the `?? DEFAULT_RESUME` fallback and its import are removed).

## Data Flow

### Upload a new PDF
```
handleUploadSubmit(file)
  -> processPdfFile(file)            // extraction request + fetchCurrentResume
  -> createSavedResume(authToken, {filename, resume})   // must succeed first
  -> prepend to savedResumes, set selectedResumeId + currentResume
     (also append saved.resume to session history)
  -> runAtsAndCritic(resume)         // ATS engine + ResumeCriticAgent in parallel
  -> status = AWAITING_ATS_APPROVAL
```

### Select an existing saved resume
```
handleSelectResume(id)
  -> find record in savedResumes
  -> set selectedResumeId + currentResume, clear atsReport/criticIssues/alignmentReport
  -> status stays IDLE (preview updates; Analyze enables)
```

### Analyze the selection
```
handleAnalyzeResume()
  -> requires selectedResumeId && currentResume
  -> processExistingResume()         // no history append
```

## Testing Strategy

- **Backend store:** integration tests against a disposable `TEST_DATABASE_URL` (same fixture pattern as `tests/test_db_models.py`); no `users` rows needed since `user_id` has no FK. Skipped intentionally without `TEST_DATABASE_URL`.
- **Backend endpoints:** stub the store by patching `app.api.v1.endpoints.resumes.get_resume_store` (deterministic regardless of ambient `DATABASE_URL`). Cover list identity scoping, create 201, blank filename 422, unavailable persistence 503.
- **Frontend client/state:** mock `globalThis.fetch = vi.fn()` (pattern from `tests/backendService.test.js`); assert request shape, user headers, and null defaults via exported `defaultState`.
- **Frontend UI:** component tests with `@testing-library/react` + `@testing-library/user-event` (new dev dependencies; jsdom already configured). Cover select interaction, disabled→enabled CTA, empty state, upload callback.
- **Verification:** backend pytest, frontend `npm run test` + `npm run build`, `npm run lint:all` (watch for the removed `DEFAULT_RESUME` imports).

## Manual Acceptance

With `DATABASE_URL` configured: upload `first.pdf` → saved/selected/previewed; upload `second.pdf`; reload → both appear newest first; select `first.pdf` → preview changes; Analyze disabled before selection, enabled after; a second user sees no cross-user records.
