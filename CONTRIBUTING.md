# Contributing to Multi-Model-RAG

Thanks for your interest in improving Multi-Model-RAG! This guide covers the
fast path from a fresh clone to a green PR.

## Development Setup

Requirements: **Python ≥ 3.10** and **Node ≥ 20** (only if you touch the
dashboard).

```bash
git clone https://github.com/HKUDS/Multi-Model-RAG.git
cd Multi-Model-RAG

# Create an isolated environment (uv recommended; venv works too)
python -m venv .venv && source .venv/bin/activate

# Install the package in editable mode with all extras + dev tooling
pip install -e '.[all]' pytest pytest-asyncio pytest-cov mypy pre-commit

# Install the pre-commit hooks
pre-commit install
```

Optional — dashboard:

```bash
cd dashboard
npm ci
npm run dev   # http://localhost:3000
```

Optional — backend API (requires an `.env`, see `env.example`):

```bash
./start.sh --backend
```

## Running the Checks

The same checks run in CI:

```bash
# Formatting + lint (auto-fixes)
pre-commit run --all-files

# Type checking
mypy multi_model_rag

# Unit tests
pytest -q

# Dashboard (from dashboard/)
npm run lint && npm run typecheck && npm run build
```

## Project Layout

```
multi_model_rag/       # Python package (core library)
  multi_model_rag.py   # MultiModelRAG entry class
  parser.py            # Mineru / Docling / PaddleOCR backends
  modalprocessors.py   # Image / table / equation processors
  query.py             # QueryMixin and hybrid / VLM query modes
  processor.py         # ProcessorMixin — insertion pipeline
  dashboard_api.py     # FastAPI backend for the dashboard
  advanced_rag.py      # Contextual retrieval, grading, grounding, cache
  improvements.py      # HyDE, multi-query, decomposition, routing
  _logging.py          # Package logger factory

dashboard/             # Next.js 16 + React 19 admin UI
examples/              # Runnable integration demos (Ollama, vLLM, …)
tests/                 # Pytest suite
docs/                  # Feature guides
scripts/               # Maintenance scripts (tiktoken cache, …)
reproduce/             # Paper-reproduction artefacts
```

## How to Add a New Parser Plugin

Multi-Model-RAG has a runtime parser registry. Third-party parsers can plug in
without forking the repo.

```python
from multi_model_rag import Parser, register_parser, ParsedDocument

class MyParser(Parser):
    name = "my-parser"

    def parse_document(self, file_path, **kwargs) -> list[dict]:
        # Return a content_list (MinerU-compatible schema):
        # [{"type": "text" | "image" | "table" | "equation", ...}, ...]
        ...

    def check_installation(self) -> bool:
        return True  # report whether native deps are available

register_parser("my-parser", MyParser)
```

Then use it via `MultiModelRAGConfig(parser="my-parser")` or
`PARSER=my-parser` in `.env`.

Tests for new parsers should live in `tests/` and use the fixture patterns
already established in `tests/testparser_wiring.py` and
`tests/test_custom_parser.py`.

## Commit & PR Conventions

- Follow [Conventional Commits](https://www.conventionalcommits.org/) where
  reasonable: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Keep PRs focused — one concern per PR. Large refactors should be split.
- Update documentation in `docs/` when you change user-visible behaviour.
- Update **both** `README.md` and `README_zh.md` if you change anything in the
  top-level feature list.
- Make sure `pre-commit`, `mypy`, `pytest`, and the dashboard build are all
  green before marking the PR ready for review.

## Reporting Security Issues

See [SECURITY.md](SECURITY.md). **Do not** open public issues for security
problems.

## License

By contributing you agree that your contributions will be licensed under the
[MIT License](LICENSE).
