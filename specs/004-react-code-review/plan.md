---
title: React Code Review Plan
status: active
created: 2026-06-07
origin: specs/004-react-code-review/requirements.md
branch: ats-engine
scope: frontend/
---

# React Code Review Plan — frontend/

## Problem Frame

The frontend has a mix of silent regressions, crash-on-load paths, and one security leak that all sit in the interview workflow. The goal is to make the review-safe fixes in `frontend/` without widening scope beyond the requirements doc (see origin: `specs/004-react-code-review/requirements.md`).

## Scope

This plan covers the blocking and important requirements: R-001 through R-008. It explicitly defers the non-blocking polish items, R-009 through R-013, so the first pass stays focused on correctness, resilience, and secret handling.

## Requirements Traceability

- R-001 and R-011: stabilize interview-session render identity and websocket lifecycle in `frontend/components/workflow-steps/InterviewStep.tsx`.
- R-002 and R-007: remove client-side secret exposure in `frontend/vite.config.ts` and fix large audio encoding in `frontend/api/chat.ts`.
- R-003: harden localStorage hydration in `frontend/hooks/useWorkflowState.ts`.
- R-004, R-006, and R-008: normalize catch blocks, fix streaming message updates, and add PDF MIME fallback in `frontend/App.tsx` (R-004 may already be partially addressed — App.tsx uses `catch (err: unknown)` — audit `InterviewStep.tsx` too).
- R-005: make loading context callbacks stable in `frontend/contexts/LoadingContext.tsx`.

## Implementation Units

### 1) Security and transport hardening

**Files:** `frontend/vite.config.ts`, `frontend/api/chat.ts`

**Goal:** remove the unused `GEMINI_API_KEY` client define, keep dev behavior intact without a `.env` file, and replace the large-audio base64 conversion (`String.fromCodePoint(...bytes)` at `frontend/api/chat.ts:12`) with a chunked implementation that cannot overflow the call stack.

**Tests:** add `frontend/tests/chat.test.ts` for the chunked base64 encoding and `frontend/tests/bundle-security.test.ts` for the secret literal scan.

**Scenarios:**
- A 5 MB `Uint8Array` encodes successfully and matches the expected base64 output shape.
- The built frontend bundle does not contain the literal Gemini key value.
- Removing a local `.env` file does not break frontend startup.

### 2) App recovery and input validation

**Files:** `frontend/App.tsx`, `frontend/hooks/useWorkflowState.ts`, `frontend/utils/errors.ts`

**Goal:** recover cleanly from corrupt persisted state, normalize unknown catch values into readable messages, reject unsupported uploads instead of hanging, and make live interview event updates deterministic.

**Tests:** add `frontend/tests/App.test.tsx`.

**Scenarios:**
- Corrupt `localStorage` state falls back to defaults, logs once, and clears the bad entry.
- Thrown strings, plain objects, and `Error` instances all produce readable user-facing errors.
- A file reported as `application/x-pdf` still processes as a PDF when its name ends in `.pdf`.
- A non-PDF file surfaces a clear error instead of leaving the UI in a loading state.
- Rapid `user` streaming events preserve order, and an event with no text does not create an empty chat bubble.

### 3) Interview session stability and render identity

**Files:** `frontend/components/workflow-steps/InterviewStep.tsx`, `frontend/contexts/LoadingContext.tsx`

**Goal:** keep the voice-session websocket alive across unrelated renders, make the loading context value stable, and stop message keys from changing as streamed text grows.

**Tests:** add `frontend/tests/InterviewStep.test.tsx` and `frontend/tests/LoadingContext.test.tsx`.

**Scenarios:**
- Opening a VOICE interview establishes one websocket for the session unless the user intentionally reconnects.
- Typing into unrelated UI state does not cause websocket teardown/reconnect churn.
- Loading context consumers do not re-render solely because callback identities changed.
- Streamed interview messages keep stable keys and do not remount as text changes.

### 4) Verification and follow-through

**Scope:** `npx tsc --noEmit`, `npx vp test run`, `npx vp build`, a bundle scan for the secret literal, and one manual VOICE interview smoke test.

**Deferred from this pass:** R-009 through R-013. They are useful cleanup items, but they are non-blocking compared with the regressions and secret leak above.

## Sequencing

1. Remove the client secret define and fix audio base64 encoding first so the security and transport path is safe before broader edits.
2. Harden `App.tsx` next, because its startup and interview-event paths touch multiple requirements at once.
3. Update `LoadingContext.tsx` and `InterviewStep.tsx` after that, because the websocket and render-identity fixes depend on the app-level flow staying stable.
   - **Note:** The `useWebSocketConnection` hook is defined *inside* `InterviewStep.tsx`; fix it by storing `callbacks` in a ref rather than adjusting the `useEffect` dependency array.
4. Finish with the bundle scan, typecheck, vitest run, and a manual VOICE smoke check so the visible behavior matches the code changes.

## Notes

- The plan intentionally prefers small shared helpers in `frontend/utils/` where a behavior is reused across `App.tsx` and the interview workflow.
- The implementation should stay surgical: fix the listed regressions, keep the existing interview flow intact, and avoid unrelated refactors.
