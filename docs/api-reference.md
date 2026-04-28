# API Reference

This document provides comprehensive documentation for all InterviewReady API endpoints, including request/response examples and authentication requirements.

## Base URL

```
https://interviewready-backend-266623940622.asia-southeast1.run.app
```

Development server:
```
http://localhost:8000
```

## Authentication

Currently, the system uses a simplified authentication model with hardcoded user IDs. In production, proper authentication will be implemented.

## Rate Limiting

All endpoints are rate-limited according to the `DEFAULT_RATE_LIMIT` configuration.

## Response Format

All API responses follow a consistent JSON format with appropriate HTTP status codes.

## Endpoints

### Health Check

#### `GET /health`

Returns the health status of the application.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0"
}
```

**Status Codes:**
- `200 OK`: Service is healthy

---

#### `GET /info`

Returns application information and configuration.

**Response:**
```json
{
  "name": "interviewready-backend",
  "version": "1.0.0",
  "log_level": "INFO",
  "environment": "prod"
}
```

**Status Codes:**
- `200 OK`: Successfully retrieved info

---

#### `GET /metrics`

Returns metrics placeholder (currently not implemented).

**Response:**
```json
{
  "status": "metrics_placeholder",
  "endpoints": ["health", "info", "metrics"]
}
```

**Status Codes:**
- `200 OK`: Successfully retrieved metrics

---

### Chat API

#### `POST /api/v1/chat`

Main chat endpoint for interacting with the multi-agent system. Processes user requests through appropriate specialized agents.

**Query Parameters:**
- `sessionId` (string, required): Unique session identifier for context persistence

**Request Body:**
```json
{
  "intent": "RESUME_CRITIC|CONTENT_STRENGTH|ALIGNMENT|INTERVIEW_COACH",
  "control": "resume|rewind|null",
  "checkpointId": "string|null",
  "resumeData": {
    "id": "string",
    "raw_text": "string",
    "sections": {},
    "spans": []
  }|null,
  "resumeFile": {
    "data": "base64-encoded-pdf",
    "fileType": "pdf"
  }|null,
  "jobDescription": "string",
  "messageHistory": [
    {
      "role": "user|assistant",
      "text": "string"
    }
  ],
  "audioData": "base64-encoded-audio|null"
}
```

**Response:**
```json
{
  "agent": "ResumeCriticAgent",
  "payload": {
    "summary": "Resume analysis complete",
    "issues": [],
    "score": 85,
    "metadata": {
      "confidence_score": 0.92,
      "needs_review": false,
      "low_confidence_fields": []
    }
  },
  "confidence_score": 0.92,
  "needs_review": false,
  "low_confidence_fields": [],
  "metadata": {
    "confidence_score": 0.92,
    "needs_review": false,
    "low_confidence_fields": [],
    "checkpoint_id": "ckpt_123",
    "review_payload": null,
    "review_required": false
  }
}
```

**Intent Types:**
- `RESUME_CRITIC`: ATS optimization and resume structure analysis
- `CONTENT_STRENGTH`: Content quality and impact assessment
- `ALIGNMENT`: Job description alignment analysis
- `INTERVIEW_COACH`: Interview preparation and coaching

**Status Codes:**
- `200 OK`: Successfully processed request
- `400 Bad Request`: Invalid request format or parameters
- `403 Forbidden`: Permission denied for session access
- `500 Internal Server Error`: Processing failed
- `503 Service Unavailable`: Orchestration service unavailable

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/v1/chat?sessionId=session_123" \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "RESUME_CRITIC",
    "resumeFile": {
      "data": "JVBERi0xLjQK...",
      "fileType": "pdf"
    },
    "jobDescription": "Senior Software Engineer position requiring 5+ years experience..."
  }'
```

---

### Agents API

#### `GET /api/v1/agents`

Lists all available agents and their current system prompts.

**Query Parameters:**
- `sessionId` (string, optional): Session identifier for context

**Response:**
```json
{
  "ResumeCriticAgent": "You are an expert resume critic specializing in ATS optimization...",
  "ContentStrengthAgent": "You are an expert content analyst specializing in resume impact...",
  "JobAlignmentAgent": "You are an expert job alignment analyst...",
  "InterviewCoachAgent": "You are an expert interview coach..."
}
```

**Status Codes:**
- `200 OK`: Successfully retrieved agents
- `503 Service Unavailable`: Orchestration service unavailable

**Example Request:**
```bash
curl -X GET "http://localhost:8000/api/v1/agents?sessionId=session_123"
```

---

### Sessions API

#### `POST /api/v1/sessions/new`

Creates a new session and returns the session ID.

**Response:**
```json
{
  "session_id": "session_abc123def456"
}
```

**Status Codes:**
- `200 OK`: Successfully created session

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/v1/sessions/new"
```

---

#### `GET /api/v1/sessions/{session_id}/resume`

Retrieves the parsed resume data for a specific session.

**Path Parameters:**
- `session_id` (string, required): Unique session identifier

**Response:**
```json
{
  "id": "resume_123",
  "raw_text": "John Doe\nSoftware Engineer\nExperience: 5 years...",
  "sections": {
    "experience": "Software Engineer at Tech Corp...",
    "education": "BS Computer Science...",
    "skills": "Python, JavaScript, React..."
  },
  "spans": [
    {
      "type": "experience",
      "text": "Software Engineer",
      "start": 20,
      "end": 36
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Successfully retrieved resume
- `403 Forbidden`: Permission denied for session access
- `404 Not Found`: Session or resume not found
- `500 Internal Server Error`: Invalid resume data format

**Example Request:**
```bash
curl -X GET "http://localhost:8000/api/v1/sessions/session_123/resume"
```

---

### Interview API

#### `GET /api/v1/interview/token`

Returns configuration for live interview sessions including API credentials and system instructions.

**Query Parameters:**
- `sessionId` (string, required): Session identifier

**Response:**
```json
{
  "api_key": "AIzaSy...gemini_api_key",
  "model": "gemini-3.1-flash-live-preview",
  "system_instruction": "You are an expert Interview Coach conducting a LIVE VOICE mock interview..."
}
```

**Status Codes:**
- `200 OK`: Successfully retrieved token configuration

**Example Request:**
```bash
curl -X GET "http://localhost:8000/api/v1/interview/token?sessionId=session_123"
```

---

#### `WebSocket /api/v1/interview/live`

WebSocket endpoint for real-time voice interview sessions with Gemini Live API.

**Query Parameters:**
- `sessionId` (string, required): Session identifier

**Connection Flow:**
1. Client connects to WebSocket
2. Server accepts connection and sends initial status message
3. Client sends audio/video/text data
4. Server relays data to Gemini Live API
5. Server streams responses back to client

**Message Formats:**

**Client to Server:**
```json
{
  "event": "ping|interrupt|audio_stream_end",
  "audioData": "base64-encoded-audio",
  "type": "image",
  "data": "base64-encoded-image",
  "text": "message text"
}
```

**Server to Client:**
```json
{
  "type": "textStream|inputTranscription|turn_complete|interrupted|error",
  "data": "transcribed text or AI response",
  "error": "error message if applicable"
}
```

**Example Connection:**
```javascript
const ws = new WebSocket('ws://localhost:8000/api/v1/interview/live?sessionId=session_123');

ws.onopen = () => {
  console.log('Connected to interview session');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

// Send audio data
ws.send(JSON.stringify({
  audioData: "base64-encoded-audio-chunk"
}));
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "detail": "Error description",
  "error_code": "ERROR_CODE",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Data Models

### Resume Model

```json
{
  "id": "string",
  "raw_text": "string",
  "sections": {
    "experience": "string",
    "education": "string",
    "skills": "string"
  },
  "spans": [
    {
      "type": "string",
      "text": "string",
      "start": "number",
      "end": "number"
    }
  ]
}
```

### Agent Response Model

```json
{
  "agent_name": "string",
  "content": "string",
  "reasoning": "string",
  "confidence_score": "number",
  "needs_review": "boolean",
  "low_confidence_fields": ["string"],
  "decision_trace": ["string"],
  "sharp_metadata": {}
}
```

## SDK Examples

### Python

```python
import requests

# Create session
session_response = requests.post("http://localhost:8000/api/v1/sessions/new")
session_id = session_response.json()["session_id"]

# Chat with resume critic
chat_response = requests.post(
    f"http://localhost:8000/api/v1/chat?sessionId={session_id}",
    json={
        "intent": "RESUME_CRITIC",
        "resumeFile": {
            "data": "base64-encoded-pdf",
            "fileType": "pdf"
        }
    }
)
result = chat_response.json()
```

### JavaScript

```javascript
// Create session
const sessionResponse = await fetch('/api/v1/sessions/new', {
  method: 'POST'
});
const { session_id } = await sessionResponse.json();

// Chat with agent
const chatResponse = await fetch(`/api/v1/chat?sessionId=${session_id}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    intent: 'RESUME_CRITIC',
    resumeFile: {
      data: 'base64-encoded-pdf',
      fileType: 'pdf'
    }
  })
});
const result = await chatResponse.json();
```

## Rate Limits

Current rate limits are configured in the system settings. Exceeding limits will result in HTTP 429 responses.

## WebSocket Connection Limits

- Maximum concurrent WebSocket connections per session: 1
- Connection timeout: 30 seconds idle
- Maximum audio chunk size: 64KB
