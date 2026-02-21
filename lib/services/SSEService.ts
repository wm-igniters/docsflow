import { NextRequest } from "next/server";

export class SSEService {
  /**
   * Creates a standardized SSE Response
   * @param req The NextRequest to listen for abort signals
   * @param onStart Callback where you set up your listeners (e.g. Mongo watch)
   */
  static createResponse(
    req: NextRequest,
    onStart: (send: (data: any) => void) => Promise<() => void> | (() => void)
  ) {
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          try {
            const message = typeof data === 'string' && data.startsWith(':') 
              ? `${data}\n\n` 
              : `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));
          } catch (e) {
            // Stream might be closed
          }
        };

        // Initial connection
        send({ type: 'connected', timestamp: new Date().toISOString() });

        // Execute the user's logic and get a cleanup function
        const cleanupLogic = await onStart(send);

        // Keep-alive heartbeat every 30s
        const pingInterval = setInterval(() => send(': ping'), 30000);

        req.signal.addEventListener('abort', () => {
          clearInterval(pingInterval);
          cleanupLogic();
          try { controller.close(); } catch (e) {}
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable buffering for Nginx/Vercel
      },
    });
  }
}
