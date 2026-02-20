import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import { DB_CONFIG } from '@/lib/config.mjs';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Initial connection event
      sendEvent({ type: 'connected', timestamp: new Date().toISOString() });

      try {
        const conn = await connectDB(DB_CONFIG.DB_NAMES.DOCS);
        const collection = conn.collection(DB_CONFIG.COLLECTIONS.RELEASE_NOTES);
        
        // Use MongoDB Change Stream
        const changeStream = collection.watch([], { fullDocument: 'updateLookup' });

        changeStream.on('change', (change) => {
          if (change.operationType === 'insert' || change.operationType === 'update' || change.operationType === 'replace') {
            const doc = change.fullDocument;
            sendEvent({
              type: change.operationType,
              path: doc?._id,
              last_updated_by: doc?.last_updated_by,
              timestamp: new Date().toISOString()
            });
          } else if (change.operationType === 'delete') {
            sendEvent({
              type: 'delete',
              path: change.documentKey._id,
              timestamp: new Date().toISOString()
            });
          }
        });

        // Keep-alive every 30 seconds
        const keepAlive = setInterval(() => {
          sendEvent({ type: 'ping' });
        }, 30000);

        req.signal.addEventListener('abort', () => {
          console.log("SSE: Closing change stream for Release Notes");
          clearInterval(keepAlive);
          changeStream.close();
          controller.close();
        });

      } catch (err) {
        console.error("SSE: Error in change stream", err);
        controller.error(err);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
