require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const STORAGE_BUCKET = 'event-images';

async function run() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!supabaseUrl || !serviceRoleKey || !databaseUrl) {
    throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DATABASE_URL in .env');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const pg = new Client({ connectionString: databaseUrl, statement_timeout: 120000 });

  console.log('Connecting to database...');
  await pg.connect();
  console.log('Connected.');

  // Ensure the bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === STORAGE_BUCKET);
  if (!bucketExists) {
    const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, { public: true });
    if (error) throw new Error(`Failed to create bucket: ${error.message}`);
    console.log(`Created bucket: ${STORAGE_BUCKET}`);
  } else {
    console.log(`Bucket "${STORAGE_BUCKET}" already exists.`);
  }

  // Fetch just the IDs first
  console.log('Fetching event IDs with base64 images...');
  const { rows: idRows } = await pg.query(
    `SELECT event_id FROM public.events WHERE event_image LIKE 'data:image/%'`,
  );
  console.log(`Found ${idRows.length} event(s) to migrate.`);

  for (const { event_id } of idRows) {
    console.log(`\n[${event_id}] Fetching image...`);

    // Fetch one at a time to avoid memory issues
    const { rows } = await pg.query(
      `SELECT event_image FROM public.events WHERE event_id = $1`,
      [event_id],
    );

    const event_image = rows[0]?.event_image;
    if (!event_image) {
      console.warn(`[${event_id}] No image found, skipping.`);
      continue;
    }

    const match = event_image.match(/^data:image\/(\w+);base64,(.+)$/s);
    if (!match) {
      console.warn(`[${event_id}] Could not parse data URI, skipping.`);
      continue;
    }

    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    const filePath = `events/${event_id}.${ext}`;
    const mimeType = `image/${match[1]}`;

    console.log(`[${event_id}] Uploading ${(buffer.length / 1024).toFixed(0)} KB...`);

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error(`[${event_id}] Upload failed: ${uploadError.message}`);
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

    console.log(`[${event_id}] Done → ${publicUrl}`);
  }

  await pg.end();
  console.log('\nMigration complete!');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
