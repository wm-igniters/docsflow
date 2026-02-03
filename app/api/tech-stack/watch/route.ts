import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import { DB_CONFIG } from '@/lib/config.mjs';
import { TechStackSchema } from '@/models/TechStack';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  let heartbeat: NodeJS.Timeout;

  const stream = new ReadableStream({
    async start(controller) {
      const conn = await connectDB(DB_CONFIG.DOCS_DB);
      const TechStackModel = conn.models.TechStack || conn.model('TechStack', TechStackSchema, DB_CONFIG.TECH_STACK_COLLECTION);

      const changeStream = TechStackModel.watch([], { fullDocument: 'updateLookup' });

      // Send initial connection message
      controller.enqueue(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

      // Keep-alive heartbeat every 30 seconds
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(': heartbeat\n\n');
        } catch (e) {
          clearInterval(heartbeat);
        }
      }, 30000);

      changeStream.on('change', (change) => {
        let payload: any = { type: change.operationType };

        if (change.operationType === 'insert' || change.operationType === 'update' || change.operationType === 'replace') {
          const doc = change.fullDocument;
          payload = {
            ...payload,
            version: doc.version,
            _id: doc._id,
            updatedAt: doc.updatedAt,
            updatedFields: change.updateDescription?.updatedFields || {},
            fullDocument: doc
          };
        }

        if (change.operationType === 'delete') {
          payload.documentKey = change.documentKey;
        }

        try {
          controller.enqueue(`data: ${JSON.stringify(payload)}\n\n`);
        } catch (e) {
          console.error("Failed to enqueue change to SSE stream", e);
        }
      });

      req.signal.onabort = () => {
        console.log("SSE Connection closed by client");
        clearInterval(heartbeat);
        changeStream.close();
      };
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
}

