# Contributing to api-to-skill

First off, thank you for considering contributing to api-to-skill! It's people like you that make this tool great for the AI agent ecosystem.

## Code of Conduct

By participating in this project, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Reporting Bugs

- Use the GitHub issue tracker to report bugs.
- Describe the bug in detail and provide a minimal reproducible example if possible.
- Include your Node.js version, OS, and the input you used.

### Feature Requests

- Open an issue to discuss the feature before starting implementation.
- Explain why the feature is needed and how it would benefit the project.

### Pull Requests

1. Fork the repository and create your branch from `main`.
2. Install dependencies: `pnpm install`
3. If you've added code that should be tested, add tests.
4. Ensure your code passes linting: `pnpm lint`
5. Ensure the test suite passes: `pnpm test`
6. Format your code: `pnpm format`
7. Make sure your code follows the project's conventions (ESM, strict TypeScript).
8. Push to your fork and open a Pull Request.

## Development Setup

```bash
# Clone and install
git clone https://github.com/your-org/api-to-skill.git
cd api-to-skill
pnpm install

# Run the CLI in dev mode
pnpm dev generate --input fixtures/petstore.openapi.json

# Run tests
pnpm test

# Build
pnpm build

# Run compiled output
pnpm start generate --input fixtures/petstore.openapi.json
```

## Style Guide

- **ESM only** — use `import`/`export`, all imports must include `.js` extension (even for `.ts` sources).
- **Strict TypeScript** — no `any`, proper type annotations.
- Follow existing naming conventions and file structure.
- Write clear, documented code.
- Use conventional commits for your commit messages.

## Architecture Overview

```
Input (OpenAPI / URL / Markdown)
  → Ingestor: Extract raw endpoints
    → Enricher (optional): LLM adds semantic descriptions
      → Generator: Groups by tag, writes skill files
        → Output: ./skills/*.skill.ts
```

Key directories:
- `src/ingestors/` — Extract endpoints from different sources
- `src/enrichers/` — Optional LLM-based semantic enrichment
- `src/generators/` — Generate TypeScript skill files
- `src/types/` — Shared TypeScript interfaces
- `src/utils/` — Helper functions (logging, file I/O)
- `src/validators/` — Input validation with Zod
- `tests/` — Test files (vitest)
- `fixtures/` — Sample OpenAPI specs for testing

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.
