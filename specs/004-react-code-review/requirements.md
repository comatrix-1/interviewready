# React Code Review Requirements — `frontend/`

**Skill:** `/code-review-excellence`
**Scope:** `frontend/` (Vite+ / React 19 / TypeScript 5.8 / Vitest via `vp`)
**Branch:** `ats-engine`
**Date:** 2026-06-07

---

## Blocking Requirements 🔴

### R-001 · WebSocket reconnects on every render

**File:** `frontend/components/workflow-steps/InterviewStep.tsx:307`
**Severity:** 🔴 Blocking (silent regression affecting every voice session)

`useWebSocketConnection` receives an inline object literal as its `callbacks` argument. That object is a new reference on every render, and the hook's `useEffect` depends on `callbacks` (line 122), so each render:

1. tears down the existing WebSocket,
2. clears the heartbeat interval,
3. resets the `isComponentMounted` guard,
4. opens a brand-new connection to the backend relay.

This silently kills battery life, causes dropped voice turns, and floods the relay with connect/disconnect churn.

**Required fix:** One of the following, in order of preference:

1. Store callbacks inside the hook via refs (`const callbacksRef = useRef(callbacks); callbacksRef.current = callbacks;`) and remove `callbacks` from the `useEffect` dependency array.
2. Wrap each callback in `useCallback` at the call site and memoize the container object with `useMemo`.

Acceptance criteria:

- Opening a VOICE interview establishes exactly one WebSocket for the session lifetime (plus intentional reconnects from the Reconnect button or status transitions).
- No new connections are triggered by unrelated state changes (e.g., typing into the CHAT textarea).
- A `console.log` added to `initializeRelaySession` fires exactly once per VOICE session.

### R-002 · Client bundle may expose `GEMINI_API_KEY`

**File:** `frontend/vite.config.ts:20-22`
**Severity:** 🔴 Blocking (security — leaked secret in shipped JS)

```ts
define: {
  "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
  "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
},
```

A `grep` of the frontend source finds no consumer of `process.env.GEMINI_API_KEY` or `process.env.API_KEY`. If unused, this is a leaked secret baked into every shipped JS bundle. If it is used, Gemini should be called from the backend relay (which the architecture already does via `/api/v1/chat`), making the client-side key both unnecessary and dangerous.

**Required fix:**

1. Audit every `process.env.API_KEY` / `process.env.GEMINI_API_KEY` reference across `frontend/`. If any exist, route them through the backend relay.
2. Delete the two `define` entries.
3. Add a CI check that inspects the built bundle (`dist/assets/*.js`) for the literal key value and fails the build on match.

Acceptance criteria:

- `GEMINI_API_KEY` is absent from all production bundles.
- Removing a `.env` file with a dummy key does not break the dev server.

---

## Important Requirements 🟡

### R-003 · `localStorage` hydration can brick the app on load

**File:** `frontend/App.tsx:32-34`

```ts
const saved = localStorage.getItem("interview_ready_state");
if (saved) return JSON.parse(saved);
```

There is no `try/catch` around `JSON.parse`. Corrupt JSON (truncation, quota errors, prior schema, manual edits) throws during `useState` initialization and crashes the page before anything renders. The user is stuck and cannot recover without DevTools.

**Required fix:** Wrap the `JSON.parse` in a `try/catch`, fall back to the default state, and either clear the corrupt key or surface a non-fatal warning.

Acceptance criteria:

- Writing `localStorage.setItem("interview_ready_state", "{")` and reloading does not blank-screen the app.
- A corrupt payload is logged to the console once, then the key is removed.

### R-004 · Untyped `catch (err: any)` throughout the workflow

**Files:** `frontend/App.tsx:314, 338, 386, 409, 436, 482, 512, 554`

Every `catch (err: any)` reaches for `err.message` without narrowing. Under strict TypeScript this is unsafe; under non-strict it hides real bugs — a thrown string has no `.message`, so the user sees `"undefined"` or the hardcoded fallback.

**Required fix:** Either:

1. Type the catch parameter as `unknown` and narrow with `instanceof Error`, or
2. Introduce a single `getErrorMessage(err: unknown, fallback: string): string` helper in `utils/` and use it at every catch site.

Acceptance criteria:

- No `catch (err: any)` remains in `App.tsx` or `InterviewStep.tsx`.
- Thrown strings, thrown objects, and `Error` instances all produce a readable user-facing message.

### R-005 · `useMemo` defeated by unstable function references

**File:** `frontend/contexts/LoadingContext.tsx:78-88`

`setLoading`, `startLoading`, `updateProgress`, `stopLoading` are declared inline in the component body. They are new references every render, so the `useMemo` recomputes on every render and every consumer re-renders. The memoization is doing nothing but adding dependency-bookkeeping cost.

**Required fix:** Either:

1. Wrap each callback in `useCallback` with correct dependencies (preferred), or
2. Drop the `useMemo` and accept the churn, removing the misleading optimization.

Acceptance criteria:

- React Dev Profiler shows no LoadingContext re-renders triggered solely by identity changes in the context value.

### R-006 · `handleLiveEvent` can silently drop streaming messages

**File:** `frontend/App.tsx:565-598`

```ts
const last = history.at(-1);
if (last?.role === "user") {
  return {
    ...prev,
    interviewHistory: [
      ...history.slice(0, -1),
      { role: "user", text: event.text || "" },
    ],
  };
}
```

If multiple streaming events arrive before state catches up, this replaces the last user turn instead of appending. The `|| ""` fallback also writes an empty message when `event.text` is undefined.

**Required fix:** For voice partial-transcription / barge-in, use a keyed "pending" slot (e.g., a message with `role: "user"` and `id: "pending-stt"`) that is updated by id rather than by position. The `|| ""` fallback should be removed — an undefined text event should be a no-op, not an empty bubble.

Acceptance criteria:

- Rapid `user` streaming events (10 within 100 ms) all appear in the rendered history in order.
- A streaming event with no `text` field does not create a chat bubble.

### R-007 · Base64 audio encoding can overflow the call stack

**File:** `frontend/backendService.ts:169`

```ts
const binary = String.fromCodePoint(...bytes);
```

The adjacent comment claims "Safe base64 encoding … to avoid stack overflow," but `String.fromCodePoint(...bytes)` is exactly the pattern that overflows the call stack on large payloads (~120 KB typical V8 limit). Voice uploads can be several megabytes.

**Required fix:** Chunk the conversion:

```ts
const CHUNK = 0x8000;
let binary = "";
for (let i = 0; i < bytes.length; i += CHUNK) {
  binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
}
audioDataBase64 = btoa(binary);
```

Acceptance criteria:

- Encoding a 5 MB `Uint8Array` does not throw `RangeError: Maximum call stack size exceeded`.
- The encoded output matches a reference implementation (e.g., `Buffer.from(bytes).toString("base64")` in Node, used as a test oracle).

### R-008 · `processPdfFile` silently no-ops on unknown MIME types

**File:** `frontend/App.tsx:334`

```ts
if (file.type === "application/pdf") { ... }
```

If the OS/browser reports `""` or `application/x-pdf` (both common), the function returns `undefined`, `handleSuccessfulProcessing` is never called, and the UI hangs on the loading overlay.

**Required fix:**

1. Check the file extension (`file.name.toLowerCase().endsWith(".pdf")`) as a fallback.
2. On the fall-through path, throw or surface a clear error ("Unsupported file type: …") rather than silently returning.

Acceptance criteria:

- Uploading a file reported as `application/x-pdf` succeeds.
- Uploading a `.docx` shows a user-visible error instead of hanging.

---

## Nit / Suggestion Requirements 🟢

### R-009 · Blocking `confirm()` in `resetSession`

**File:** `frontend/App.tsx:67`

`confirm()` is a synchronous modal that blocks the main thread and is not stylable. Replace with a lightweight confirmation component when the design system has one. Non-blocking.

### R-010 · Hardcoded avatar initials

**File:** `frontend/App.tsx:138`

The avatar shows "JD" while the rest of the UI implies a multi-user SaaS. Pull initials from the session / auth context when available. Non-blocking.

### R-011 · Unstable chat message keys

**File:** `frontend/components/workflow-steps/InterviewStep.tsx:1005`

```ts
key={`${msg.role}-${i}-${msg.text.slice(0, 20)}`}
```

The key changes as streamed text grows, which remounts the bubble, loses focus/animations, and can cause flicker. Use a stable id assigned at append time (e.g., `crypto.randomUUID()` or a server-assigned id).

### R-012 · 120-second hard recording cap with no warning

**File:** `frontend/components/workflow-steps/InterviewStep.tsx:709-712`

`stopRecording()` fires at exactly 120 s with no visible warning. Add a brief "wrapping up" cue at ~110 s so the user does not get cut off mid-sentence.

### R-013 · Opaque `targetStatus` expression

**File:** `frontend/App.tsx:107`

```ts
const targetStatus =
  (reportAvailable[status] && completedStatus[status]) || status;
```

The logical-AND trick reads as a type error and relies on short-circuit semantics that are easy to break. Prefer a small ternary or `if` block for clarity.

---

## Strengths (Non-Requirements)

The following patterns were called out during review and should be preserved in any refactor:

- **Voice/VAD subsystem** in `InterviewStep.tsx` correctly manages barge-in, interruption signals, worklet registration, and dual AudioContexts, with refs correctly used to break stale closures.
- **Payload normalization** in `backendService.ts` (`parseInterviewCoachPayload`, `formatInterviewCoachPayload`) cleanly separates agent intent from transport.
- **Workflow state machine** in `App.tsx` (`handleStepClick`) uses explicit `canNavigate` / `completedStatus` / `reportAvailable` tables that are easy to extend.
- **`void initSession()`** in `App.tsx:59` correctly handles the non-awaited promise inside `useEffect`.

---

## Suggested Execution Order

| Priority | Requirement                      | Reason                                                 |
| -------- | -------------------------------- | ------------------------------------------------------ |
| 1        | R-001 (WebSocket reconnect loop) | Silent regression affecting every voice session        |
| 1        | R-002 (Leaked `GEMINI_API_KEY`)  | Security — exposed secret in every production build    |
| 2        | R-007 (Base64 stack overflow)    | Voice uploads >120 KB fail at runtime                  |
| 2        | R-003 (localStorage brick)       | First-run crash path                                   |
| 2        | R-008 (PDF MIME fall-through)    | Upload silently hangs                                  |
| 3        | R-004, R-005, R-006              | Type safety, render performance, streaming correctness |
| 4        | R-009 – R-013                    | Nits and suggestions                                   |
| 4        | Raw `vitest` runner shim         | Developer-experience issue                             |

## Verification

Each requirement's acceptance criteria should be verified via:

1. `npx tsc --noEmit` (must stay clean).
2. `npx vp test run` (must stay green; add new tests for R-003, R-007).
3. Manual smoke test of a VOICE interview session (R-001, R-012).
4. Manual bundle inspection via `npx vp build && grep -R GEMINI dist/` (R-002).
