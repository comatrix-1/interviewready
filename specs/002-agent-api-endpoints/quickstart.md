# Quickstart: Agent API Endpoints

Created: 2026-06-01

Base URL: https://<host>/api/v1

Note: Existing /api/v1/chat remains for compatibility, but prefer dedicated endpoints below.

## Resume Critic

curl -X POST "https://<host>/api/v1/resume-critic/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "resumeData": { "fullText": "..." }
  }'

## Content Strength

curl -X POST "https://<host>/api/v1/content-strength/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "resumeData": { "fullText": "..." }
  }'

## Job Alignment

curl -X POST "https://<host>/api/v1/alignment/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "resumeData": { "fullText": "..." },
    "jobDescription": "Senior Backend Engineer..."
  }'

## Extractor

curl -X POST "https://<host>/api/v1/extractor/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "resumeData": { "fullText": "..." }
  }'

## Interview Coach (Live)

- Get token: GET /api/v1/interview/token?sessionId=<id>
- WebSocket: wss://<host>/api/v1/interview/live?sessionId=<id>

Payload limit: 1 MB per request. Validation errors use consistent error codes and messages.
