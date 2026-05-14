import { NextResponse } from 'next/server';
const { getWikiNav } = require('@/lib/wiki');

export async function GET(request, { params }) {
  try {
    const { wiki } = await params;
    const nav = getWikiNav(wiki);
    if (!nav) return NextResponse.json({ error: 'Wiki not found' }, { status: 404 });
    return NextResponse.json(nav);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
