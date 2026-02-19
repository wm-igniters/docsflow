import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand, 
  ListObjectsV2Command, 
  HeadObjectCommand,
  CopyObjectCommand
} from "@aws-sdk/client-s3";
import crypto from "crypto";
import { Readable } from "stream";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET!;

export interface UploadObjectProps {
  body: Buffer | string | Readable | Uint8Array;
  id?: string;
  contentType?: string;
  additionalMetadata?: Record<string, string>;
  overwritePush?: boolean;
}

export interface S3ObjectMetadata {
  key: string;
  size?: number;
  lastModified?: Date;
  contentType?: string;
  metadata?: Record<string, string>;
}

/**
 * Uploads an object to S3.
 * If overwritePush is false, it checks if the object already exists.
 * If id is not provided, a UUID is generated.
 */
export async function uploadObject({
  body,
  id,
  contentType,
  additionalMetadata,
  overwritePush = true,
}: UploadObjectProps): Promise<{ key: string; url: string }> {
  const key = id || crypto.randomUUID();

  if (!overwritePush) {
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
      throw new Error(`Object with id ${key} already exists and overwritePush is false.`);
    } catch (error: any) {
      if (error.name !== "NotFound") {
        throw error;
      }
    }
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    Metadata: additionalMetadata,
  });

  await s3Client.send(command);
  
  return {
    key,
    url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
  };
}

/**
 * Checks if an object exists in S3.
 */
export async function existsObject(key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    return true;
  } catch (error: any) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Retrieves an object from S3.
 * Returns the stream body.
 */
export async function getObject(key: string): Promise<Readable | any> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);
  return response.Body;
}

/**
 * Helper to convert S3 stream to string.
 */
export async function getObjectAsString(key: string): Promise<string> {
  const body = await getObject(key);
  if (body instanceof Readable) {
    const chunks = [];
    for await (const chunk of body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf-8");
  }
  return body.toString();
}

/**
 * Deletes an object from S3.
 */
export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Lists all objects in the bucket.
 */
export async function listAllObjects(): Promise<S3ObjectMetadata[]> {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
  });

  const response = await s3Client.send(command);
  return (response.Contents || []).map((obj) => ({
    key: obj.Key!,
    size: obj.Size,
    lastModified: obj.LastModified,
  }));
}

/**
 * Lists objects starting with a specific prefix.
 */
export async function listObjectsWithPrefix(prefix: string): Promise<S3ObjectMetadata[]> {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
  });

  const response = await s3Client.send(command);
  return (response.Contents || []).map((obj) => ({
    key: obj.Key!,
    size: obj.Size,
    lastModified: obj.LastModified,
  }));
}

/**
 * Retrieves multiple objects by a list of keys.
 */
export async function getObjectsByKeys(keys: string[]): Promise<any[]> {
  const promises = keys.map((key) => getObject(key));
  return Promise.all(promises);
}

/**
 * Returns metadata for objects in the bucket.
 */
export async function getObjectsMetadata(prefix?: string): Promise<S3ObjectMetadata[]> {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
  });

  const response = await s3Client.send(command);
  const objects = response.Contents || [];

  const metadataPromises = objects.map(async (obj) => {
    const headCommand = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: obj.Key!,
    });
    const headResponse = await s3Client.send(headCommand);
    
    return {
      key: obj.Key!,
      size: obj.Size,
      lastModified: obj.LastModified,
      contentType: headResponse.ContentType,
      metadata: headResponse.Metadata,
    };
  });

  return Promise.all(metadataPromises);
}

/**
 * Copies an object within the bucket.
 */
export async function copyObject(sourceKey: string, destinationKey: string): Promise<void> {
  const command = new CopyObjectCommand({
    Bucket: BUCKET_NAME,
    CopySource: `${BUCKET_NAME}/${sourceKey}`,
    Key: destinationKey,
  });

  await s3Client.send(command);
}

/**
 * Moves an object by copying it and then deleting the source.
 */
export async function moveObject(sourceKey: string, destinationKey: string): Promise<void> {
  await copyObject(sourceKey, destinationKey);
  await deleteObject(sourceKey);
}

/**
 * Gets the public URL for an object.
 */
export function getObjectUrl(key: string): string {
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}


