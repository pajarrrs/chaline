import { createClient } from "@supabase/supabase-js";

let rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (rawUrl) {
  rawUrl = rawUrl.replace(/\/rest\/v1\/?$/, "");
  if (rawUrl.endsWith("/")) rawUrl = rawUrl.slice(0, -1);
}

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase =
  rawUrl && supabaseAnonKey
    ? createClient(rawUrl, supabaseAnonKey, {
        realtime: {
          params: {
            eventsPerSecond: 20,
          },
        },
      })
    : null;
