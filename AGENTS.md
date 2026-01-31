# AGENTS.md - Resume Optimizer Explainability Project

> **Note:** For system architecture and agent responsibilities, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
> **Note:** For current status of project and project roadmap, see [docs/PROJECT-STATUS.md](docs/PROJECT-STATUS.md)
> **Note:** Tests are required to be written and to pass for each phase to complete.

## 1. Build/Lint/Test Commands

### Build Commands

- `npm run build` - Build the project (if available)
- `bun run build` - Build using Bun package manager
- `tsc` - TypeScript compilation

### Lint Commands

- `npm run lint` - Run linting (if available)
- `eslint .` - Run ESLint on the project
- `prettier --check .` - Check code formatting

### Test Commands

- `npm test` - Run all tests
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test -- --testNamePattern="test name"` - Run specific test by name
- `jest test-file.test.ts` - Run a single test file
- `jest test-file.test.ts -t "test description"` - Run specific test in file

### Development Commands

- `npm run dev` - Run in development mode
- `bun run dev` - Run development mode with Bun
- `npm run start` - Start the application

## 2. Code Style Guidelines

### TypeScript/JavaScript Standards

- Use TypeScript for all new code
- Strict null checks enabled
- Explicit return types for all functions
- Use interfaces for object shapes
- Prefer `const` over `let`, avoid `var`

### Import Organization

```typescript
// Framework imports first
import React from 'react';

// Library imports second
import { zod } from 'zod';

// Local imports third (grouped by feature/module)
import { ResumeSchema } from '../schemas/resume';
import { JobDescriptionSchema } from '../schemas/job';

// Relative imports last
import { utils } from './utils';
```

### Formatting Rules

- 2-space indentation
- Single quotes for strings
- Semicolons required
- Maximum line length: 100 characters
- Trailing commas in multi-line objects/arrays
- Consistent spacing around operators and after commas

### Naming Conventions

- **Variables/Functions**: camelCase (`calculateScore`, `resumeData`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_SCORE`, `DEFAULT_TIMEOUT`)
- **Types/Interfaces**: PascalCase (`ResumeType`, `JobDescriptionInterface`)
- **Classes**: PascalCase (`ScoringAgent`, `OptimizationEngine`)
- **Files**: kebab-case (`scoring-agent.ts`, `resume-optimizer.ts`)
- **Test files**: `*.test.ts` or `*.spec.ts` suffix

### Error Handling

- Use custom error classes for domain-specific errors
- Always handle async errors with try/catch
- Validate all external inputs with Zod schemas
- Provide meaningful error messages
- Use `throw new Error('message')` for unexpected conditions

### Type Safety

- Use Zod for runtime validation
- Define comprehensive TypeScript interfaces
- Avoid `any` type - use `unknown` with type guards instead
- Use type predicates for complex validation
- Generic types for reusable components

## 3. Project Structure

```
/
├── src/
│   ├── agents/           # Agent implementations
│   ├── schemas/          # Zod validation schemas
│   ├── types/            # TypeScript interfaces
│   ├── utils/            # Utility functions
│   ├── services/         # Core business logic
│   └── tests/            # Test files
├── .opencode/           # OpenCode AI configuration
├── AGENTS.md            # This file
└── package.json         # Project configuration
```

## 4. Agent-Specific Guidelines

### Extractor Agent

- Use Zod for strict schema validation
- No data transformation - extract only
- Handle various resume formats (PDF, DOCX, text)
- Preserve original formatting where possible

### Scoring Agent

- Deterministic scoring algorithms only
- All scoring logic must be explainable
- Use feature vectors for transparency
- Document all scoring formulas

### Explainability Agent

- Use SHAP/LIME methodologies
- Provide both positive and negative contributors
- Generate actionable counterfactuals
- Ensure explanations sum to 100%

### Optimization Agent

- Never fabricate experience or skills
- Maintain chronological accuracy
- Focus on clarity and relevance
- Document all changes with rationale

### Validation Agent

- Verify score improvements
- Check constraint compliance
- Detect hallucinations
- Provide approval/rejection reasoning

## 5. Testing Standards

### Test Organization

- Unit tests in `__tests__` directories or `*.test.ts` files
- Integration tests in `tests/integration/`
- End-to-end tests in `tests/e2e/`

### Test Naming

- `describe('Component/Function', () => {})` for test suites
- `test('should do something when condition', () => {})` for test cases
- `it('should handle edge case properly', () => {})` for specific behaviors

### Test Coverage

- Minimum 80% code coverage required
- Test all error paths and edge cases
- Include both happy path and failure scenarios
- Mock external dependencies

## 6. Documentation Standards

### Code Comments

- Use JSDoc for public APIs
- Explain complex algorithms
- Document non-obvious business logic
- Avoid redundant comments

### Commit Messages

- Use conventional commits format
- `feat: add new scoring algorithm`
- `fix: handle null values in resume parser`
- `docs: update AGENTS.md guidelines`
- `refactor: improve error handling in optimizer`

### Pull Request Requirements

- Reference related issues
- Include test coverage changes
- Document breaking changes
- Provide clear description of changes

## 7. Performance Guidelines

- Avoid unnecessary computations in scoring
- Cache expensive operations
- Use efficient data structures
- Profile before optimizing
- Document performance characteristics

## 8. Security Practices

- Validate all external inputs
- Sanitize user-provided data
- Use secure coding practices
- Handle sensitive data appropriately
- Follow principle of least privilege

## 9. OpenCode AI Integration

- Use provided SDK for agent communication
- Follow OpenCode tool usage patterns
- Handle tool errors gracefully
- Document agent capabilities and limitations

## 10. Continuous Integration

- Run linting on every commit
- Execute tests on pull requests
- Enforce code coverage requirements
- Automate build and deployment
- Include security scanning

## 11. Debugging Practices

- Use descriptive error messages
- Include relevant context in logs
- Implement comprehensive logging
- Provide debug modes for agents
- Document common issues and solutions

## 12. Dependency Management

- Regular dependency updates
- Security vulnerability monitoring
- Minimal dependency footprint
- Document dependency rationale
- Use exact versions in production

## 13. Agent Collaboration Protocol

1. **Extractor** → **Scoring** → **Explainability** → **Optimization** → **Validation**
2. Each agent validates inputs from previous agent
3. All inter-agent communication uses defined schemas
4. Errors propagate with context to user
5. State is preserved between agent executions

## 14. Monitoring and Observability

- Instrument key operations
- Track agent execution times
- Monitor error rates
- Log important decisions
- Provide health checks

## 15. Deployment Guidelines

- Use feature flags for new functionality
- Implement rollback procedures
- Monitor post-deployment metrics
- Document deployment processes
- Automate where possible
