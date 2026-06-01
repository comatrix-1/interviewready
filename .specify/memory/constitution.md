<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- Modified principles:
  - "Quality by Design" → "Code Quality by Design"
  - "Test-First Discipline" → "Testing Standards (Test-First)"
  - "Performance Transparency" → "Performance Requirements"
  - "Continuous Review and Delivery Safety" → "Continuous Review & Delivery Safety" (title normalized)
- Added sections: none
- Removed sections: none
- Templates requiring updates: .specify/templates/plan-template.md ✅ updated, .specify/templates/spec-template.md ✅ updated, .specify/templates/tasks-template.md ✅ updated
- Follow-up TODOs: If a formal UX style guide does not yet exist, create docs/ux-guidelines.md and link it in PRs referencing Principle III.
-->

# InterviewReady Constitution

## Core Principles

### I. Code Quality by Design
- All code MUST be readable, maintainable, and conform to agreed style and
  architecture boundaries. Linting, formatting, and type checks MUST pass.
- Abstractions MUST be purposeful: avoid duplication, keep functions small, and
  prefer clear composition over cleverness. Architectural boundaries MUST not be
  crossed without explicit interfaces.
- Any deviation from established conventions MUST include a short, in-code note
  (or ADR) explaining the trade-off and its scope.

Rationale: High-quality code reduces defects, accelerates onboarding, and lowers
long-term cost of change.

### II. Testing Standards (Test-First)
- Follow Red–Green–Refactor. Add a failing test first, then implement, then
  refactor with tests passing.
- Every bug fix MUST include a regression test. Every new feature MUST include
  unit coverage for core logic and integration coverage for critical flows.
- Tests MUST be deterministic, isolated, and fast. Flaky tests MUST be fixed or
  quarantined within 24 hours with a tracked issue.
- Minimum coverage targets: overall 80% line coverage; critical modules 90%.
  Coverage is a floor, not a goal—assert behavior, not lines.

Rationale: Tests encode intent, prevent regressions, and enable safe refactors.

### III. User Experience Consistency
- User-facing copy, error messaging, navigation, and component behavior MUST
  follow a shared UX standard. Loading, empty, and error states MUST be present
  and consistent.
- Accessibility MUST meet WCAG 2.1 AA for new UI. Keyboard navigation and focus
  management are mandatory.
- Deviations from established patterns MUST be justified in review and
  cross-referenced to a documented decision.

Rationale: Consistency improves usability, reduces cognitive load, and builds
trust.

### IV. Performance Requirements
- Define measurable performance budgets before implementation (e.g., p95 API
  latency, memory ceilings, render timing). Budgets MUST be reviewed in PRs.
- Significant paths MUST include performance checks (automated where feasible);
  regressions MUST not be merged without a mitigation plan.
- Frontend: keep main-thread work under 50ms per interaction; avoid layout
  thrash; defer non-critical work.
- Backend: meet agreed p95 and p99 latencies; apply backpressure and timeouts;
  prevent unbounded memory or queue growth.

Rationale: Performance is a feature; budgets keep it visible and enforceable.

### V. Continuous Review & Delivery Safety
- Every change MUST pass peer review and automated quality checks (lint, type,
  tests, performance gates as applicable) before merge.
- PRs MUST describe how the change satisfies these principles and include
  evidence of local validation.
- Risky changes MUST include a rollback or mitigation plan.

Rationale: Gates and peer review reduce risk and align work with project
standards.

## Performance & Reliability Standards
Performance goals and reliability constraints are mandatory for feature planning
and delivery.
- Define measurable targets for response time, memory, or throughput before
  implementation begins.
- Enforce budgets for user-facing latency, backend processing, and client-side
  render performance.
- Automate performance regression checks where feasible, and require manual
  review when automated coverage is unavailable.
- Design for graceful degradation: failures MUST be handled cleanly with clear
  user feedback and no silent data loss.

## Review Workflow & Quality Gates
This project requires documented approvals and gated validation for all work.
- All pull requests MUST include a summary of how the change satisfies this
  constitution.
- Every PR MUST run the relevant lint, type, and test suites before merge.
- UX, performance, and quality compliance MUST be reviewed as part of the
  standard review checklist.
- Amendments to architecture, tooling, or user experience patterns MUST include
  an explicit rollback or migration plan.

## Governance
This constitution is the authoritative guide for code quality, testing, UX, and
performance in InterviewReady. All project practices MUST conform to it unless a
documented exception is approved by the team.
- Amendments require a written rationale, reviewer agreement, and a version note
  in the constitution file.
- Use semantic versioning: MAJOR for principle redefinition or incompatible
  governance change; MINOR for added principles, sections, or new enforcement
  policies; PATCH for wording clarifications and editorial updates.
- Compliance is validated in pull request review and release readiness checks.
  Any deviation MUST be captured in PR discussion and corrected before merge.

**Version**: 1.1.0 | **Ratified**: 2026-05-19 | **Last Amended**: 2026-06-01
