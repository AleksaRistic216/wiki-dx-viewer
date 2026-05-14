import { NextResponse } from 'next/server';
const { getWikiPage } = require('@/lib/wiki');

export async function GET(request, { params }) {
  try {
    const { wiki, pagePath } = await params;
    const joined = Array.isArray(pagePath) ? pagePath.join('/') : pagePath;
    const page = getWikiPage(wiki, joined);
    if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    return NextResponse.json(page);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
