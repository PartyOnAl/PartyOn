// Supabase Edge Function: send-push
//
// Sends Expo Push notifications when rows are inserted into `public.notifications`.
//
// Deployment:
//   1. supabase functions deploy send-push --no-verify-jwt
//   2. Add the function as a Database Webhook on `public.notifications` insert:
//        Settings -> Database -> Webhooks -> Create new
//        Table: notifications, Events: Insert
//        Type: HTTP Request
//        URL: https://<project-ref>.supabase.co/functions/v1/send-push
//        HTTP Headers: x-webhook-secret: <set SEND_PUSH_SECRET below to match>
//   3. Set function secrets:
//        supabase secrets set SEND_PUSH_SECRET=<random-string>
//        supabase secrets set SERVICE_ROLE_KEY=<service role key>   (optional, see notes)
//
// The function reads push_tokens for the recipient and posts to Expo's push
// service. If no push tokens exist, the in-app inbox still works -- this just
// no-ops gracefully.

// deno-lint-ignore-file no-explicit-any
// @ts-nocheck - Deno runtime, not Node.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1"

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

const SUPABASE_URL       = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE_KEY   = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const SEND_PUSH_SECRET   = Deno.env.get("SEND_PUSH_SECRET") ?? ""

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE"
  table: string
  schema: string
  record: {
    id: string
    recipient_profile_id: string
    type: string
    title: string
    body: string | null
    data: Record<string, any> | null
    read_at: string | null
    created_at: string
  } | null
  old_record: any
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  if (SEND_PUSH_SECRET) {
    const incoming = req.headers.get("x-webhook-secret") ?? ""
    if (incoming !== SEND_PUSH_SECRET) {
      return new Response("Unauthorized", { status: 401 })
    }
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response("Bad JSON", { status: 400 })
  }

  if (payload.type !== "INSERT" || payload.table !== "notifications" || !payload.record) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { "content-type": "application/json" } })
  }

  const n = payload.record

  const { data: tokens, error: tokensErr } = await supabase
    .from("push_tokens")
    .select("expo_token")
    .eq("profile_id", n.recipient_profile_id)

  if (tokensErr) {
    console.error("push_tokens lookup failed:", tokensErr.message)
    return new Response("token lookup failed", { status: 500 })
  }

  const expoTokens = (tokens ?? [])
    .map(t => t.expo_token)
    .filter((t: string) => typeof t === "string" && t.startsWith("ExponentPushToken"))

  if (expoTokens.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { "content-type": "application/json" } })
  }

  const messages = expoTokens.map(to => ({
    to,
    sound: "default",
    title: n.title,
    body: n.body ?? "",
    data: { notification_id: n.id, type: n.type, ...(n.data ?? {}) },
    priority: "high",
    channelId: "default",
  }))

  const responses: any[] = []
  for (const batch of chunk(messages, 100)) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
          "accept-encoding": "gzip, deflate",
        },
        body: JSON.stringify(batch),
      })
      const json = await res.json().catch(() => null)
      responses.push({ status: res.status, body: json })

      // Clean up DeviceNotRegistered tickets so we don't keep retrying dead tokens.
      const tickets: any[] = Array.isArray(json?.data) ? json.data : []
      const deadTokens: string[] = []
      tickets.forEach((ticket, i) => {
        if (ticket?.status === "error" && ticket?.details?.error === "DeviceNotRegistered") {
          deadTokens.push(batch[i].to)
        }
      })
      if (deadTokens.length > 0) {
        await supabase.from("push_tokens").delete().in("expo_token", deadTokens)
      }
    } catch (err) {
      console.error("Expo push failed:", err)
      responses.push({ error: String(err) })
    }
  }

  return new Response(
    JSON.stringify({ ok: true, sent: expoTokens.length, responses }),
    { headers: { "content-type": "application/json" } },
  )
})
