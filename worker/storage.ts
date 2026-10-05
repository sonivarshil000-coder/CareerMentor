import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const endpoint = process.env.S3_ENDPOINT ?? "http://localhost:9000";
const region = process.env.S3_REGION ?? "us-east-1";
const bucket = process.env.S3_BUCKET ?? "applydesk-private";

const client = new S3Client({
  endpoint,
  region,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "applydesk",
    secretAccessKey:
      process.env.S3_SECRET_KEY ?? "applydesk_dev_secret_change_me",
  },
});

export async function getPrivateObject(key: string): Promise<Buffer> {
  const result = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  if (!result.Body) {
    throw new Error("Stored file is missing.");
  }

  return Buffer.from(await result.Body.transformToByteArray());
}

export async function putPrivateObject(
  key: string,
  body: Buffer,
  metadata: Record<string, string> = {},
) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/octet-stream",
      Metadata: metadata,
    }),
  );
}

export async function deletePrivateObject(key: string) {
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}