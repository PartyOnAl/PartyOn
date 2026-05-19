# `send-push` Edge Function

Sends Expo Push notifications when a row is inserted into `public.notifications`.

## Deploy

```bash
# 1. From the repo root
supabase functions deploy send-push --no-verify-jwt

# 2. Set secrets (the function uses these at runtime)
supabase secrets set SEND_PUSH_SECRET="$(openssl rand -hex 32)"
# SERVICE_ROLE_KEY is auto-populated as SUPABASE_SERVICE_ROLE_KEY in hosted
# Edge Functions, but you can also set it explicitly:
# supabase secrets set SERVICE_ROLE_KEY=<service role key>
```

## Wire up the Database Webhook

In the Supabase dashboard:

1. Database -> Webhooks -> **Create a new hook**
2. Name: `notifications-insert -> send-push`
3. Table: `public.notifications`
4. Events: **Insert**
5. Type: **HTTP Request** -> **POST**
6. URL: `https://<project-ref>.supabase.co/functions/v1/send-push`
7. HTTP Headers:
   - `Content-Type: application/json`
   - `x-webhook-secret: <same value you set as SEND_PUSH_SECRET above>`

That's it. Inserts into `notifications` (from triggers or manually) will now
fan out to every Expo push token registered for the recipient profile.

## Behaviour

- No tokens registered for the recipient -> the function returns `{ ok: true, sent: 0 }` and does nothing (the in-app inbox is unaffected).
- Expo returns `DeviceNotRegistered` for a token -> that row is deleted from `push_tokens` so we don't keep retrying.
- Payload `data` includes `notification_id`, `type`, and the original `data` jsonb so the client can deep-link on tap.
