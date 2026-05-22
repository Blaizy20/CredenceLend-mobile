import { S3Client } from '@aws-sdk/client-s3';

export const s3 = new S3Client({
  endpoint:   process.env.RAILWAY_S3_ENDPOINT,
  region:     process.env.RAILWAY_S3_REGION ?? 'auto',
  credentials: {
    accessKeyId:     process.env.RAILWAY_S3_ACCESS_KEY!,
    secretAccessKey: process.env.RAILWAY_S3_SECRET_KEY!,
  },
  forcePathStyle: false,
});

export const BUCKET = process.env.RAILWAY_S3_BUCKET!;
export { s3, BUCKET };