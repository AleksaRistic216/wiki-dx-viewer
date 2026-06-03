import { NextResponse } from 'next/server';
const { listWikis, getWikiPageList } = require('@/lib/wiki');
const { indexPages, hasIndex } = require('@/lib/embeddings');

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const targetWiki = body.wiki || null;

    const wikis = targetWiki ? [{ id: targetWiki }] : listWikis();
    const results = {};

    for (const wiki of wikis) {
      const pages = getWikiPageList(wiki.id, null);
      const result = await indexPages(wiki.id, pages);
      results[wiki.id] = result;
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const wikis = listWikis();
    const status = {};

    for (const wiki of wikis) {
      status[wiki.id] = { indexed: hasIndex(wiki.id) };
    }

    return NextResponse.json({ status });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
