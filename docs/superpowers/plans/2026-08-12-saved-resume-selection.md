# Saved Resume Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user choose a database-saved resume or upload a new PDF that is parsed, saved, selected, previewed, and eligible for ATS analysis.

**Architecture:** Create a user-owned `saved_resumes` PostgreSQL table containing an immutable JSON Resume snapshot, filename, and created timestamp. The frontend retrieves those records after login, selection drives `currentResume` and the preview, and only that explicit selection enables ATS analysis.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy async/PostgreSQL JSONB, React 19, TypeScript, Vitest, pytest.

**Spec:** `docs/superpowers/specs/2026-08-12-saved-resume-selection-design.md`

## Global Constraints

- Saved resumes are available only when `DATABASE_URL` is configured; do not add an in-memory fallback.
- Without `DATABASE_URL`, PDF uploads cannot be saved and PDF-based analysis is unavailable; the manual JSON flow remains the only analysis path. This is a deliberate consequence of the no-fallback constraint, not a bug.
- Store parsed `Resume` JSON, not uploaded PDF bytes.
- Scope saved records to the existing request identity (`X-User-Id`, with the backend's `dev-user` fallback).
- Do not re-run extraction when the user selects an existing resume.
- Retain the existing manual JSON flow; it is out of scope.
- Run `npm run lint:all` after implementation.

---

## File Structure

- `backend/app/db/models.py`: new `SavedResumeModel`.
- `backend/app/db/resume_store.py`: PostgreSQL-only persistence boundary.
- `backend/app/api/v1/services.py`, `backend/app/api/v1/endpoints/resumes.py`, `backend/app/api/v1/api.py`: list/create API.
- `backend/tests/test_resume_store.py`, `backend/tests/test_api_endpoints.py`, `backend/tests/test_db_models.py`: database and endpoint coverage.
- `frontend/types/resume.ts`, `frontend/api/resumes.ts`, `frontend/api/index.ts`: typed client contract.
- `frontend/types/workflow.ts`, `frontend/hooks/useWorkflowState.ts`: explicit selection state.
- `frontend/components/workflow-steps/UploadStep.tsx`, `frontend/App.tsx`, `frontend/components/ResumePreview.tsx`: selector, save flow, preview state.
- `frontend/tests/UploadStep.test.tsx`: UI behavior coverage.

### Task 1: Persist immutable, user-owned resume snapshots

**Files:**
- Modify: `backend/app/db/models.py`
- Create: `backend/app/db/resume_store.py`
- Modify: `backend/app/api/v1/services.py`
- Modify: `backend/tests/test_db_models.py`
- Create: `backend/tests/test_resume_store.py`

**Interfaces:**

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

- [ ] **Step 1: Write the failing store tests.** Use the existing disposable `TEST_DATABASE_URL` fixture pattern from `tests/test_db_models.py` (function-scoped engine; drop and recreate **all** tables). Create two Alice records and one Bob record; assert Alice receives only her records, newest first, and all JSON Resume fields survive the round trip. No `users` rows are needed — `user_id` is deliberately not a foreign key (see Step 3), so records insert independently.

```python
records = await store.list_for_user(user_id="alice")
assert [item.filename for item in records] == ["second.pdf", "first.pdf"]
assert all(item.resume == submitted_resume for item in records)
```

- [ ] **Step 2: Verify the test fails.**

Run: `cd backend; uv run pytest tests/test_resume_store.py -v`

Expected: FAIL because the model and store do not exist.

- [ ] **Step 3: Add `SavedResumeModel`.** Keep the pre-existing normalized `ResumeModel` unchanged; it cannot faithfully reconstruct the JSON Resume contract. Add a distinct table with a UUID-string primary key, an indexed `user_id` scoped to the request identity, non-empty `filename`, `resume_data: JSONB`, and server-generated `created_at`.

`user_id` is a plain indexed string with **no foreign key** — matching the existing `SessionModel.user_id` precedent. Users rows are created only via `POST /users/login`, so an FK would 500 on the `dev-user` fallback (requests without `X-User-Id`) and would make the Step 1 store tests fail, since Alice and Bob have no `users` row.

```python
class SavedResumeModel(Base):
    __tablename__ = "saved_resumes"
    id = Column(String, primary_key=True)
    # Plain indexed string, intentionally NOT a FK: matches SessionModel.user_id
    # and tolerates the dev-user fallback identity that has no users row.
    user_id = Column(String, nullable=False, index=True)
    filename = Column(String, nullable=False)
    resume_data = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

- [ ] **Step 4: Implement `DatabaseResumeStore`.** Serialize with `resume.model_dump(mode="json")`, create UUIDs with `uuid4()`, validate rows with `Resume.model_validate`, and list with one query filtered to the caller and ordered by `created_at.desc(), id.desc()`. Make `build_resume_store()` raise a named `ResumePersistenceUnavailableError` if `async_session_factory is None`; there is no memory implementation.

- [ ] **Step 5: Expose `get_resume_store()` safely.** Add a lazy/cached accessor to API services so database-free app imports still work, but route invocation gets the explicit unavailable error. Add `saved_resumes` to the expected table set in `tests/test_db_models.py::test_create_all_creates_expected_tables`.

- [ ] **Step 6: Verify and commit.**

Run: `cd backend; uv run pytest tests/test_db_models.py tests/test_resume_store.py -v`

Expected: PASS with `TEST_DATABASE_URL`; intentional skip without it.

```bash
git add backend/app/db/models.py backend/app/db/resume_store.py backend/app/api/v1/services.py backend/tests/test_db_models.py backend/tests/test_resume_store.py
git commit -m "feat: persist user resumes in postgres"
```

### Task 2: Add user-scoped resume APIs

**Files:**
- Create: `backend/app/api/v1/endpoints/resumes.py`
- Modify: `backend/app/api/v1/api.py`
- Modify: `backend/tests/test_api_endpoints.py`

**Interfaces:**

```text
GET  /api/v1/resumes -> {"resumes": [{"id", "filename", "createdAt", "resume"}]}
POST /api/v1/resumes -> {"id", "filename", "createdAt", "resume"}   (201)
```

- [ ] **Step 1: Write failing endpoint tests.** Stub the store by patching the service accessor — `patch("app.api.v1.endpoints.resumes.get_resume_store", ...)` — following the existing `patch("app.api.v1.endpoints.chat.get_orchestration_agent", ...)` pattern, so the tests are deterministic regardless of the ambient `DATABASE_URL`. Assert: list passes the `X-User-Id: alice` identity; create passes Alice and the supplied resume and returns 201; a blank/whitespace filename yields 422; unavailable persistence yields 503 with `Saved resumes require DATABASE_URL to be configured.`

```python
from unittest.mock import AsyncMock, MagicMock, patch


def _stub_resume_store(**kwargs):
    store = MagicMock()
    store.list_for_user = AsyncMock(return_value=kwargs.get("list_result", []))
    store.create = AsyncMock(return_value=kwargs.get("create_result"))
    return patch("app.api.v1.endpoints.resumes.get_resume_store", return_value=store)
```

```python
def test_create_saved_resume_returns_201():
    client = TestClient(app)
    created = SavedResumeRecord(
        id="r1",
        filename="resume.pdf",
        created_at=datetime.now(timezone.utc),
        resume=Resume(),
    )
    with _stub_resume_store(create_result=created):
        response = client.post(
            "/api/v1/resumes",
            headers={"X-User-Id": "alice"},
            json={"filename": "resume.pdf", "resume": {"skills": [{"name": "Python"}]}},
        )
    assert response.status_code == 201
    assert response.json()["filename"] == "resume.pdf"
```

```python
# Unavailable persistence -> 503 (patch the accessor, not the environment)
with patch(
    "app.api.v1.endpoints.resumes.get_resume_store",
    side_effect=ResumePersistenceUnavailableError(),
):
    response = client.get("/api/v1/resumes", headers={"X-User-Id": "alice"})
assert response.status_code == 503
assert response.json()["detail"] == "Saved resumes require DATABASE_URL to be configured."
```

- [ ] **Step 2: Verify the tests fail.**

Run: `cd backend; uv run pytest tests/test_api_endpoints.py -v`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement request/response schemas and routes.** Define `CreateSavedResumeRequest(filename: str, resume: Resume)` with a `field_validator` that strips the filename and rejects a blank result (Pydantic turns that into 422 automatically). Use camelCase `createdAt` aliases on the response. Register `POST` with `status_code=201` — FastAPI defaults to 200. Derive the owner only from `resolve_user_id(request)`; never accept a user ID in the request body.

```python
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.api.v1.services import get_resume_store, resolve_user_id
from app.db.resume_store import ResumePersistenceUnavailableError
from app.models.resume import Resume


class CreateSavedResumeRequest(BaseModel):
    filename: str
    resume: Resume

    @field_validator("filename")
    @classmethod
    def strip_and_require(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("filename must not be blank")
        return v


class SavedResumeResponse(BaseModel):
    id: str
    filename: str
    created_at: datetime = Field(alias="createdAt")
    resume: Resume

    model_config = ConfigDict(populate_by_name=True)
```

```python
@router.post("", status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.DEFAULT_RATE_LIMIT)
async def create_saved_resume(request: Request, body: CreateSavedResumeRequest) -> SavedResumeResponse:
    try:
        record = await get_resume_store().create(
            user_id=resolve_user_id(request),
            filename=body.filename,
            resume=body.resume,
        )
    except ResumePersistenceUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Saved resumes require DATABASE_URL to be configured.",
        ) from exc
    return SavedResumeResponse(
        id=record.id,
        filename=record.filename,
        createdAt=record.created_at,
        resume=record.resume,
    )
```

```python
@router.get("")
@limiter.limit(settings.DEFAULT_RATE_LIMIT)
async def list_saved_resumes(request: Request) -> dict:
    try:
        records = await get_resume_store().list_for_user(user_id=resolve_user_id(request))
    except ResumePersistenceUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Saved resumes require DATABASE_URL to be configured.",
        ) from exc
    return {
        "resumes": [
            {
                "id": r.id,
                "filename": r.filename,
                "createdAt": r.created_at,
                "resume": r.resume.model_dump(mode="json"),
            }
            for r in records
        ]
    }
```

- [ ] **Step 4: Map availability only.** Convert only `ResumePersistenceUnavailableError` to HTTP 503 (see Step 3). Let Pydantic handle malformed input as 422 and preserve unexpected database errors for server logging.

- [ ] **Step 5: Register, verify, commit.** Register under prefix `/resumes` and the existing rate limit.

Run: `cd backend; uv run pytest tests/test_api_endpoints.py -v`

Expected: PASS.

```bash
git add backend/app/api/v1/endpoints/resumes.py backend/app/api/v1/api.py backend/tests/test_api_endpoints.py
git commit -m "feat: add saved resume api"
```

### Task 3: Add frontend resume API and explicit selection state

**Files:**
- Modify: `frontend/types/resume.ts`, `frontend/api/index.ts`, `frontend/types/workflow.ts`, `frontend/hooks/useWorkflowState.ts`
- Create: `frontend/api/resumes.ts`
- Modify: `frontend/tests/App.test.tsx`

**Interfaces:**

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

- [ ] **Step 1: Write failing API and workflow-state tests.** Mock `globalThis.fetch = vi.fn()` with `mockResolvedValue({ ok, json })`, following `tests/backendService.test.js`. Assert list/create use `/api/v1/resumes`, include `getUserHeaders()`, and surface API details on failures. Assert the default workflow state has `currentResume: null` and `selectedResumeId: null` — `defaultState` is not exported yet, so Step 4 adds `export` to it, and the test asserts via `(await import("../hooks/useWorkflowState")).defaultState()` (the same dynamic-import style as the existing hydration tests).

- [ ] **Step 2: Verify they fail.**

Run: `cd frontend; npm run test -- --run tests/App.test.tsx`

Expected: FAIL because the saved-resume client/types and null selection state are absent.

- [ ] **Step 3: Implement typed client calls.** Send/receive exact API shapes, including existing authorization and user headers. Parse error JSON `detail` when present.

- [ ] **Step 4: Update persisted workflow state.** Add `selectedResumeId: string | null` to `SharedState`; make `currentResume` initially null; extend the stale-local-storage check so missing/invalid `selectedResumeId` (or missing `atsReport`) resets to defaults. Remove the now-unused `DEFAULT_RESUME` import from `useWorkflowState.ts` (the `App.tsx` one is removed in Task 4). Add `export` to `defaultState` so Task 3 Step 1's test can assert the null defaults. Keep `history` as session-local history rather than treating it as the resume catalog.

```ts
const defaultState = (): SharedState => ({
  currentResume: null,
  selectedResumeId: null,
  history: [],
  jobDescription: "",
  status: WorkflowStatus.IDLE,
  atsReport: null,
  criticIssues: [],
  alignmentReport: null,
  interviewHistory: [],
});
```

```ts
// Inside loadState(), extend the existing stale check:
if (
  !VALID_STATUSES.has(parsed.status) ||
  !("atsReport" in parsed) ||
  !("selectedResumeId" in parsed) ||
  (parsed.selectedResumeId !== null && typeof parsed.selectedResumeId !== "string")
) {
  localStorage.removeItem(STORAGE_KEY);
  return defaultState();
}
```

- [ ] **Step 5: Verify and commit.**

Run: `cd frontend; npm run test -- --run tests/App.test.tsx`

Expected: PASS.

```bash
git add frontend/types/resume.ts frontend/api/resumes.ts frontend/api/index.ts frontend/types/workflow.ts frontend/hooks/useWorkflowState.ts frontend/tests/App.test.tsx
git commit -m "feat: add saved resume client state"
```

### Task 4: Connect the dropdown, preview, upload-save, and ATS gate

**Files:**
- Modify: `frontend/components/workflow-steps/UploadStep.tsx`, `frontend/App.tsx`, `frontend/components/ResumePreview.tsx`
- Create: `frontend/tests/UploadStep.test.tsx`

**Interfaces:**

```ts
interface UploadStepProps {
  savedResumes: SavedResume[];
  selectedResumeId: string | null;
  isUploading: boolean;
  isLoadingResumes: boolean;
  onSelectResume: (resumeId: string) => void;
  onUploadSubmit: (file: File) => Promise<void>; // parse -> save -> analyze
  onAnalyzeResume: () => Promise<void>; // analyze the selected saved resume
  // Existing manual-JSON props (unchanged):
  manualResumeText: string;
  manualResumeError?: string | null;
  onManualResumeChange: (value: string) => void;
  onManualSubmit: () => void;
}
```

- [ ] **Step 1: Write failing UI interaction tests.** The project has no component-testing library yet, so install the dev dependencies first: `npm i -D @testing-library/react @testing-library/user-event` (jsdom is already configured in `vitest.config.ts`). Render two saved records; assert the labelled `Saved resume` select starts blank, choosing an option calls `onSelectResume`, and `Analyze Resume` is disabled until selection.

```tsx
// UploadStep is controlled: selection state lives in the parent, so re-render
// with the new prop to observe the CTA becoming enabled.
const props = {
  savedResumes: [
    { id: "resume-1", filename: "first.pdf", createdAt: "...", resume: {} },
    { id: "resume-2", filename: "second.pdf", createdAt: "...", resume: {} },
  ],
  selectedResumeId: null,
  isUploading: false,
  isLoadingResumes: false,
  onSelectResume,
  onUploadSubmit,
  onAnalyzeResume,
};
const { rerender } = render(<UploadStep {...props} />);

expect(screen.getByRole("button", { name: "Analyze Resume" })).toBeDisabled();
await user.selectOptions(screen.getByLabelText("Saved resume"), "resume-2");
expect(onSelectResume).toHaveBeenCalledWith("resume-2");
rerender(<UploadStep {...props} selectedResumeId="resume-2" />);
expect(screen.getByRole("button", { name: "Analyze Resume" })).toBeEnabled();
```

Also cover the empty-state copy, upload availability (the file input stays usable without a selection), and the upload input invoking `onUploadSubmit` with the chosen file.

- [ ] **Step 2: Verify the component test fails.**

Run: `cd frontend; npm run test -- --run tests/UploadStep.test.tsx`

Expected: FAIL because the component has no saved-resume props or selection-gated CTA.

- [ ] **Step 3: Implement the Upload-step UI.** Replace ephemeral `uploadedFile` selection state with the saved-resume props. Use a labelled native `<select>` with a placeholder option, keep the file input below it, and always render `Analyze Resume` with `disabled={!selectedResumeId || isUploading || isLoadingResumes}`.

```tsx
export const UploadStep: React.FC<UploadStepProps> = ({
  savedResumes,
  selectedResumeId,
  isUploading,
  isLoadingResumes,
  onSelectResume,
  onUploadSubmit,
  onAnalyzeResume,
  manualResumeText,
  manualResumeError,
  onManualResumeChange,
  onManualSubmit,
}) => {
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void onUploadSubmit(file);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-slate-900 mb-1.5">Resume Discovery</h3>
        <p className="text-[13px] text-slate-500 leading-relaxed">
          Select a saved resume or upload a PDF. Analysis only runs when you trigger it.
        </p>
      </div>

      <div className="mb-6">
        <label
          htmlFor="saved-resume-select"
          className="text-[11px] font-bold text-slate-500 uppercase tracking-widest"
        >
          Saved resume
        </label>
        <select
          id="saved-resume-select"
          value={selectedResumeId ?? ""}
          onChange={(e) => onSelectResume(e.target.value)}
          disabled={isLoadingResumes}
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-50"
        >
          <option value="" disabled>
            {isLoadingResumes ? "Loading saved resumes..." : "Select a saved resume"}
          </option>
          {savedResumes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.filename}
            </option>
          ))}
        </select>
        {savedResumes.length === 0 && !isLoadingResumes && (
          <p className="mt-2 text-[11px] text-slate-400">
            No saved resumes yet — upload a PDF below to save one.
          </p>
        )}
      </div>

      <label className="flex flex-col items-center justify-center border border-slate-200 rounded-xl p-12 cursor-pointer hover:bg-slate-50/50 hover:border-slate-300 transition-all group">
        <div className="w-12 h-12 bg-white border border-slate-100 rounded-lg flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform">
          <svg
            className="w-6 h-6 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            ></path>
          </svg>
        </div>
        <span className="text-xs font-semibold text-slate-900 mb-1">Upload Resume</span>
        <span className="text-[11px] text-slate-400">PDF, TXT, or MD up to 10MB</span>
        <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.txt,.md" />
      </label>

      <div className="mt-6">
        <button
          onClick={() => void onAnalyzeResume()}
          disabled={!selectedResumeId || isUploading || isLoadingResumes}
          className="w-full bg-slate-900 text-white text-[12px] font-semibold py-3 rounded-lg shadow-sm hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-all"
        >
          Analyze Resume
        </button>
      </div>

      {manualResumeText && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              Manual Resume JSON
            </h4>
          </div>
          <textarea
            value={manualResumeText}
            onChange={(e) => onManualResumeChange(e.target.value)}
            rows={10}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
            placeholder="Paste edited resume JSON here..."
          />
          {manualResumeError && <div className="text-[11px] text-red-600">{manualResumeError}</div>}
          <button
            onClick={onManualSubmit}
            className="w-full bg-slate-900 text-white text-[12px] font-semibold py-2.5 rounded-lg shadow-sm hover:bg-slate-800 transition-all"
          >
            Analyze Manual Resume
          </button>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Load saved resumes and apply a selection in `WorkflowController`.** Add local `savedResumes`, `isLoadingResumes`, and `isUploading` state; load the list on mount (`listSavedResumes(authToken)`) — the controller remounts per identity change because the provider resets `sessionReady` on login/logout. Selecting an option locates its record and atomically sets it as current while clearing derived reports. Also: pass `state.currentResume` directly to `ResumePreview` (removing `?? DEFAULT_RESUME`), delete the now-unused `DEFAULT_RESUME` import from `App.tsx`, and widen `ResumePreview`'s prop type to `resume: Resume | null` (its empty-state branch already handles falsy `resume`). If the list call fails (e.g. 503 when `DATABASE_URL` is absent), leave the list empty with the empty-state hint in place of a blocking error banner, so the manual JSON flow stays usable.

```tsx
const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
const [isLoadingResumes, setIsLoadingResumes] = useState(false);
const [isUploading, setIsUploading] = useState(false);

useEffect(() => {
  let cancelled = false;
  setIsLoadingResumes(true);
  listSavedResumes(authToken)
    .then((resumes) => {
      if (!cancelled) setSavedResumes(resumes);
    })
    .catch(() => {
      // Non-blocking: saved resumes are an enhancement. Without DATABASE_URL the
      // call 503s; keep the list empty and the manual JSON flow stays usable.
      if (!cancelled) setSavedResumes([]);
    })
    .finally(() => {
      if (!cancelled) setIsLoadingResumes(false);
    });
  return () => {
    cancelled = true;
  };
}, [authToken]);
```

```tsx
const runAtsAndCritic = async (resume: Resume) => {
  const [atsResult, criticResult] = await Promise.all([
    atsEngineAnalyze(authToken, resume),
    resumeCriticAgent(sessionId, authToken, resume),
  ]);
  updateState((prev) => ({
    ...prev,
    atsReport: atsResult,
    criticIssues: criticResult.issues || [],
    status: WorkflowStatus.AWAITING_ATS_APPROVAL,
  }));
};

const handleSelectResume = (resumeId: string) => {
  const saved = savedResumes.find((r) => r.id === resumeId);
  if (!saved) return;
  updateState((prev) => ({
    ...prev,
    selectedResumeId: saved.id,
    currentResume: saved.resume,
    atsReport: null,
    criticIssues: [],
    alignmentReport: null,
  }));
};
```

```tsx
// ResumePreview.tsx — widen the prop type (the empty-state branch already exists):
interface ResumePreviewProps {
  resume: Resume | null;
}

// App.tsx — drop the DEFAULT_RESUME fallback (and the import):
<ResumePreview resume={state.currentResume} />
```

- [ ] **Step 5: Save uploaded PDFs before they become selectable.** Keep the current PDF extraction request. After `fetchCurrentResume` returns a non-null resume, call `createSavedResume`, prepend the record to the dropdown, set `selectedResumeId` and `currentResume`, then run analysis via the shared `runAtsAndCritic` helper. If parsing or saving fails, display the error and do not proceed to analysis; this prevents an unsaved upload from appearing as an available resume. This replaces the old `handleSuccessfulProcessing` upload path (`processPdfFile` keeps returning `responseData` for compatibility, but the upload path no longer reads it).

```tsx
const handleUploadSubmit = async (file: File) => {
  setError(null);
  setManualResumeError(null);

  const isPdf =
    file.type === "application/pdf" ||
    file.type === "application/x-pdf" ||
    file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    setError("Unsupported file type. Please upload a PDF resume.");
    return;
  }

  setIsUploading(true);
  startLoading("Analyzing your resume...", [
    "Uploading file",
    "Saving resume",
    "Running ATS engine",
    "Analyzing resume structure",
    "Generating insights",
  ]);
  try {
    const { parsedResume } = await processPdfFile(file);
    if (!parsedResume) {
      setError("Failed to parse the resume. Please try another PDF.");
      return;
    }

    // Save first: an unsaved upload must never appear selectable or analyzable.
    const saved = await createSavedResume(authToken, {
      filename: file.name,
      resume: parsedResume,
    });
    setSavedResumes((prev) => [saved, ...prev.filter((r) => r.id !== saved.id)]);
    updateState((prev) => ({
      ...prev,
      selectedResumeId: saved.id,
      currentResume: saved.resume,
      history: [...prev.history, saved.resume],
    }));

    await runAtsAndCritic(saved.resume);
    updateProgress(100, 3);
  } catch (err: unknown) {
    setError(toErrorMessage(err) || "Failed to process resume");
  } finally {
    setIsUploading(false);
    stopLoading();
  }
};
```

- [ ] **Step 6: Gate selected-resume analysis.** Replace the old no-file branch of `handleUploadSubmit` with a dedicated `onAnalyzeResume` handler that requires both `selectedResumeId` and `currentResume`, then calls the existing `processExistingResume`. `processExistingResume` does not append to `history`, so re-analyzing a saved selection never duplicates it in session history.

```tsx
const handleAnalyzeResume = async () => {
  if (!state.selectedResumeId || !state.currentResume) {
    setError("Select a saved resume to analyze.");
    return;
  }
  await processExistingResume();
};
```

Note: `processPdfFile` and `processExistingResume` stay as they are today; `handleSuccessfulProcessing` is replaced by the `handleUploadSubmit` flow above (or kept as a thin wrapper around `runAtsAndCritic`).

Finally, wire everything into the `UploadStep` render (shown in `IDLE`/`EXTRACTING` status):

```tsx
<UploadStep
  savedResumes={savedResumes}
  selectedResumeId={state.selectedResumeId}
  isUploading={isUploading}
  isLoadingResumes={isLoadingResumes}
  onSelectResume={handleSelectResume}
  onUploadSubmit={handleUploadSubmit}
  onAnalyzeResume={handleAnalyzeResume}
  manualResumeText={manualResumeText}
  manualResumeError={manualResumeError}
  onManualResumeChange={setManualResumeText}
  onManualSubmit={submitManualResume}
/>
```

- [ ] **Step 7: Verify and commit.**

Run:

```bash
cd frontend
npm run test -- --run tests/UploadStep.test.tsx tests/App.test.tsx
npm run build
```

Expected: PASS.

```bash
git add frontend/components/workflow-steps/UploadStep.tsx frontend/App.tsx frontend/components/ResumePreview.tsx frontend/tests/UploadStep.test.tsx
git commit -m "feat: select saved resumes before ATS analysis"
```

### Task 5: Document and perform final verification

**Files:**
- Modify: `backend/README.md`
- Modify: `frontend/README.md`

- [ ] **Step 1: Document the contract.** Add list/create endpoint documentation, identity scoping, JSON-snapshot storage, and the required `DATABASE_URL` condition (including the consequence that PDF upload/analysis is unavailable without it) to the backend README. Update the frontend workflow description: select a saved resume or upload a PDF; selection refreshes the preview; analysis remains disabled without a selection.

- [ ] **Step 2: Run the verification suite.**

```bash
cd backend
uv run pytest tests/test_api_endpoints.py tests/test_db_models.py tests/test_resume_store.py -v
cd ../frontend
npm run test
npm run build
cd ..
npm run lint:all
```

Expected: all non-PostgreSQL tests pass; PostgreSQL tests pass with `TEST_DATABASE_URL` or skip intentionally without it; frontend test/build pass; lint has no introduced issues (including the removed `DEFAULT_RESUME` imports).

- [ ] **Step 3: Manual acceptance check.** With `DATABASE_URL` configured: upload `first.pdf`, confirm it is saved/selected and previewed; upload `second.pdf`; reload and confirm both appear newest first; select `first.pdf` and confirm the preview changes; confirm Analyze is disabled before selection and enabled after it; log in as another user and confirm no cross-user records appear.

- [ ] **Step 4: Inspect and commit.**

Run: `git diff --check; git status --short`

Expected: no whitespace errors and only intended changes.

```bash
git add backend/README.md frontend/README.md
git commit -m "docs: document saved resume workflow"
```

## Plan Self-Review

- Each requested outcome maps to a task: persistence (Task 1), retrieval/dropdown (Tasks 2 and 4), explicit ATS gate (Tasks 3 and 4), and selected-preview behavior (Task 4).
- The plan preserves PostgreSQL-only saved-resume behavior and introduces no implicit memory catalog. Without `DATABASE_URL`, PDF uploads are unavailable by design (global constraint); the manual JSON flow remains the only analysis path.
- `user_id` is a plain indexed string, not a foreign key, matching the `SessionModel` precedent — this keeps the `dev-user` fallback working and the store tests free of `users`-row setup.
- `ResumePreview` accepts `Resume | null` and renders the empty workspace until a saved resume is selected; stale `DEFAULT_RESUME` imports are removed with their last usages.
- It intentionally excludes deletion, renaming, PDF blob storage, and manual-resume redesign.
