import { NextResponse } from 'next/server';
const { searchWiki } = require('@/lib/wiki');

export async function GET(request, { params }) {
  try {
    const { wiki } = await params;
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    if (!q) return NextResponse.json([]);
    const results = searchWiki(wiki, q);
    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
