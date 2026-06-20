# ATS Check Step Design

## Overview

Combine the Resume Critic step and Content Strength step into a single "ATS Check" step. Drop the ContentStrengthAgent entirely. Replace with the deterministic ATS Engine + ResumeCriticAgent running in parallel.

## Architecture

### Current Flow (5 steps)
1. Upload → Parse PDF
2. Resume Critic (LLM) → issues + score
3. Content Strength (LLM) → suggestions + score
4. Job Alignment → JD matching
5. Interview

### New Flow (4 steps)
1. Upload → Parse PDF
2. **ATS Check** (ATS Engine + ResumeCriticAgent in parallel) → score + issues + breakdown
3. Job Alignment → JD matching
4. Interview

### Parallel Execution

On upload/analyze, fire both calls simultaneously:
- **ATS Engine** (`POST /api/v1/ats/analyze`) — deterministic, <100ms. Returns `ats_score`, `sections`, `score_breakdown`.
- **ResumeCriticAgent** (chat endpoint, `RESUME_CRITIC` intent) — LLM-based, ~2-3s. Returns `issues`, `summary`.

Re-run fires both again with the current resume state.

## UI Design

New `ATSCheckStep` component layout (top to bottom):

1. **ReportHeader** — "ATS Check" title, critic summary text, ATS score (0-100) as prominent number
2. **Score Breakdown Bar** — horizontal segments: Section Presence | Bullet Quality | Bonuses | Penalties, each labeled with points
3. **Critic Issues** (collapsible, default open) — list from ResumeCriticAgent: severity badge (HIGH/MEDIUM/LOW), type, description, section location
4. **Section Details** (collapsible, default collapsed) — expandable per-section ATS checks: check name, pass/no/min status, message, suggestions
5. **Action buttons:**
   - "Re-run ATS Check" (secondary) — re-fires both parallel calls
   - "Proceed to Job Alignment" (primary)

## Workflow & State Changes

### WorkflowStatus Enum
- Remove: `CRITIQUING`, `AWAITING_CRITIC_APPROVAL`, `ANALYZING_CONTENT`, `AWAITING_CONTENT_APPROVAL`
- Add: `ATS_CHECKING`, `AWAITING_ATS_APPROVAL`

### SharedState
- Remove: `criticReport`, `contentReport`
- Add: `atsReport` (ATS score + sections + breakdown), `criticIssues` (critic issues list)

### StepIndicator (4 steps)
```
Upload → ATS Check → Matching → Interview
```

### Navigation Rules
- `ATS_CHECKING` requires a resume present (same guard as current `CRITIQUING`)
- `AWAITING_ATS_APPROVAL` renders the ATSCheckStep
- Approval transitions to `ALIGNING_JD`

## File Changes

### New Files
- `frontend/components/workflow-steps/ATSCheckStep.tsx` — combined component
- `frontend/api/ats.ts` — ATS engine REST client (`POST /api/v1/ats/analyze`)

### Removed Files
- `frontend/components/workflow-steps/ContentStep.tsx`
- `frontend/api/chat-endpoints/contentStrength.ts`

### Modified Files
- `frontend/types/workflow.ts` — updated enum and SharedState
- `frontend/types/reports.ts` — add ATS report types (ATSReport, ATSSection, ATSCheck, ScoreBreakdown)
- `frontend/components/WorkflowSteps.tsx` — export ATSCheckStep, remove CriticStep/ContentStep
- `frontend/components/StepIndicator.tsx` — 4 steps, updated status mapping
- `frontend/hooks/useWorkflowState.ts` — updated navigation logic
- `frontend/App.tsx` — replace CriticStep/ContentStep with ATSCheckStep, update approve/re-run flow

### Untouched (backend)
- Backend ATS engine and endpoint already exist and work correctly
- Backend ResumeCriticAgent unchanged
- ContentStrengthAgent backend code stays (not deleted, just unused from frontend)

## Data Flow

### Initial Analysis (on upload)
```
processPdfFile(file)
  → parse resume via backend
  → Promise.all([atsEngineCall, resumeCriticCall])
  → store { atsReport, criticIssues, currentResume }
  → status = AWAITING_ATS_APPROVAL
```

### Re-run Analysis
```
reRunATSCheck()
  → Promise.all([atsEngineCall(currentResume), resumeCriticCall(currentResume)])
  → update { atsReport, criticIssues }
  → status stays AWAITING_ATS_APPROVAL
```

### Approval
```
approveATSCheck()
  → status = ALIGNING_JD
```
