# api-to-skill

> CLI tool that converts APIs and documentation into structured skill files for AI agents.

Feed it an OpenAPI spec, a URL, or Markdown docs — get back ready-to-use TypeScript skill modules compatible with Claude tool use.

## Features

- **Multiple input formats**: OpenAPI/Swagger, URLs, or Markdown documentation
- **Automatic endpoint extraction**: Parses specs and discovers endpoints
- **Optional LLM enrichment**: Adds semantic descriptions using Claude (requires API key)
- **Tag-based grouping**: Organizes endpoints into logical skill modules
- **ESM-native output**: Generates TypeScript files ready for modern AI agent frameworks
- **Dry-run mode**: Preview output without writing files

## Installation

```bash
# Clone and install
git clone https://github.com/your-org/api-to-skill.git
cd api-to-skill
pnpm install

# Or install globally
pnpm install -g .
```

## Usage

### Basic: generate skills from an OpenAPI file

```bash
pnpm dev generate --input fixtures/petstore.openapi.json --output ./skills
```

### With LLM enrichment (requires Anthropic API key)

```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

pnpm dev generate --input fixtures/petstore.openapi.json --enrich
```

### From a URL (auto-discovers OpenAPI spec)

```bash
pnpm dev generate --input https://api.example.com --enrich
```

### From Markdown documentation

```bash
pnpm dev generate --input docs/api-reference.md --format markdown --output ./skills
```

### Dry run (preview without writing files)

```bash
pnpm dev generate --input fixtures/petstore.openapi.json --dry-run
```

### All options

| Option        | Description                                              | Default       |
| ------------- | -------------------------------------------------------- | ------------- |
| `--input`     | Path to OpenAPI file, URL, or Markdown file (required)   | —             |
| `--output`    | Output directory for skill files                         | `./skills`    |
| `--format`    | Input type: `openapi`, `url`, `markdown`                 | autodetect    |
| `--enrich`    | Enable LLM semantic enrichment                           | `false`       |
| `--dry-run`   | Print output to console without writing files            | `false`       |

## Output

Each skill group generates a `.skill.ts` file:

```ts
// pet.skill.ts
export const petSkill = {
  name: "pet",
  description: "Everything about your Pets — 6 tool(s)",
  version: "1.0.0",
  tools: [
    {
      name: "pet_post__pet",
      description: "Add a new pet to the store. An AI agent should use this when creating a new pet record with name and status.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Pet name" },
          status: { type: "string", description: "Pet status" }
        },
        required: ["name", "status"]
      }
    },
    // ... more tools
  ]
} as const;
```

These files export constants compatible with Anthropic Claude's tool definitions, ready to be imported by your agent application.

## Architecture

```
Input (OpenAPI / URL / Markdown)
  → Ingestor: Extract raw endpoints
    → Enricher (optional): LLM adds semantic descriptions
      → Generator: Groups by tag, writes skill files
        → Output: ./skills/*.skill.ts
```

Key directories:

| Path                 | Purpose                                |
| -------------------- | -------------------------------------- |
| `src/ingestors/`     | Extract endpoints from different sources |
| `src/enrichers/`     | Optional LLM-based semantic enrichment |
| `src/generators/`    | Generate TypeScript skill files        |
| `src/types/`         | Shared TypeScript interfaces           |
| `src/utils/`         | Helper functions (logging, file I/O)   |
| `src/validators/`    | Input validation with Zod              |
| `fixtures/`          | Sample OpenAPI specs for testing       |

## Development

```bash
# Run in dev mode
pnpm dev generate --input fixtures/petstore.openapi.json

# Build to dist/
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint

# Format code
pnpm format

# Run compiled output
pnpm start generate --input fixtures/petstore.openapi.json
```

## Testing

```bash
# Run all tests
pnpm test

# Run specific test
pnpm vitest run -t "describes"

# Run with coverage
pnpm vitest run --coverage
```

## Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before getting started.

## License

MIT — see [LICENSE](LICENSE) for details.
