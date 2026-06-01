# API Contracts: Agent Endpoints

Created: 2026-06-01
Version: v1 (no new version introduced)

## Common
- Base path: /api/v1
- Auth: Existing platform auth (unchanged)
- Headers: Content-Type: application/json
- Payload limit: 1 MB
- Errors: Consistent error schema { code: string, message: string, details?: object }

## Resume Critic (single-shot)
- Method/Path: POST /api/v1/resume-critic/analyze
- Request Body: {
  "resumeData": { ... existing Resume schema ... }
}
- Response: {
  "summary": string,
  "issues": [ { "location": string, "type": "ats|structure|impact|readability", "severity": "HIGH|MEDIUM|LOW", "description": string } ],
  "recommendations"?: [ string ],
  "score"?: number,
  "metadata"?: { "confidence_score"?: number, ... }
}
- Status Codes:
  - 200 on success
  - 400/422 on validation errors (missing fields, too-short content)

## Content Strength (single-shot)
- Method/Path: POST /api/v1/content-strength/analyze
- Request Body: {
  "resumeData": { ... existing Resume schema ... }
}
- Response: {
  "summary": string,
  "score": number,
  "suggestions": [ { "location": string, "original": string, "suggested": string, "evidenceStrength": "HIGH|MEDIUM|LOW", "type": "action_verb|specificity|structure|redundancy" } ],
  "metadata"?: { "confidence_score"?: number, ... }
}
- Status Codes: 200, 400/422

## Job Alignment (single-shot)
- Method/Path: POST /api/v1/alignment/evaluate
- Request Body: {
  "resumeData": { ... },
  "jobDescription": string
}
- Response: {
  "alignmentScore": number (0-100),
  "gaps": [ string ],
  "suggestions": [ string ],
  "metadata"?: { "confidence_score"?: number, ... }
}
- Status Codes: 200, 400/422

## Extractor (single-shot)
- Method/Path: POST /api/v1/extractor/analyze
- Request Body: {
  "resumeData"?: { ... },
  "resumeFile"?: { "data": base64, "fileType": "pdf" }
}
- Response: {
  "contact"?: { ... },
  "skills"?: [ string ],
  "education"?: [ ... ],
  "experience"?: [ ... ],
  "parse_confidence"?: number,
  "warnings"?: [ string ],
  "metadata"?: { "confidence_score"?: number, ... }
}
- Status Codes: 200, 400/422

## Interview Coach (agentic)
- Token (REST): GET /api/v1/interview/token?sessionId=...  -> { api_key, model, system_instruction }
- Live (WebSocket): GET /api/v1/interview/live?sessionId=...  (unchanged)
- Semantics: multi-turn, session-based; unchanged

