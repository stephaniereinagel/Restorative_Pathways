#!/usr/bin/env bash
set -euo pipefail

echo "Building..."
npx tsc -b && npx vite build

echo "Deploying to Cloudflare Pages..."
npx wrangler pages deploy dist --project-name restorative-pathways --commit-dirty=true

echo "Done!"
