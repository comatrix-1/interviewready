# InterviewReady Frontend: React TypeScript SPA

Modern React 18 + TypeScript + Tailwind CSS single-page application for AI-powered resume optimization and interview preparation with real-time backend integration.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Setup & Installation](#setup--installation)
4. [Application Structure](#application-structure)
5. [Core Features](#core-features)
6. [Component Library](#component-library)
7. [API Integration](#api-integration)
8. [State Management](#state-management)
9. [Security Considerations](#security-considerations)
10. [Testing](#testing)
11. [Deployment](#deployment)
12. [Performance Optimization](#performance-optimization)

---

## 1. Architecture Overview

### Frontend Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      React SPA (Client)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PRESENTATION LAYER (Views)                                    │
│  ├─ App.tsx (Main application shell)                           │
│  ├─ Workflow UI (5-step process)                               │
│  └─ Agent response rendering (Resume, Graph, Chat)            │
│                                                                 │
│  COMPONENT LAYER (Reusable UI)                                 │
│  ├─ ResumePreview (Resume display & editing)                   │
│  ├─ StepIndicator (Progress tracking)                          │
│  ├─ WorkflowSteps (Multi-agent orchestration UI)              │
│  ├─ LoadingState (Loading spinners & skeletons)               │
│  ├─ ReportHeader (Analysis header & metadata)                 │
│  └─ Custom form/input components                              │
│                                                                 │
│  STATE MANAGEMENT LAYER (React Contexts)                       │
│  ├─ LoadingContext (Async operation states)                    │
│  ├─ SessionContext (Session data & history)                    │
│  └─ Local component state (useState)                           │
│                                                                 │
│  SERVICE LAYER (API Integration)                               │
│  ├─ backendService.ts (HTTP client for backend)               │
│  ├─ Session management (localStorage + state)                  │
│  ├─ Error handling & retry logic                               │
│  └─ Request/response transformation                            │
│                                                                 │
│  STYLING & UTILITIES                                            │
│  ├─ Tailwind CSS (utility-first CSS framework)                 │
│  ├─ Dark mode support (via tailwind.config.ts)                │
│  ├─ Responsive layout (mobile-first design)                    │
│  └─ Custom utilities & helpers                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓ HTTPS API Calls
        ┌───────────────────────────────────────┐
        │   FastAPI Backend (Port 8000)        │
        │   /api/v1/chat                        │
        │   /api/v1/agents                      │
        │   /api/v1/health                      │
        └───────────────────────────────────────┘
```

### User Interaction Flow

```
Landing
  ↓
Upload Resume (PDF or Manual Entry)
  ↓
Enter Job Description (Primary intent)
  ↓
Select Agent/Intent
  ├─ ResumeCritic: Get structural analysis
  ├─ ContentStrength: Get skills evaluation
  ├─ JobAlignment: Match to job description
  └─ InterviewCoach: Multi-turn interview
  ↓
Agent Processing (with loading feedback)
  ├─ Real-time status updates
  ├─ Graceful error handling
  ├─ Mock response fallback
  ↓
Display Results
  ├─ Rendered response (format varies by agent)
  ├─ Confidence scores & governance metadata
  ├─ Decision trace for transparency
  ↓
Action
  ├─ Download analysis
  ├─ Copy to clipboard
  ├─ Continue to next agent
  └─ Start new session
```

---

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | React | 18.x | Modern UI framework with concurrent rendering |
| **Language** | TypeScript | 5.x | Type-safe JavaScript superset |
| **Build Tool** | Vite | 5.x | Fast ES module build tool with HMR |
| **Styling** | TailwindCSS | 3.x | Utility-first CSS framework |
| **Component Library** | Headless UI | Latest | Unstyled, accessible components |
| **HTTP Client** | Fetch API | Native | Built-in, no additional library needed |
| **Testing** | Vitest | Latest | Fast unit testing framework for Vite |
| **State Management** | React Context | Native | Built-in context API for state sharing |
| **Type Safety** | TypeScript | 5.x | Static type checking & intellisense |
| **Routing** | React Router | Latest (optional) | Client-side routing if needed |
| **Package Manager** | npm | Latest | Node package manager |
| **Environment** | Node.js | 18+ | JavaScript runtime |

---

## 3. Setup & Installation

### Prerequisites

- **Node.js 18+** - Download from [nodejs.org](https://nodejs.org/)
- **npm 9+** - Bundled with Node.js
- **Backend running** - On `http://localhost:8000` (or configured URL)
- **Git** - For version control

### Installation Steps

**1. Install Dependencies**
```bash
npm install
```

**2. Create Environment File**
```bash
cp .env.example .env.local
```

**3. Configure Environment Variables**
Edit `.env.local`:
```bash
# Backend API configuration
VITE_API_BASE_URL=http://localhost:8000

# Optional: Sentry error tracking
VITE_SENTRY_DSN=https://...

# Optional: Analytics
VITE_ANALYTICS_ID=...
```

**4. Start Development Server**
```bash
npm run dev
```

Application available at: `http://localhost:5173` (or shown in terminal)

**5. Build for Production**
```bash
npm run build
```

Output in `dist/` directory

**6. Preview Production Build**
```bash
npm run preview
```

### Docker Development

**Build Docker image:**
```bash
docker build -t interviewready-frontend .
```

**Run container:**
```bash
docker run -p 3000:3000 interviewready-frontend
```

---

## 4. Application Structure

```
frontend/
├── App.tsx                          # Root application component
├── index.tsx                        # Entry point with React render
├── index.css                        # Global Tailwind styles
├── metadata.json                    # Application metadata
├── vite.config.ts                   # Vite configuration
├── vite-env.d.ts                    # Vite type definitions
├── tsconfig.json                    # TypeScript configuration
├── tailwind.config.ts               # Tailwind CSS configuration
│
├── components/                      # Reusable UI components
│   ├── LoadingState.tsx            # Loading spinners & skeletons
│   ├── ReportHeader.tsx            # Analysis header & metadata
│   ├── ResumePreview.tsx           # Resume display component
│   ├── StepIndicator.tsx           # Progress/step indicator
│   └── WorkflowSteps.tsx           # Multi-step workflow UI
│
├── contexts/                        # React Context providers
│   └── LoadingContext.tsx          # Global loading state context
│
├── utils/                           # Utility functions
│   ├── resolve-resume-location.ts  # Parse resume data
│   └── text.ts                      # Text formatting utilities
│
├── tests/                           # Test suite
│   └── backendService.test.js      # API integration tests
│
├── index.html                       # HTML template
├── nginx.conf                       # Nginx configuration (production)
├── Dockerfile                       # Docker image definition
└── package.json                     # Project dependencies & scripts
```

### Key Files

**App.tsx** - Main application component:
```typescript
// Manages:
// - Resume upload/input
// - Job description input
// - Agent selection
// - Session management
// - Response rendering
// - Error handling & retry logic
```

**backendService.ts** - API integration layer:
```typescript
// Exports:
// - Chat API client
// - Resume normalization
// - Session management
// - Error handling
// - Mock fallback responses
```

**LoadingContext.tsx** - Global loading state:
```typescript
// Provides:
// - isLoading: boolean
// - error: Error | null
// - setLoading / setError actions
// - useLoading() hook
```

---

## 5. Core Features

### 1. Multi-Agent Resume Analysis

**Resume Upload & Processing:**
- PDF file upload with client-side parsing
- Manual resume data entry form
- Resume preview with formatting
- Live update to backend

**Agent Selection:**
```typescript
type Intent = 
  | "RESUME_CRITIC"        // Structural & ATS analysis
  | "CONTENT_STRENGTH"     // Skills & achievements evaluation
  | "ALIGNMENT"            // Job matching analysis
  | "INTERVIEW_COACH"      // Multi-turn interview prep
```

### 2. Multi-Turn Interview Coach

**Interview Workflow:**
```
Question 1 (Behavioral)
  ↓ [User answer]
Feedback & Scoring
  ↓ [Proceed/Re-ask decision]
Question 2 (Technical or Situational)
  ↓ ...
Total: 5 questions across different types
```

**State Persistence:**
- Interview history stored in session
- Progress tracking (current question #)
- Answer scoring & feedback
- Resume-job context maintained

### 3. Real-Time Feedback & Loading States

**Loading Indicators:**
- Skeleton loaders for content areas
- Progress spinner during API calls
- Estimated time remaining (optional)
- Cancel request functionality

**Error Handling:**
- User-friendly error messages
- Retry logic with exponential backoff
- Mock response fallback
- Detailed error logs (dev mode)

### 4. Session Management

**Session States:**
- Local session ID generation (client-side)
- Session persistence via localStorage
- Multi-turn conversation history
- Resume data caching

**Session Lifecycle:**
```typescript
// Session creation
const sessionId = generateSessionId();  // UUID
localStorage.setItem('sessionId', sessionId);

// Session persistence
const resumeData = JSON.stringify(resume);
localStorage.setItem(`resume_${sessionId}`, resumeData);

// Session cleanup (on logout)
localStorage.removeItem('sessionId');
sessionStorage.clear();
```

### 5. Responsive & Accessible UI

**Responsive Design:**
- Mobile-first approach (TailwindCSS breakpoints)
- Tablet optimization
- Desktop layout
- Touch-friendly controls

**Accessibility:**
- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- High contrast mode support (dark/light themes)

---

## 6. Component Library

### ResumePreview Component

**Purpose:** Display parsed resume in a formatted, readable layout

**Props:**
```typescript
interface ResumePre viewProps {
  resume: Resume;
  editable?: boolean;
  onUpdate?: (resume: Resume) => void;
}
```

**Features:**
- Sections: Contact, Summary, Experience, Skills, Education
- Syntax highlighting for different resume sections
- Live editing capability
- Download as PDF/text

### StepIndicator Component

**Purpose:** Show progress through multi-step workflow

**Props:**
```typescript
interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  completed: number[];
}
```

**Features:**
- Visual progress bar
- Step titles & descriptions
- Completed/current/pending states
- Click to jump to step (if enabled)

### LoadingState Component

**Purpose:** Display loading indicator while async operations complete

**Props:**
```typescript
interface LoadingStateProps {
  loading: boolean;
  error?: Error | null;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
```

**Features:**
- Skeleton loader screen
- Loading spinner animation
- Error boundary
- Retry button

### WorkflowSteps Component

**Purpose:** Orchestrate multi-agent workflow with step-by-step UI

**Features:**
- Step selection interface
- Agent routing logic
- Response rendering (varies by agent type)
- History view of all agent interactions

### ReportHeader Component

**Purpose:** Display metadata and confidence scores for analysis results

**Props:**
```typescript
interface ReportHeaderProps {
  agent: string;
  confidence_score: number;
  timestamp: string;
  needs_review: boolean;
}
```

**Features:**
- Agent name display
- Confidence score visualization (0-100%)
- Timestamp
- Review escalation badge

---

## 7. API Integration

### Backend Service (backendService.ts)

**Main Functions:**

```typescript
// Chat with agents
const chatWithAgent = async (
  intent: Intent,
  resumeData: Resume,
  jobDescription: string,
  messageHistory?: InterviewMessage[]
): Promise<ChatApiResponse>

// List available agents
const getAvailableAgents = async (): Promise<AgentInfo[]>

// Health check
const getSystemHealth = async (): Promise<HealthStatus>

// Resume normalization
const normalizeResume = async (text: string): Promise<Resume>
```

**Error Handling:**

```typescript
// Automatic retry with exponential backoff
const makeRequestWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> => {
  // Exponential backoff: 1s, 2s, 4s
  // On final failure: return mock response
}
```

**Response Transformation:**

```typescript
// Type-safe response mapping
const transformApiResponse = (raw: any): ChatApiResponse => {
  return {
    agent: raw.agent,
    payload: parseJSON(raw.payload),
    confidence_score: raw.confidence_score || 0,
    needs_review: raw.needs_review || false,
    decision_trace: raw.decision_trace || []
  };
}
```

### Configuration

**Environment Variables:**

```bash
# .env.local

# Required
VITE_API_BASE_URL=http://localhost:8000

# Optional
VITE_MOCK_MODE=false              # Use mock responses
VITE_API_TIMEOUT=30000             # Milliseconds
VITE_RETRY_MAX_ATTEMPTS=3

# Debugging
VITE_DEBUG_MODE=false              # Enable debug logs
```

---

## 8. State Management

### React Context Approach

**Rationale:** Small to medium application doesn't require Redux/Zustand; React Context sufficient for session state, loading states, and user preferences.

**Contexts:**

1. **LoadingContext** - Global async operation state
2. **SessionContext** - Session ID, resume data, history
3. **Local Component State** - Form inputs, UI toggles

### Example: Interview Coach State

```typescript
// Component state for multi-turn interview
const [interviews State, setInterviewState] = useState({
  currentQuestion: 1,
  totalQuestions: 5,
  questionHistory: [],
  scores: [],
  feedback: [],
  canProceed: false
});

// Session persistence
useEffect(() => {
  const saved = localStorage.getItem(`interview_${sessionId}`);
  if (saved) setInterviewState(JSON.parse(saved));
}, [sessionId]);

useEffect(() => {
  localStorage.setItem(`interview_${sessionId}`, JSON.stringify(interviewState));
}, [interviewState, sessionId]);
```

---

## 9. Security Considerations

### Frontend Security Controls

**1. Input Validation**
```typescript
// Validate resume file size & type
if (file.size > MAX_FILE_SIZE) {
  throw new Error("File too large (max 10MB)");
}
if (file.type !== "application/pdf") {
  throw new Error("Only PDF files accepted");
}
```

**2. XSS Prevention**
```typescript
// React automatically escapes JSX by default
// Avoid using dangerouslySetInnerHTML
❌ <div dangerouslySetInnerHTML={{ __html: response }} />
✅ <div>{response}</div>  // Automatically escaped
```

**3. API Key Security**
```typescript
// Never expose API keys in frontend code
// Backend API key passed via environment secrets (GitHub Actions)
❌ VITE_GEMINI_API_KEY=sk-...  // WRONG
✅ Backend handles all authenticated API calls

// Frontend only needs backend URL
VITE_API_BASE_URL=http://localhost:8000
```

**4. Session Security**
```typescript
// Use sessionStorage for sensitive data (cleared on browser close)
sessionStorage.setItem("interviewHistory", JSON.stringify(data));

// HTTPS only in production
// Cookie flags: Secure, HttpOnly, SameSite
```

**5. CORS Protection**
```typescript
// Backend enforces CORS headers
// Frontend respects same-origin policy
// Credentials not sent in CORS requests (unless explicitly configured)
```

### Content Security Policy (CSP)

**Recommended CSP headers** (configure in `nginx.conf` or server):
```nginx
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' http://localhost:8000;
```

---

## 10. Testing

### Unit Tests with Vitest

**Test Files:**
```bash
tests/
├── backendService.test.js    # API client tests
├── App.test.tsx             # (To add) Main component tests
├── components/              # (To add) Component tests
└── utils/                   # (To add) Utility tests
```

**Running Tests:**
```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

**Example Test:**
```typescript
// tests/backendService.test.js
import { chatWithAgent } from '../backendService';

describe('backendService', () => {
  it('should call /api/v1/chat with correct payload', async () => {
    const result = await chatWithAgent(
      'RESUME_CRITIC',
      mockResume,
      mockJobDescription
    );
    expect(result.agent).toBe('ResumeCriticAgent');
    expect(result.confidence_score).toBeGreaterThan(0);
  });
});
```

---

## 11. Deployment

### Build for Production

```bash
npm run build
# Output: dist/ directory with static assets
```

### Docker Deployment

**2-stage Dockerfile:**
```dockerfile
# Stage 1: Build
FROM node:18 AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime (nginx)
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
```

**Build & run:**
```bash
docker build -t interviewready-frontend:latest .
docker run -p 3000:3000 interviewready-frontend:latest
```

### Cloud Deployment (Google Cloud Run)

**Deployment via GitHub Actions:**
```yaml
# .github/workflows/deploy.yml
- name: Deploy Frontend to Cloud Run
  run: |
    gcloud run deploy interviewready-frontend \
      --image gcr.io/${{ env.GCP_PROJECT_ID }}/interviewready-frontend \
      --region asia-southeast1 \
      --allow-unauthenticated \
      --set-env-vars VITE_API_BASE_URL=${{ secrets.BACKEND_URL }}
```

See **[DEPLOYMENT.md](../DEPLOYMENT.md)** for full infrastructure setup.

---

## 12. Performance Optimization

### Build Optimization

**Vite Production Build:**
```bash
npm run build
# Automatically:
# - Minifies JavaScript & CSS
# - Tree-shakes unused code
# - Creates source maps
# - Splits code into chunks
```

**Bundle Analysis:**
```bash
npm run build -- --analyze
```

### Runtime Optimization

**1. Code Splitting**
```typescript
// Lazy load components
import { lazy, Suspense } from 'react';

const InterviewCoach = lazy(() => import('./components/InterviewCoach'));

<Suspense fallback={<LoadingSpinner />}>
  <InterviewCoach />
</Suspense>
```

**2. Memoization**
```typescript
// Prevent unnecessary re-renders
import { memo, useMemo, useCallback } from 'react';

const ResumePreview = memo(({ resume }: Props) => {
  const memoizedContent = useMemo(() => renderResume(resume), [resume]);
  return <div>{memoizedContent}</div>;
});
```

**3. Image Optimization**
```typescript
// Use next-gen image formats
<img src="resume.webp" alt="Resume preview" loading="lazy" />
```

### Caching Strategy

**HTTP Cache Headers** (via nginx):
```nginx
location ~* \.(js|css)$ {
  expires 1y;  # Cache static assets for 1 year
}

location / {
  expires 1h;  # Cache HTML for 1 hour
}
```

**Service Worker** (optional, for PWA):
```typescript
// Implemented in vite.config.ts with @vitejs/plugin-pwa
```

---

## Additional Resources

- **[Main README](../README.md)** — Project overview
- **[Backend README](../backend/README.md)** — API documentation
- **[Deployment Guide](../DEPLOYMENT.md)** — Cloud infrastructure
- **[React Documentation](https://react.dev/)** — React concepts
- **[Vite Documentation](https://vitejs.dev/)** — Build tool guide
- **[TailwindCSS Documentation](https://tailwindcss.com/)** — CSS framework
- **[TypeScript Handbook](https://www.typescriptlang.org/docs/)** — Type system

---

**Last Updated:** March 2026  
**Version:** 1.0  
**Maintainers:** InterviewReady Development Team
├── index.tsx               # Application entry point
├── vite.config.ts          # Vite configuration
└── package.json            # Dependencies and scripts
```

## API Integration

### Backend Service

The `backendService.ts` module handles all communication with the backend API:

```typescript
// Main chat endpoint
const response = await backendService.chat(message, sessionId);

// Session management
const session = await backendService.createSession();
```

### Response Handling

The frontend processes structured responses from different agents:

- **Text Responses**: Markdown rendering for critique and coaching
- **JSON Responses**: Structured data display for analysis results
- **Error Handling**: Graceful degradation with user-friendly error messages

## Testing

### Running Tests

1. Run all tests:
```bash
npm run test
```

2. Run tests with UI:
```bash
npm run test:ui
```

3. Run tests in watch mode:
```bash
npm run test:watch
```

### Test Structure

- **Unit Tests**: Component logic and service functions
- **Integration Tests**: API communication and data flow
- **Mock Tests**: Development with simulated backend responses

### Writing Tests

Test files should follow the naming convention `*.test.js` or `*.test.ts`:

```javascript
import { describe, it, expect } from 'vitest';

describe('Component/Service Name', () => {
  it('should perform expected behavior', async () => {
    // Test implementation
    expect(result).toBeDefined();
  });
});
```

## Development Workflow

### Component Development

1. Create components in the `components/` directory
2. Use TypeScript for type safety
3. Follow React best practices with hooks
4. Implement responsive design with TailwindCSS

### API Integration

1. Use `backendService.ts` for all API calls
2. Handle loading states and errors appropriately
3. Implement proper TypeScript types for responses
4. Test with both real and mock backend responses

### Styling Guidelines

- Use TailwindCSS utility classes for styling
- Implement responsive design with mobile-first approach
- Follow consistent spacing and color schemes
- Ensure accessibility with proper ARIA labels

## Environment Variables

- `VITE_API_BASE_URL`: Backend API URL (default: `http://localhost:8000`)

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure backend allows frontend origin (localhost:3000)
2. **Authentication Errors**: Verify backend authentication configuration
3. **Backend Unavailable**: Check if backend is running on port 8000
4. **API Timeouts**: Verify backend performance and network connectivity

### Development Tips

- Use browser dev tools to inspect API requests and responses
- Check the console for detailed error messages
- Use the React Developer Tools extension for component debugging
- Test with different screen sizes for responsive design validation
