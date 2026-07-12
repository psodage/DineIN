# DineIN — Coding Standards

## General

- **Language**: JavaScript (ES2022+)
- **Module system**: CommonJS for backend, ESM for frontend
- **Formatting**: Prettier (auto-format on save)
- **Linting**: ESLint

## Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Files | camelCase | `authService.js` |
| Directories | kebab-case | `bill-split/` |
| Variables | camelCase | `studentId` |
| Constants | UPPER_SNAKE | `MAX_RETRIES` |
| Classes | PascalCase | `AuthService` |
| React Components | PascalCase | `MealCard` |
| Database tables | snake_case | `monthly_bills` |
| API routes | kebab-case | `/api/snack-orders` |

## Backend Patterns

### Module Pattern
Every feature lives in `backend/src/modules/<name>/` with:
- **controller** — Thin HTTP handlers, no business logic
- **service** — Business rules and orchestration
- **repository** — Database queries only, no HTTP concerns
- **validation** — Zod schemas, validated via middleware
- **routes** — Express Router with middleware chain

### Error Handling
- Use `asyncHandler` wrapper on all async route handlers
- Throw errors with `.status` property for HTTP status codes
- Never use `try/catch` in controllers — let the central error handler catch

```js
// ✅ Good
async function getStudent(req, res) {
  const student = await studentService.findById(req.params.id);
  res.json({ success: true, data: student });
}

// ❌ Bad — don't catch in controllers
async function getStudent(req, res) {
  try {
    const student = await studentService.findById(req.params.id);
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
```

### Response Format
All API responses follow this shape:

```json
{ "success": true, "data": { ... } }
{ "success": false, "message": "Error description" }
```

## Frontend Patterns

### Component Structure
- One component per file
- Named exports for sub-components, default export for main
- Co-locate styles/utils with the component when specific to it

### State Management
- React Context for auth state
- Local state (`useState`) for component-level state
- Avoid prop drilling beyond 2 levels — use context or composition

## Git

- **Commit messages**: Use conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **Branch naming**: `feature/<name>`, `fix/<name>`, `chore/<name>`
