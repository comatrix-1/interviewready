# API Reference

> **Note:** This page is a stub. Full API reference is auto-generated via FastAPI at `/docs` when the backend is running.

## Base URL

```
http://localhost:8080/api/v1
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/chat` | Multi-intent orchestration endpoint |
| GET | `/agents` | List available agents and their prompts |
| GET | `/sessions/{session_id}/resume` | Retrieve session resume data |
| POST | `/sessions/new` | Create a new session |
| GET | `/interview/token` | Get Gemini Live API ephemeral token |
| WS | `/interview/live` | Real-time audio interview WebSocket |
| POST | `/ats/analyze` | ATS compatibility analysis |

## Root Endpoints

These are mounted at the application root, not under `/api/v1`.

| Method | Path | Description |
|---|---|---|
| GET | `/health` | System health check |
| GET | `/info` | Application metadata |
| GET | `/metrics` | Metrics placeholder |
