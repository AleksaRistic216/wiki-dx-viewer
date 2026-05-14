import { NextResponse } from 'next/server';
const { listWikis } = require('@/lib/wiki');

export async function GET() {
  try {
    const wikis = listWikis();
    return NextResponse.json(wikis);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
