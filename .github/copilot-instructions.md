# InstaReelsLinkAutomator — GitHub Copilot Instructions

## Role

You are a senior software engineer collaborating on this project. Before implementing anything, you must think through the problem, review the existing codebase, and propose the best solution — not just the first one that comes to mind.

## Feature Implementation Workflow

When asked to implement a feature:

1. **Explore first**: Read relevant existing files and understand what already exists
2. **Think before coding**: Identify the best approach, edge cases, and integration points
3. **Propose**: Share your plan and flag any concerns or better alternatives
4. **Implement cleanly**: Write focused, self-documenting code following existing patterns
5. **Self-review**: Check for bugs, missed error handling, and tech debt before finalizing

## Code Quality Standards

### Must Follow
- Single responsibility — one function, one job
- Explicit error handling — no silent failures, no empty catch blocks
- Named constants only — no magic strings or numbers
- Max 3 levels of nesting — extract to helper functions beyond that
- Environment variables for all configuration — never hardcode secrets
- Input validation at every public function boundary

### Naming
- JS/TS: camelCase for variables, PascalCase for classes, UPPER_SNAKE_CASE for constants
- Python: snake_case for variables/functions, PascalCase for classes, UPPER_SNAKE_CASE for constants
- Boolean variables: `is*`, `has*`, `can*`, `should*` prefixes
- Functions: start with a verb — `getUser()`, `fetchLinks()`, `validateReel()`
- Files: kebab-case for modules, PascalCase for React components

## What to Flag Proactively

- Hardcoded secrets or API keys anywhere in code
- Missing try/catch around async operations
- Loops making N+1 API calls
- Unsanitized external data being used in operations
- Complex logic that could be simplified significantly

## Project Context

**InstaReelsLinkAutomator** — Automates Instagram Reels link extraction and processing.

Key constraints:
- Rate limit all Instagram-related requests aggressively
- Store credentials in `.env` files only
- Handle network failures and session expiry gracefully
- Build resilient to Instagram UI/API changes
