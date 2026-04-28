# InterviewReady

Production-Ready Multi-Agent AI Interview Coaching System with Gemini

## Overview

InterviewReady is a sophisticated AI-powered interview coaching platform that leverages multiple specialized agents to provide comprehensive resume analysis, job alignment assessment, and live interview practice. Built with modern technologies including FastAPI, React, and Google's Gemini AI models, the system offers real-time voice interactions and intelligent feedback mechanisms.

## Key Features

- **Multi-Agent Architecture**: Specialized AI agents for resume criticism, content strength analysis, job alignment, and interview coaching
- **Live Voice Interviews**: Real-time voice-based interview practice using Gemini Live API
- **Resume Analysis**: ATS optimization, content strength assessment, and job alignment scoring
- **Session Management**: Persistent user sessions with context-aware conversations
- **SHARP Compliance**: Built-in explainability, confidence scoring, and auditability features

## Tech Stack

### Backend
- **FastAPI**: High-performance async web framework
- **Python 3.11+**: Modern Python with async/await support
- **SQLAlchemy**: Database ORM with async support
- **Google Gemini**: AI models for text generation and live voice interactions
- **LangChain**: AI agent orchestration and management
- **Firebase**: Authentication and user management
- **Langfuse**: AI observability and monitoring

### Frontend
- **React 19**: Modern React with concurrent features
- **TypeScript**: Type-safe JavaScript development
- **Vite**: Fast development server and build tool
- **TailwindCSS**: Utility-first CSS framework
- **Zod**: Runtime type validation

### Infrastructure
- **Docker**: Containerization for deployment
- **Google Cloud Run**: Serverless deployment platform
- **SQLite**: Lightweight database for session storage
- **WebSocket**: Real-time communication for voice interviews

## Getting Started

### Prerequisites

- Python 3.11 or higher
- Node.js 18 or higher
- Google Gemini API key
- Git

### Backend Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/interviewready/interviewready.git
   cd interviewready
   ```

2. **Set up the backend environment**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies using uv**:
   ```bash
   # Install uv if not already installed
   pip install uv
   
   # Install project dependencies
   uv pip install -e .
   ```

4. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

5. **Run the backend server**:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies using npm**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:3000` and the backend at `http://localhost:8000`.

### Documentation Setup

This project includes comprehensive documentation built with MkDocs Material:

1. **Install documentation dependencies**:
   ```bash
   cd backend
   uv pip install -e ".[dev]"
   ```

2. **Run the documentation server**:
   ```bash
   cd ..
   mkdocs serve
   ```

The documentation will be available at `http://localhost:8000`.

## API Endpoints

The system provides several key API endpoints:

- **Health Check**: `GET /health` - System status
- **App Info**: `GET /info` - Application information
- **Chat**: `POST /api/v1/chat` - Main chat endpoint for agent interactions
- **Agents**: `GET /api/v1/agents` - List available agents
- **Sessions**: `POST /api/v1/sessions/new` - Create new session
- **Interview**: `GET /api/v1/interview/token` - Get interview session token
- **WebSocket**: `WS /api/v1/interview/live` - Live interview connection

For detailed API documentation, see the [API Reference](api-reference.md).

## Architecture

The system follows a microservices architecture with clear separation of concerns:

- **Orchestration Layer**: Manages agent selection and workflow coordination
- **Agent Layer**: Specialized AI agents for different tasks
- **API Layer**: RESTful endpoints and WebSocket connections
- **Persistence Layer**: Session storage and state management
- **Frontend Layer**: React-based user interface

For detailed architecture information, see the [Architecture](architecture.md) documentation.

## Development

### Code Style

The project uses automated code formatting and linting:
- **Black**: Python code formatting
- **Ruff**: Python linting and formatting
- **TypeScript**: Frontend type checking
- **ESLint**: Frontend linting

### Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the [API Reference](api-reference.md) for technical details
- Review the [Architecture](architecture.md) for system understanding
