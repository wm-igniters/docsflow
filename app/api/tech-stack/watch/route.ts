import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import { DB_CONFIG } from '@/lib/config.mjs';
import { TechStackSchema } from '@/models/TechStack';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  let heartbeat: NodeJS.Timeout;
  let pollInterval: NodeJS.Timeout;

  console.log("SSE [GET]: New connection request received");

  const stream = new ReadableStream({
    async start(controller) {
      let isStreamClosed = false;

      const conn = await connectDB(DB_CONFIG.DB_NAMES.DOCS);
      const TechStackModel = conn.models.TechStack || conn.model('TechStack', TechStackSchema, DB_CONFIG.COLLECTIONS.TECH_STACK);

      let changeStream: any = null;
      let isPolling = false;

      function handleDataChange(change: any) {
        if (isStreamClosed) return;

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
          const msg = `data: ${JSON.stringify(payload)}\n\n`;
          controller.enqueue(msg);
        } catch (e) {
          console.error("SSE: Failed to enqueue change:", e);
          cleanup();
        }
      }

      function startPolling() {
        if (isPolling || isStreamClosed) return;
        isPolling = true;
        console.log("SSE: Falling back to MongoDB Polling...");
        
        let lastCheck = new Date();
        
        pollInterval = setInterval(async () => {
          if (isStreamClosed) return;
          
          try {
            const now = new Date();
            const updatedDocs = await TechStackModel.find({
              updatedAt: { $gt: lastCheck }
            }).sort({ updatedAt: 1 }).lean();

            if (updatedDocs.length > 0) {
              console.log(`SSE: Polling found ${updatedDocs.length} updates`);
              for (const doc of updatedDocs) {
                handleDataChange({
                  operationType: 'update',
                  fullDocument: doc,
                  updateDescription: { updatedFields: {} }
                });
              }
              // Update lastCheck to the latest doc's timestamp
              const maxTimestamp = new Date(Math.max(...updatedDocs.map((d: any) => new Date(d.updatedAt).getTime())));
              lastCheck = maxTimestamp;
            } else {
              // Sliding window to avoid missing updates exactly at lastCheck
              // but don't reset to 'now' if we didn't find anything, just keep lastCheck
              // unless it's way in the past? No, the query will eventually catch up.
            }
          } catch (e) {
            console.error("SSE: Polling query failed:", e);
          }
        }, 3000); // Poll every 3 seconds for better responsiveness in local
      }

      function cleanup() {
        if (isStreamClosed) return;
        isStreamClosed = true;
        console.log("SSE: Cleaning up connection");
        clearInterval(heartbeat);
        if (pollInterval) clearInterval(pollInterval);
        if (changeStream) {
          try {
            changeStream.close();
          } catch (e) {
             // Ignore
          }
        }
        try {
          controller.close();
        } catch (e) {
          // Ignore
        }
      }

      // Try Change Stream first
      try {
        console.log("SSE: Attempting to start MongoDB Change Stream...");
        changeStream = TechStackModel.watch([], { fullDocument: 'updateLookup' });
        
        changeStream.on('change', (change: any) => {
          handleDataChange(change);
        });

        changeStream.on('error', (err: any) => {
          console.warn("SSE: Change Stream error, falling back to polling:", err.message);
          startPolling();
        });
      } catch (e: any) {
        console.warn("SSE: Change Stream initialization failed, falling back to polling:", e.message);
        startPolling();
      }

      // Initial connection message
      try {
        controller.enqueue(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
      } catch (e) {
        cleanup();
        return;
      }

      // Heartbeat
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(': heartbeat\n\n');
        } catch (e) {
          cleanup();
        }
      }, 30000);

      req.signal.onabort = () => {
        console.log("SSE: Connection aborted by request signal");
        cleanup();
      };
    },
    cancel() {
      console.log("SSE: Stream canceled");
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

