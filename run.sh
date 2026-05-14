#!/bin/bash
cd "$(dirname "$0")/src"
npm install --silent 2>/dev/null
npm run build
npm run start
