# ATS Check Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Combine the Resume Critic and Content Strength steps into a single "ATS Check" step powered by the deterministic ATS Engine + ResumeCriticAgent running in parallel.

**Architecture:** The frontend fires two calls in parallel on upload: `POST /api/v1/ats/analyze` (REST, deterministic, <100ms) and the existing chat-based ResumeCriticAgent. Results are displayed in a unified ATSCheckStep component with score breakdown, critic issues, and expandable per-section ATS details. The ContentStrengthAgent is dropped entirely.

**Tech Stack:** React + TypeScript (Vite), Tailwind CSS, FastAPI backend (ATS engine already exists)

**Spec:** `docs/superpowers/specs/2026-06-20-ats-check-step-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/types/reports.ts` | Modify | Add ATS report types |
| `frontend/types/workflow.ts` | Modify | Update WorkflowStatus enum + SharedState |
| `frontend/api/ats.ts` | Create | ATS engine REST client |
| `frontend/components/workflow-steps/ATSCheckStep.tsx` | Create | Combined ATS check UI component |
| `frontend/components/WorkflowSteps.tsx` | Modify | Export ATSCheckStep, remove old exports |
| `frontend/components/StepIndicator.tsx` | Modify | 4-step indicator |
| `frontend/hooks/useWorkflowState.ts` | Modify | Updated navigation for ATS step |
| `frontend/App.tsx` | Modify | Wire ATSCheckStep, remove CriticStep/ContentStep |
| `frontend/backendService.ts` | Modify | Remove contentStrengthAgent, add atsEngine |
| `frontend/types/api.ts` | Modify | Remove CONTENT_STRENGTH from ChatRequest intent union |
| `frontend/components/workflow-steps/ContentStep.tsx` | Delete | No longer needed |
| `frontend/api/chat-endpoints/contentStrength.ts` | Delete | No longer needed |

---

### Task 1: Update TypeScript Types (workflow + reports + api)

**Files:**
- Modify: `frontend/types/reports.ts`
- Modify: `frontend/types/workflow.ts`
- Modify: `frontend/types/api.ts`

**Context:** These are the foundational types. All other tasks depend on these being correct.

**Current `frontend/types/reports.ts`:**
```typescript
export type EvidenceStrength = "HIGH" | "MEDIUM" | "LOW";
export type ResumeCriticIssueType = "ats" | "structure" | "impact" | "readability";
export type ResumeCriticSeverity = "HIGH" | "MEDIUM" | "LOW";
export type ContentSuggestionType = "action_verb" | "specificity" | "structure" | "redundancy";

export interface ResumeCriticIssue {
  location: string;
  type: ResumeCriticIssueType;
  severity: ResumeCriticSeverity;
  description: string;
}

export interface ResumeCriticReport {
  issues: ResumeCriticIssue[];
  summary: string;
  score?: number;
}

export interface ContentSuggestion {
  location: string;
  original: string;
  suggested: string;
  evidenceStrength: EvidenceStrength;
  type: ContentSuggestionType;
}

export interface ContentStrengthReport {
  suggestions: ContentSuggestion[];
  summary: string;
  score?: number;
}

export interface AlignmentReport {
  skillsMatch: string[];
  missingSkills: string[];
  experienceMatch: string[];
  summary: string;
}

export type ResumeLookupResult = {
  isValid: boolean;
  display?: string;
  topLevel?: string;
  usedSectionAsEvidence?: boolean;
};
```

**Changes to `frontend/types/reports.ts`:**
- Keep: `ResumeCriticIssue`, `ResumeCriticReport`, `AlignmentReport`, `ResumeLookupResult`, and all existing type aliases
- Remove: `ContentSuggestion`, `ContentStrengthReport`, `EvidenceStrength`, `ContentSuggestionType`
- Add the following new types:

```typescript
export type ATSPassStatus = "ok" | "no" | "min";

export interface ATSCheck {
  pass: ATSPassStatus;
  bullet_to_highlight: number[] | null;
  message: string | null;
  suggestions: string[] | null;
}

export interface ATSSection {
  section: string;
  checks: Record<string, ATSCheck>;
}

export interface ATSScoreBreakdown {
  section_presence: number;
  bullet_quality: number;
  jd_keyword_match: number;
  semantic_match: number;
  bonuses: number;
  penalties: number;
  raw_score: number;
  max_possible: number;
}

export interface ATSReport {
  ats_score: number;
  sections: ATSSection[];
  score_breakdown: ATSScoreBreakdown | null;
  keyword_match: {
    match_percentage: number;
    matched_keywords: string[];
    missing_keywords: string[];
  } | null;
  validation_warnings: string[];
}
```

**Current `frontend/types/workflow.ts`:**
```typescript
import type { ResumeSchema } from "./resume";
import type { ResumeCriticReport, ContentStrengthReport, AlignmentReport } from "./reports";

export enum WorkflowStatus {
  IDLE = "IDLE",
  EXTRACTING = "EXTRACTING",
  ROUTING = "ROUTING",
  CRITIQUING = "CRITIQUING",
  AWAITING_CRITIC_APPROVAL = "AWAITING_CRITIC_APPROVAL",
  ANALYZING_CONTENT = "ANALYZING_CONTENT",
  AWAITING_CONTENT_APPROVAL = "AWAITING_CONTENT_APPROVAL",
  ALIGNING_JD = "ALIGNING_JD",
  AWAITING_ALIGNMENT_APPROVAL = "AWAITING_ALIGNMENT_APPROVAL",
  INTERVIEWING = "INTERVIEWING",
  SELECTING_INTERVIEW_MODE = "SELECTING_INTERVIEW_MODE",
  DEBUG_VOICE = "DEBUG_VOICE",
  COMPLETED = "COMPLETED",
}

export type InterviewMode = "CHAT" | "VOICE";

export interface InterviewMessage {
  role: "user" | "agent";
  text: string;
}

export interface SharedState {
  currentResume: ResumeSchema | null;
  history: ResumeSchema[];
  jobDescription: string;
  status: WorkflowStatus;
  criticReport: ResumeCriticReport | null;
  contentReport: ContentStrengthReport | null;
  alignmentReport: AlignmentReport | null;
  interviewHistory: InterviewMessage[];
  interviewMode?: InterviewMode;
}
```

**Changes to `frontend/types/workflow.ts`:**
- In the `WorkflowStatus` enum:
  - Remove: `CRITIQUING`, `AWAITING_CRITIC_APPROVAL`, `ANALYZING_CONTENT`, `AWAITING_CONTENT_APPROVAL`
  - Add: `ATS_CHECKING = "ATS_CHECKING"`, `AWAITING_ATS_APPROVAL = "AWAITING_ATS_APPROVAL"`
- Update imports: replace `ContentStrengthReport` with `ATSReport`, keep `ResumeCriticReport` (rename import to use `ResumeCriticIssue`)
- In `SharedState`:
  - Remove: `criticReport`, `contentReport`
  - Add: `atsReport: ATSReport | null`, `criticIssues: ResumeCriticIssue[]`

**Changes to `frontend/types/api.ts`:**
- In `ChatRequest.intent`: remove `"CONTENT_STRENGTH"` from the union type

---

### Task 2: Create ATS Engine REST Client

**Files:**
- Create: `frontend/api/ats.ts`

**Context:** The backend ATS endpoint already exists at `POST /api/v1/ats/analyze`. The frontend needs a new REST client to call it. Follow the pattern in `frontend/api/session.ts` and `frontend/api/chat.ts` (they use `fetch` with `API_BASE_URL` from `../config/env`).

**Reference — how other API calls are structured (`frontend/api/chat.ts`):**
```typescript
import type { ChatRequest, ChatResponse } from "../types/api";
import { API_BASE_URL } from "../config/env";
import { uint8ArrayToBase64 } from "../utils/base64";

export const callChatEndpoint = async (
  sessionId: string,
  authToken: string,
  request: ChatRequest,
): Promise<ChatResponse> => {
  // ... fetch with API_BASE_URL
};
```

**Reference — backend ATS request/response models:**
- Request: `{ resume: Resume, job_description?: string, critic_issues?: CriticIssue[] }`
- Response: `{ ats_score: int, sections: [...], detailed_results: {...}, keyword_match: {...}|null, critic_penalty: int|null, score_breakdown: {...}|null, semantic_score: float|null, validation_warnings: [...] }`

**Backend endpoint registration:** `api_router.include_router(ats.router, prefix="/ats", tags=["ats"])` under `/api/v1`

**Create `frontend/api/ats.ts` with:**
```typescript
import type { Resume } from "@/types/resume";
import type { ATSReport, ResumeCriticIssue } from "@/types/reports";
import { API_BASE_URL } from "@/config/env";

interface ATSAnalysisRequest {
  resume: Resume;
  job_description?: string;
  critic_issues?: Array<{
    location: string;
    type: string;
    severity: string;
    description: string;
  }>;
}

export const atsEngineAnalyze = async (
  authToken: string,
  resume: Resume,
  criticIssues?: ResumeCriticIssue[],
): Promise<ATSReport> => {
  const body: ATSAnalysisRequest = { resume };
  if (criticIssues && criticIssues.length > 0) {
    body.critic_issues = criticIssues;
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/ats/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`ATS analysis failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as ATSReport;
};
```

Note: The backend uses snake_case field names (`ats_score`, `score_breakdown`), so the frontend `ATSReport` type must use snake_case to match.

---

### Task 3: Create ATSCheckStep Component

**Files:**
- Create: `frontend/components/workflow-steps/ATSCheckStep.tsx`

**Context:** This replaces both `CriticStep` and `ContentStep`. It displays ATS score, score breakdown, critic issues, and expandable per-section ATS check details.

**Props interface:**
```typescript
interface ATSCheckStepProps {
  atsReport: ATSReport;
  criticIssues: ResumeCriticIssue[];
  resume?: Resume | null;
  onApprove: () => void;
  onReRun: () => void;
}
```

**Layout (top to bottom):**

1. **ReportHeader** — title="ATS Check", summary from critic (if any issues, use "Found N issues"; if no issues, use "No critical issues detected"), score = `atsReport.ats_score`, scoreLabel="ATS Score"

2. **Score Breakdown Bar** — if `atsReport.score_breakdown` exists, show a horizontal segmented bar. Each segment: label + point value. Use colored segments:
   - `section_presence`: emerald/green (positive)
   - `bullet_quality`: blue (positive)
   - `bonuses`: slate (neutral)
   - `penalties`: red (negative)

3. **Critic Issues section** (collapsible, default open) — if `criticIssues.length > 0`, show each issue with:
   - Severity badge (HIGH=red, MEDIUM=amber, LOW=slate) — same `severityClass` pattern from existing CriticStep
   - Type label (uppercase)
   - Description text
   - Section location using `resolveResumeLocation` and `capitalizeFirst` utilities

4. **Section Details section** (collapsible, default collapsed) — for each `atsReport.sections`, show:
   - Section name (humanize: `experience_0` → "Experience #1")
   - For each check in `section.checks`: check name (humanize camelCase → Title Case), pass status icon (ok=green dot, no=red dot, min=amber dot), message, suggestions list if present

5. **Buttons:**
   - "Re-run ATS Check" — secondary style (border + transparent bg), calls `onReRun`
   - "Proceed to Job Alignment" — primary style (bg-slate-900 text-white), calls `onApprove`

**Existing component patterns to follow:**
- Use `ReportHeader` from `../ReportHeader` (props: `title`, `summary`, `score`, `scoreLabel`)
- Use `resolveResumeLocation` from `@/utils/resolve-resume-location`
- Use `capitalizeFirst` from `@/utils/text`
- Match Tailwind styling from existing CriticStep/ContentStep (same text sizes, spacing, colors)
- Use `animate-in fade-in slide-in-from-bottom-2 duration-400 space-y-6` for entry animation

**Collapsible section pattern:**
```tsx
const [expanded, setExpanded] = useState(true);
// ...
<button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 w-full">
  <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} ...chevron icon />
  <span>Section Title</span>
</button>
{expanded && <div>content</div>}
```

---

### Task 4: Update StepIndicator, useWorkflowState, WorkflowSteps exports

**Files:**
- Modify: `frontend/components/StepIndicator.tsx`
- Modify: `frontend/hooks/useWorkflowState.ts`
- Modify: `frontend/components/WorkflowSteps.tsx`

**Current `frontend/components/StepIndicator.tsx` (key parts):**
```typescript
const steps = [
  { status: WorkflowStatus.IDLE, label: "Upload" },
  { status: WorkflowStatus.CRITIQUING, label: "Critic" },
  { status: WorkflowStatus.ANALYZING_CONTENT, label: "Content" },
  { status: WorkflowStatus.ALIGNING_JD, label: "Matching" },
  { status: WorkflowStatus.INTERVIEWING, label: "Interview" },
];

// getStepIndex maps AWAITING_* statuses to step indices
```

**Changes to StepIndicator.tsx:**
- Update `steps` array to 4 items:
  ```typescript
  const steps = [
    { status: WorkflowStatus.IDLE, label: "Upload" },
    { status: WorkflowStatus.ATS_CHECKING, label: "ATS Check" },
    { status: WorkflowStatus.ALIGNING_JD, label: "Matching" },
    { status: WorkflowStatus.INTERVIEWING, label: "Interview" },
  ];
  ```
- Update `getStepIndex`:
  - `AWAITING_ATS_APPROVAL` → return 1
  - `AWAITING_ALIGNMENT_APPROVAL` → return 2
  - Interviewing/Completed/SelectingMode/DebugVoice → return 3
  - Remove references to old statuses

**Current `frontend/hooks/useWorkflowState.ts` (key parts):**
```typescript
const defaultState = (): SharedState => ({
  currentResume: DEFAULT_RESUME,
  history: [],
  jobDescription: "",
  status: WorkflowStatus.IDLE,
  criticReport: null,
  contentReport: null,
  alignmentReport: null,
  interviewHistory: [],
});

// handleStepClick navigation rules
```

**Changes to useWorkflowState.ts:**
- Update `defaultState()`:
  - Remove: `criticReport: null`, `contentReport: null`
  - Add: `atsReport: null`, `criticIssues: []`
- Update `handleStepClick`:
  - `canNavigate`: replace `CRITIQUING` with `ATS_CHECKING` (guard: `!!state.currentResume`), remove `ANALYZING_CONTENT`
  - `completedStatus`: replace `CRITIQUING → AWAITING_CRITIC_APPROVAL` with `ATS_CHECKING → AWAITING_ATS_APPROVAL`, remove `ANALYZING_CONTENT → AWAITING_CONTENT_APPROVAL`
  - `reportAvailable`: replace `CRITIQUING → !!state.criticReport` with `ATS_CHECKING → !!state.atsReport`, remove `ANALYZING_CONTENT`
  - Update dependencies array: replace `state.criticReport`, `state.contentReport` with `state.atsReport`

**Changes to WorkflowSteps.tsx:**
```typescript
export { UploadStep } from "./workflow-steps/UploadStep";
export { ATSCheckStep } from "./workflow-steps/ATSCheckStep";
export { AlignmentStep } from "./workflow-steps/AlignmentStep";
export { AlignmentReportStep } from "./workflow-steps/AlignmentReportStep";
export { InterviewModeSelectionStep } from "./workflow-steps/InterviewModeSelectionStep";
export { InterviewStep } from "./workflow-steps/InterviewStep";
```

---

### Task 5: Wire Everything in App.tsx + backendService.ts + Cleanup

**Files:**
- Modify: `frontend/App.tsx`
- Modify: `frontend/backendService.ts`
- Delete: `frontend/components/workflow-steps/ContentStep.tsx`
- Delete: `frontend/api/chat-endpoints/contentStrength.ts`

**Context:** App.tsx is the main orchestrator. It imports all step components, manages state transitions, and handles API calls. The `WorkflowController` component renders the appropriate step based on `state.status`.

**Changes to `frontend/backendService.ts`:**
- Remove import of `contentStrengthAgent` and `ContentStrengthReport`
- Add import of `atsEngineAnalyze` from `./api/ats`
- Add import of `ATSReport` type
- Remove `contentStrengthAgent` method from `BackendService` class
- Remove `contentStrengthAgent` exported function
- Add `atsEngineAnalyze` method to class:
  ```typescript
  async atsEngineAnalyze(resume: Resume, criticIssues?: ResumeCriticIssue[]): Promise<ATSReport> {
    return atsEngineAnalyze(this.getAuthToken(), resume, criticIssues);
  }
  ```
- Add exported function:
  ```typescript
  export const atsEngineAnalyzeService = (resume: Resume, criticIssues?: ResumeCriticIssue[]) =>
    backendService.atsEngineAnalyze(resume, criticIssues);
  ```

**Changes to `frontend/App.tsx`:**

Remove imports:
- `contentStrengthAgent` from `@/api/chat-endpoints/contentStrength`
- `ContentStep` from `WorkflowSteps` (already removed from exports)

Add imports:
- `atsEngineAnalyze` from `@/api/ats`
- `ATSCheckStep` from `WorkflowSteps` (new export)

Update `WorkflowController`:

1. **`handleSuccessfulProcessing`** (called after PDF upload+parse): Instead of just calling `resumeCriticAgent` and storing `criticReport`, now fire BOTH calls in parallel:
   ```typescript
   const [atsResult, criticResult] = await Promise.all([
     atsEngineAnalyze(authToken, parsedResume || prev.currentResume!),
     resumeCriticAgent(sessionId, authToken, parsedResume || prev.currentResume!),
   ]);
   updateState((prev) => ({
     ...prev,
     currentResume: parsedResume || prev.currentResume,
     history: parsedResume ? [...prev.history, parsedResume!] : prev.history,
     atsReport: atsResult,
     criticIssues: criticResult.issues || [],
     status: WorkflowStatus.AWAITING_ATS_APPROVAL,
   }));
   ```

2. **`processExistingResume`**: Same parallel pattern:
   ```typescript
   const [atsResult, criticResult] = await Promise.all([
     atsEngineAnalyze(authToken, state.currentResume!),
     resumeCriticAgent(sessionId, authToken, state.currentResume!),
   ]);
   updateState((prev) => ({
     ...prev,
     atsReport: atsResult,
     criticIssues: criticResult.issues || [],
     status: WorkflowStatus.AWAITING_ATS_APPROVAL,
   }));
   ```

3. **`submitManualResume`**: Same parallel pattern after parsing JSON.

4. **Remove `approveCritic`** function entirely.

5. **Remove `approveContent`** function entirely.

6. **Add `approveATSCheck`** function:
   ```typescript
   const approveATSCheck = () =>
     updateState((prev) => ({ ...prev, status: WorkflowStatus.ALIGNING_JD }));
   ```

7. **Add `reRunATSCheck`** function:
   ```typescript
   const reRunATSCheck = async () => {
     if (!state.currentResume) return;
     startLoading("Re-running ATS check...", [
       "Analyzing resume",
       "Running ATS engine",
       "Checking critic issues",
     ]);
     try {
       const [atsResult, criticResult] = await Promise.all([
         atsEngineAnalyze(authToken, state.currentResume),
         resumeCriticAgent(sessionId, authToken, state.currentResume),
       ]);
       updateState((prev) => ({
         ...prev,
         atsReport: atsResult,
         criticIssues: criticResult.issues || [],
       }));
     } catch (err: unknown) {
       setError(toErrorMessage(err) || "Failed to re-run ATS check");
     } finally {
       stopLoading();
     }
   };
   ```

8. **Update JSX rendering** — replace the CriticStep and ContentStep blocks with:
   ```tsx
   {(state.status === WorkflowStatus.ATS_CHECKING ||
     state.status === WorkflowStatus.AWAITING_ATS_APPROVAL) &&
     state.atsReport && (
       <ATSCheckStep
         atsReport={state.atsReport}
         criticIssues={state.criticIssues}
         resume={state.currentResume}
         onApprove={approveATSCheck}
         onReRun={reRunATSCheck}
       />
     )}
   ```

9. **Update loading messages** in `handleUploadSubmit` and `processExistingResume`:
   ```typescript
   startLoading("Analyzing your resume...", [
     "Uploading file",        // (for PDF upload only)
     "Running ATS engine",
     "Analyzing resume structure",
     "Generating insights",
   ]);
   ```

**Delete files:**
- `frontend/components/workflow-steps/ContentStep.tsx`
- `frontend/api/chat-endpoints/contentStrength.ts`

---

### Task 6: Verify and Lint

After all code changes:
1. Run `npm run lint:all` from project root — fix any lint errors introduced by the changes
2. Verify the frontend compiles: `cd frontend && npx vite build`
3. Verify existing tests still compile: `cd frontend && npx vitest run` (some tests may reference old types — update as needed)
