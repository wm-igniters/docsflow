import { NextRequest } from 'next/server';
import { MongoService } from '@/lib/services/MongoService';
import { SSEService } from '@/lib/services/SSEService';
import { DocSchema } from '@/models/Doc';
import { DB_CONFIG } from '@/lib/config.mjs';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return SSEService.createResponse(req, async (send) => {
    const model = await MongoService.getModel(
      'Doc', 
      DocSchema, 
      DB_CONFIG.COLLECTIONS.RELEASE_NOTES
    );

    // Watch for changes and stream them to the client
    return MongoService.watch(
      model,
      (change) => {
        if (['insert', 'update', 'replace'].includes(change.operationType)) {
          send({
            type: change.operationType,
            path: change.fullDocument?._id,
            last_updated_by: change.fullDocument?.last_updated_by,
            timestamp: new Date().toISOString()
          });
        } else if (change.operationType === 'delete') {
          send({
            type: 'delete',
            path: change.documentKey._id,
            timestamp: new Date().toISOString()
          });
        }
      },
      { 
        timestampField: 'last_update_timestamp',
        pollingInterval: 5000 
      }
    );
  });
}
