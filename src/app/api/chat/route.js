import { NextResponse } from 'next/server';
const { chatStream } = require('@/lib/wiki');

export async function POST(request) {
  try {
    const { messages, wiki, currentPage, pageContent, enableEditing, model, source } = await request.json();
    if (!messages || !messages.length) {
      return NextResponse.json({ error: 'No messages' }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(event, data) {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        }

        try {
          await chatStream(messages, wiki, currentPage, pageContent, {
            enableEditing: !!enableEditing,
            model: model || 'gpt-4o',
            source: source || 'github',
            onStatus(text) {
              send('status', { text });
            },
            onToken(token) {
              send('token', { token });
            },
            onDone(result) {
              send('done', result);
            },
          });
        } catch (err) {
          send('error', { error: err.message });
        }
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
