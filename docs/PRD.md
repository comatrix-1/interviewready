**PRD.md: Persistent Career Co-Pilot (Job Agent System)**

**1\. Objective**

Enable users to manage and optimize their job applications through a **stateful, AI-driven system** that:

- Stores and updates resumes persistently.
- Analyzes resumes against job descriptions (JDs).
- Suggests improvements with **human-in-the-loop (HITL)** validation.
- Conducts interactive mock interviews based on identified gaps.

The system functions as a **career co-pilot**, combining automation with optional human oversight for accuracy, safety, and compliance.

**2\. Key Use Cases**

| **Use Case** | **Description** | **Actors** | **Success Criteria** |
| --- | --- | --- | --- |
| Upload Resume | User uploads a resume. | User | Resume is parsed, stored, and timestamped. |
| Submit Job Description | User provides a JD to match. | User | System identifies matching resumes; prompts user if multiple exist. |
| Optimize Resume | System proposes content improvements. | System + User | OptimizerAgent suggests edits; ValidatorAgent checks for hallucinations; user approves/rejects. |
| Conduct Mock Interview | System generates targeted questions. | System + User | InterviewerAgent generates questions based on GapReport; user may approve if HITL triggered. |
| Persistent State Recovery | User leaves and returns. | User | System restores exact previous session state from database, including ongoing processes. |

**3\. Functional Requirements**

**3.1 Persistence Layer**

- **Checkpointer:** Short-term state persistence via SQLite/Postgres.
- **Store:** Long-term validated resume storage as structured objects.
- Include timestamp metadata with every resume.
- If resume >3 months old, Router flags it as "stale" in the UI.

**3.2 Agents & Workflow**

| **Agent** | **Type** | **Function** | **Input** | **Output** |
| --- | --- | --- | --- | --- |
| ExtractorAgent | Deterministic / LLM | Parses PDFs into structured ResumeSchema | PDF | ResumeSchema + timestamp |
| Router | Logic-Gate | Determines next action | Resume, JD | Next agent or HITL interrupt |
| Scorer | Analytical | Gap analysis between Resume and JD | ResumeSchema, JD | GapReport |
| Optimizer | Generative | Suggests resume improvements | GapReport | Suggested edits + reasoning |
| Interviewer | ReAct | Generates interactive interview questions | GapReport | Questions awaiting responses |
| Validator | Analytical | Checks outputs internally | Optimizer/Interviewer output | Hallucination flags, NLI validation |

**3.3 Human-in-the-Loop (HITL)**

- Critical steps trigger pauses for user approval:
  - **Confirmation Gate:** before Scorer/Optimizer.
  - **Edit Review:** after suggested resume edits.
- HITL updates state: state\['status'\] = 'AWAITING_USER_APPROVAL'.
- UI displays pending suggestions for review/approval.

**3.4 Memory & State Management**

- Agents **must not overwrite** existing state; append or update sub-keys only.
- All interactions conform to a **Shared State schema**.
- Agents communicate using **Pydantic V2 schemas**, never raw strings.

**3.5 Safety & Compliance**

- ValidatorAgent ensures no hallucinations or inaccuracies.
- PII is stripped before scoring/optimization.
- Long-term traceability via **LangFuse**.

**4\. Technical Stack**

- **Orchestration:** LangGraph (stateful graph cycles)
- **Parsing:** LlamaParse (Markdown-centric)
- **Database:** PostgreSQL + pgvector
- **Observability:** LangFuse (E2E monitoring, cost tracking)
- **Schema Enforcement:** Pydantic V2
- **State Management:** Memory-augmented routing with Checkpointer + Store

**5\. Non-Functional Requirements**

- **Availability:** Resume data recoverable across sessions.
- **Performance:** Resume analysis <5s; optimization <10s.
- **Auditability:** Agent decisions logged for internal review.
- **Security:** PII removed; data encrypted in transit and at rest.
- **Extensibility:** Agents replaceable without breaking Shared State schema.

**6\. User Interface Requirements**

The UI supports **all human-facing interactions**, focusing on **clarity, HITL approval, and workflow visibility**.

**6.1 Resume Management**

- Upload new resumes.
- Display a list of existing resumes.
- Show "stale resume" warnings if a resume is older than 3 months.
- Allow users to select which resume to match with a JD.

**6.2 Job Description Submission**

- Input or paste job descriptions.
- Confirm selected resume if multiple exist.

**6.3 Resume Optimization**

- Display **suggested edits** from the OptimizerAgent.
- Show **reasoning/explanation** for each suggestion (SHAP/Explainer outputs).
- Allow **approval or rejection** for each suggestion.

**6.4 Mock Interview / Gap Analysis**

- Display AI-generated interview questions.
- Capture user responses.
- Highlight gaps identified by the Scorer and Explainer.

**6.5 System State & Workflow Indicators**

- Display current pipeline step (e.g., Processing, Awaiting Approval, Completed).
- Notify users when HITL action is required.
- Show progress through resume optimization or interview sessions.

**6.6 History & Traceability**

- Access previous session state for persistent recovery.
- View audit logs of agent decisions (optional for advanced users).

**7\. Success Metrics**

- **Accuracy:** ≥95% Optimizer suggestions valid.
- **User Adoption:** ≥80% users complete resume optimization.
- **Session Recovery:** ≥99% users return to exact previous state.
- **HITL Efficiency:** Average human approval ≤60s per step.

