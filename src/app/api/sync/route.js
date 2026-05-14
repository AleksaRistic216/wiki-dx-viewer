import { NextResponse } from 'next/server';
const { syncRepo } = require('@/lib/wiki');

export async function POST() {
  try {
    syncRepo();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
