import { NextResponse } from 'next/server';
const { discardSession } = require('@/lib/editing');

export async function POST() {
  try {
    const result = discardSession();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
