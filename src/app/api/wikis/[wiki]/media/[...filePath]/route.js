import { NextResponse } from 'next/server';
const path = require('path');
const fs = require('fs');
const { getDocsRoot } = require('@/lib/wiki');

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
};

export async function GET(request, { params }) {
  try {
    const { wiki, filePath } = await params;
    const joined = Array.isArray(filePath) ? filePath.join('/') : filePath;
    const docsRoot = getDocsRoot();

    const ymlPath = path.join(docsRoot, wiki, 'mkdocs.yml');
    if (!fs.existsSync(ymlPath)) {
      return NextResponse.json({ error: 'Wiki not found' }, { status: 404 });
    }

    const yaml = require('js-yaml');
    const ymlContent = fs.readFileSync(ymlPath, 'utf8');
    const sanitized = ymlContent.replace(/!!python\/name:\S+/g, "'__python_tag__'");
    const yml = yaml.load(sanitized);
    const docsDir = path.join(docsRoot, wiki, yml.docs_dir || 'docs');

    const fullPath = path.join(docsDir, joined);

    // Security: ensure path stays within docs directory
    if (!fullPath.startsWith(docsDir)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const ext = path.extname(fullPath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    const fileBuffer = fs.readFileSync(fullPath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
