import { NextResponse } from 'next/server';
const { chat } = require('@/lib/wiki');

export async function POST(request) {
  try {
    const { messages, wiki, currentPage, pageContent, enableEditing, model } = await request.json();
    if (!messages || !messages.length) {
      return NextResponse.json({ error: 'No messages' }, { status: 400 });
    }
    const result = await chat(messages, wiki, currentPage, pageContent, { enableEditing: !!enableEditing, model: model || 'gpt-4o' });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
