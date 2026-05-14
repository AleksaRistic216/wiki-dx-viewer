import { NextResponse } from 'next/server';
const { completeSession } = require('@/lib/editing');

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = completeSession(body.commitMessage);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
