/**
 * One-time migration: upload base64 event images to Supabase Storage
 * and replace the DB value with the public URL.
 *
 * Run from the backend directory:
 *   npx ts-node -r tsconfig-paths/register scripts/migrate-base64-images.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const STORAGE_BUCKET = 'event-images';

async function run() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!supabaseUrl || !serviceRoleKey || !databaseUrl) {
    throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DATABASE_URL in .env');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const pg = new Client({ connectionString: databaseUrl });
  await pg.connect();

  // Ensure the bucket exists (public so URLs work without auth)
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === STORAGE_BUCKET);
  if (!bucketExists) {
    const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, { public: true });
    if (error) throw new Error(`Failed to create bucket: ${error.message}`);
    console.log(`Created bucket: ${STORAGE_BUCKET}`);
  }

  // Fetch events with base64 images
  const { rows } = await pg.query<{ event_id: string; event_image: string }>(
    `SELECT event_id, event_image FROM public.events WHERE event_image LIKE 'data:image/%'`,
  );

  console.log(`Found ${rows.length} event(s) with base64 images.`);

  for (const row of rows) {
    const { event_id, event_image } = row;

    // Parse data URI: data:image/jpeg;base64,<data>
    const match = event_image.match(/^data:image\/(\w+);base64,(.+)$/s);
    if (!match) {
      console.warn(`  [${event_id}] Could not parse data URI, skipping.`);
      continue;
    }

    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    const filePath = `events/${event_id}.${ext}`;
    const mimeType = `image/${match[1]}`;

    console.log(`  [${event_id}] Uploading ${(buffer.length / 1024).toFixed(0)} KB as ${filePath}...`);

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error(`  [${event_id}] Upload failed: ${uploadError.message}`);
      continue;
    }

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    await pg.query(
      `UPDATE public.events SET event_image = $1 WHERE event_id = $2`,
      [publicUrl, event_id],
    );

    console.log(`  [${event_id}] Done → ${publicUrl}`);
  }

  await pg.end();
  console.log('\nMigration complete.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
