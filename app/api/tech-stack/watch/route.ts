import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import { DB_CONFIG } from '@/lib/config.mjs';
import { TechStackSchema } from '@/models/TechStack';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const conn = await connectDB(DB_CONFIG.DOCS_DB);
      // We need a model to watch. Using a schema and the collection name.
      const TechStackModel = conn.models.TechStack || conn.model('TechStack', TechStackSchema, DB_CONFIG.TECH_STACK_COLLECTION);

      const changeStream = TechStackModel.watch([], { fullDocument: 'updateLookup' });

      controller.enqueue(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

      changeStream.on('change', (change) => {
        let payload: any = { type: change.operationType };

        if (change.operationType === 'insert' || change.operationType === 'update' || change.operationType === 'replace') {
          const doc = change.fullDocument;
          payload = {
            ...payload,
            version: doc.version,
            _id: doc._id,
            // Only send metadata/version unless specifically needed to keep SSE light
            updatedAt: doc.updatedAt,
          };
        }

        if (change.operationType === 'delete') {
          payload.documentKey = change.documentKey;
        }

        controller.enqueue(`data: ${JSON.stringify(payload)}\n\n`);
      });

      req.signal.onabort = () => {
        changeStream.close();
      };
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
