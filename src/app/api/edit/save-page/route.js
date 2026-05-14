import { NextResponse } from 'next/server';
const { savePage } = require('@/lib/editing');

export async function POST(request) {
  try {
    const { wiki, pagePath, content } = await request.json();
    if (!wiki || !pagePath || content === undefined) {
      return NextResponse.json({ error: 'Missing wiki, pagePath, or content' }, { status: 400 });
    }
    const result = savePage(wiki, pagePath, content);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
