#!/bin/bash
cd "$(dirname "$0")/src"
npm install --silent 2>/dev/null

if [ "$1" = "--dev" ]; then
  npm run dev
else
  npm run build
  npm run start
fi
