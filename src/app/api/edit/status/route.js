import { NextResponse } from 'next/server';
const { getStatus } = require('@/lib/editing');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = getStatus();
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
