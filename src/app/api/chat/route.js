import { NextResponse } from 'next/server';
const { chat } = require('@/lib/wiki');

export async function POST(request) {
  try {
    const { messages, wiki, currentPage, pageContent } = await request.json();
    if (!messages || !messages.length) {
      return NextResponse.json({ error: 'No messages' }, { status: 400 });
    }
    const reply = await chat(messages, wiki, currentPage, pageContent);
    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
