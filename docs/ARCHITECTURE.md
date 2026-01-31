# ARCHITECTURE.md — Resume Optimization Agentic AI with Explainability

> **Note:** For system architecture and agent responsibilities, see [AGENTS.md](AGENTS.md)

## 1. Purpose

This document defines the operational contract, responsibilities, constraints, and evaluation criteria for an agentic AI system that optimizes resumes against job descriptions while provably improving a measurable scoring function.

The system MUST

Optimize resumes for job fit
Use a deterministic, explainable scoring layer
Demonstrate score improvement after optimization
Justify all changes via explainability artifacts

The system MUST NOT

Hallucinate experience, skills, or credentials
Optimize blindly without re-scoring
Modify content without traceable rationale

---

## 2. System Overview

The system is composed of five cooperating agents, each with strict boundaries

1. Extractor Agent (Structure)
2. Scoring Agent (Truth)
3. Explainability Agent (Why)
4. Optimization Agent (How)
5. Validation Agent (Proof)

LLMs are used only where explicitly allowed.

---

## 3. Canonical Data Objects

### 3.1 Resume Object (Normalized)

```json
{
  summary string,
  experience [
    {
      company string,
      role string,
      start_date YYYY-MM,
      end_date YYYY-MM  present,
      bullets [string]
    }
  ],
  skills [string],
  education [string],
  certifications [string]
}
```

### 3.2 Job Description Object

```json
{
  title string,
  required_skills [string],
  preferred_skills [string],
  seniority junior  mid  senior  lead,
  responsibilities [string],
  keywords [string]
}
```

---

## 4. Agent Responsibilities

### 4.1 Extractor Agent (LLM-Allowed, Deterministic Output)

Goal Convert unstructured resume and job description into normalized schema.

Inputs

Raw resume text
Raw job description text

Outputs

Resume Object
Job Description Object

Rules

No inference beyond explicit text
No rewriting
No optimization
Schema validation REQUIRED

---

### 4.2 Scoring Agent (No LLM)

Goal Produce deterministic, explainable scores.

Inputs

Resume Object
Job Description Object

Outputs

```json
{
  overall_fit 0-100,
  skill_coverage 0-100,
  seniority_alignment 0-100,
  keyword_alignment 0-100,
  feature_vector { feature_name value }
}
```

Design Requirements

Same input MUST always produce same output
Features must be human-interpretable
Embedding similarity MUST be reduced to scalar features

---

### 4.3 Explainability Agent (SHAP LIME)

Goal Explain scoring outcomes.

Inputs

Scoring model
Feature vector

Outputs

```json
{
  positive_contributors [{feature string, impact number}],
  negative_contributors [{feature string, impact number}],
  section_contributions {
    summary number,
    experience number,
    skills number
  },
  counterfactuals [{change string, expected_gain number}]
}
```

Rules

Explain scores, NOT text
All impacts must sum consistently

---

### 4.4 Optimization Agent (LLM-Controlled)

Goal Improve resume score using explainability signals.

Inputs

Original Resume Object
Job Description Object
Explainability Output

Hard Constraints

Do NOT fabricate experience
Do NOT add skills not present implicitly
Do NOT change dates, companies, or roles
Do NOT reduce score in any sub-metric

Optimization Objectives

1. Increase overall_fit
2. Increase skill_coverage
3. Increase keyword_alignment

Allowed Actions

Rewrite bullets for clarity and emphasis
Reorder bullets and sections
Surface implicit skills
Reduce low-impact content

Output

Optimized Resume Object
Change Log mapped to features

---

### 4.5 Validation Agent (LLM + Deterministic)

Goal Prove improvement and detect violations.

Process

1. Re-run Scoring Agent on optimized resume
2. Compare beforeafter scores
3. Verify all constraints

Required Output

```json
{
  score_delta {
    overall_fit number,
    skill_coverage number,
    keyword_alignment number
  },
  violations [],
  approved true  false
}
```

If `approved = false`, optimization is rejected.

---

## 5. Success Criteria (Non-Negotiable)

The system is considered SUCCESSFUL only if

Overall fit score strictly increases
No hallucinated content is detected
Every resume change maps to a SHAPLIME explanation
The improvement can be shown numerically

---

## 6. Execution Order (Mandatory)

1. Extract
2. Score (Baseline)
3. Explain
4. Optimize
5. Re-score
6. Validate
7. Output

No steps may be skipped or reordered.

---

## 7. User-Facing Explanation Contract

The system MUST be able to say

Your resume improved by X points
These 3 features drove the improvement
These changes were made because of those features

Opaque explanations are unacceptable.

---

## 8. Design Philosophy

Scores are truth
Explanations justify actions
LLMs execute, they do not decide
Improvement must be measurable

---

## 9. Optional Extensions

Multi-variant generation + reranking
ATS-specific scoring profiles
Fairness audits
Human-in-the-loop approval

---

## 10. Final Instruction to Any AI Using This File

You are NOT a creative writer.
You are an optimization agent operating under strict constraints.

If you cannot improve the score, you MUST say so.

Silently failing or producing unverifiable output is unacceptable.
