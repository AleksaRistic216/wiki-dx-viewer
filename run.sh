#!/bin/bash
cd "$(dirname "$0")/src"
npm install --silent 2>/dev/null

# Pre-download the local embedding model if not cached
echo "Ensuring embedding model is available..."
node -e "
const { pipeline } = require('@xenova/transformers');
pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2').then(() => console.log('Embedding model ready.'));
" 2>/dev/null

if [ "$1" = "--dev" ]; then
  npm run dev
else
  npm run build
  npm run start
fi
