import { Model, Schema, QueryFilter, UpdateQuery } from 'mongoose';
import connectDB from '@/lib/db';
import { DB_CONFIG } from '@/lib/config.mjs';

export class MongoService {
  private static conn: any = null;

  private static async getConn(dbName: string = DB_CONFIG.DB_NAMES.DOCS) {
    if (!this.conn) {
      this.conn = await connectDB(dbName);
    }
    return this.conn;
  }

  /**
   * Get a generalized model
   */
  static async getModel<T>(modelName: string, schema: Schema, collectionName: string): Promise<Model<T>> {
    const conn = await this.getConn();
    return conn.models[modelName] || conn.model(modelName, schema, collectionName);
  }

  /**
   * Find a single document by ID
   */
  static async findById<T>(model: Model<T>, id: string) {
    return model.findById(id).lean();
  }

  /**
   * Upsert a document (Update or Insert)
   */
  static async upsert<T>(model: Model<T>, id: string, data: UpdateQuery<T>) {
    return model.findOneAndUpdate(
      { _id: id } as QueryFilter<T>,
      data,
      { upsert: true, new: true, lean: true }
    );
  }

  /**
   * Delete a document
   */
  static async delete<T>(model: Model<T>, id: string) {
    return model.deleteOne({ _id: id } as QueryFilter<T>);
  }

  /**
   * Generalized watch function with polling fallback
   */
  static async watch(
    model: Model<any>, 
    onData: (data: any) => void, 
    options: { pollingInterval?: number; filter?: any; timestampField?: string } = {}
  ) {
    let isClosed = false;
    let pollInterval: NodeJS.Timeout | null = null;
    let changeStream: any = null;

    const cleanup = () => {
      isClosed = true;
      if (pollInterval) clearInterval(pollInterval);
      if (changeStream) {
        try { changeStream.close(); } catch (e) {}
      }
    };

    try {
      changeStream = model.watch([], { fullDocument: 'updateLookup' });
      changeStream.on('change', (change: any) => {
        if (isClosed) return;
        onData(change);
      });
      changeStream.on('error', (err: any) => {
        this.startPolling(model, onData, options, (interval) => pollInterval = interval);
      });
    } catch (e: any) {
      this.startPolling(model, onData, options, (interval) => pollInterval = interval);
    }

    return cleanup;
  }

  private static startPolling(
    model: Model<any>, 
    onData: (data: any) => void, 
    options: { pollingInterval?: number; filter?: any; timestampField?: string } = {},
    setIntervalRef: (interval: NodeJS.Timeout) => void
  ) {
    let lastCheck = new Date();
    const tsField = options.timestampField || 'updatedAt';

    const interval = setInterval(async () => {
      try {
        const query = { [tsField]: { $gt: lastCheck }, ...(options.filter || {}) };
        const docs = await model.find(query).sort({ [tsField]: 1 }).lean();

        if (docs.length > 0) {
          docs.forEach(doc => {
            onData({ operationType: 'update', fullDocument: doc, documentKey: { _id: doc._id } });
          });
          const times = docs.map((d: any) => new Date(d[tsField]).getTime());
          lastCheck = new Date(Math.max(...times));
        }
      } catch (e) {
        console.error("MongoService: Polling failed", e);
      }
    }, options.pollingInterval || 5000);

    setIntervalRef(interval);
  }
}
