import { NextRequest } from 'next/server';
import { MongoService } from '@/lib/services/MongoService';
import { SSEService } from '@/lib/services/SSEService';
import { DocSchema } from '@/models/Doc';
import { DocTreeSchema } from '@/models/DocTree';
import { DB_CONFIG } from '@/lib/config.mjs';

export const dynamic = 'force-dynamic';

const ALLOWED_COLLECTIONS = new Set(Object.values(DB_CONFIG.COLLECTIONS));

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const docId = searchParams.get('docId')?.trim() || '';
  const docCollection = searchParams.get('docCollection')?.trim() || DB_CONFIG.COLLECTIONS.RELEASE_NOTES;
  const treeId = searchParams.get('treeId')?.trim() || '';

  if (!ALLOWED_COLLECTIONS.has(docCollection)) {
    return new Response('Invalid collection', { status: 400 });
  }

  return SSEService.createResponse(req, async (send) => {
    const cleanups: Array<() => void> = [];

    if (docId) {
      const docModel = await MongoService.getModel(
        'Doc',
        DocSchema,
        docCollection
      );

      const cleanup = await MongoService.watch(
        docModel,
        (change) => {
          if (['insert', 'update', 'replace'].includes(change.operationType)) {
            send({
              stream: 'doc',
              type: change.operationType,
              path: change.fullDocument?._id,
              last_updated_by: change.fullDocument?.last_updated_by,
              timestamp: new Date().toISOString(),
            });
          } else if (change.operationType === 'delete') {
            send({
              stream: 'doc',
              type: 'delete',
              path: change.documentKey?._id,
              timestamp: new Date().toISOString(),
            });
          }
        },
        {
          timestampField: 'last_update_timestamp',
          pollingInterval: 5000,
          changeStreamMatch: { 'documentKey._id': docId },
          filter: { _id: docId },
        }
      );
      cleanups.push(cleanup);
    }

    if (treeId) {
      const treeModel = await MongoService.getModel(
        'DocTree',
        DocTreeSchema,
        DB_CONFIG.COLLECTIONS.DOC_TREES
      );

      const cleanup = await MongoService.watch(
        treeModel,
        (change) => {
          if (['insert', 'update', 'replace', 'delete'].includes(change.operationType)) {
            send({
              stream: 'tree',
              type: change.operationType,
              path: change.fullDocument?._id ?? change.documentKey?._id,
              timestamp: new Date().toISOString(),
            });
          }
        },
        {
          timestampField: 'last_update_timestamp',
          pollingInterval: 5000,
          changeStreamMatch: { 'documentKey._id': treeId },
          filter: { _id: treeId },
        }
      );
      cleanups.push(cleanup);
    }

    return () => {
      cleanups.forEach((fn) => fn());
    };
  });
}
