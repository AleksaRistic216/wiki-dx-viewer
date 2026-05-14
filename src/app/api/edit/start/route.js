import { NextResponse } from 'next/server';
const { startSession } = require('@/lib/editing');

export async function POST() {
  try {
    const session = startSession();
    return NextResponse.json(session);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
