# Agent Guidelines & Quality Assurance

## Code Quality & Linting Rules
Always run PyLint, linting, and Ruff check whenever publishing, modifying, or delivering code in this repository:

1. **Ruff Linter & Formatter**:
   - Run: `ruff check <files_or_directories>`
   - To check the entire project: `ruff check .`
   - Fix auto-fixable issues when appropriate: `ruff check --fix <files_or_directories>`

2. **PyLint**:
   - Run: `python -m pylint <files_or_directories>`
   - Address errors and warnings before completing any code changes.

3. **Frontend Linting (when touching `apps/web`)**:
   - Run: `npm run lint` or syntax check within `apps/web`.
