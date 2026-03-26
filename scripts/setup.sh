#!/usr/bin/env bash
# scripts/setup.sh — verify environment and install dependencies
set -euo pipefail

echo "→ Checking Node.js version..."
node_version=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [[ -z "$node_version" || "$node_version" -lt 20 ]]; then
  echo "  ERROR: Node.js 20 or higher required. Found: $(node --version 2>/dev/null || echo 'not found')"
  exit 1
fi
echo "  Node.js $(node --version) ✓"

echo "→ Installing dependencies..."
npm install
echo "  Dependencies installed ✓"

echo "→ Running typecheck..."
npm run typecheck
echo "  Typecheck passed ✓"

echo "→ Running tests..."
npm test
echo "  Tests passed ✓"

echo "→ Building..."
npm run build
echo "  Build complete ✓"

echo ""
echo "Setup complete. Usage:"
echo ""
echo "  # Set required env vars"
echo "  export LLM_BASE_URL=https://api.openai.com/v1"
echo "  export LLM_API_KEY=sk-..."
echo "  export LLM_MODEL=gpt-4o"
echo ""
echo "  # Run CLI"
echo "  node dist/cli/index.js convert workflow.json"
echo ""
echo "  # Or install globally"
echo "  npm install -g ."
echo "  n8n-to-claw convert workflow.json"
echo ""
echo "  # Optional: web UI (from repo root)"
echo "  cd web && npm install && npm run dev"
