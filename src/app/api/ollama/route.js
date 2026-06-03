import { NextResponse } from 'next/server';

const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';

export async function GET() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!res.ok) throw new Error('Ollama not reachable');
    const data = await res.json();
    const models = (data.models || []).map(m => ({
      id: m.name,
      size: m.size,
      modified: m.modified_at,
    }));
    return NextResponse.json({ models });
  } catch (err) {
    return NextResponse.json({ error: err.message, models: [] }, { status: 503 });
  }
}

export async function POST(request) {
  try {
    const { action, model } = await request.json();

    if (action === 'pull') {
      const res = await fetch(`${OLLAMA_BASE}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model }),
      });

      // Stream the pull progress
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const text = decoder.decode(value);
              controller.enqueue(encoder.encode(text));
            }
          } finally {
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: { 'Content-Type': 'application/x-ndjson' },
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
