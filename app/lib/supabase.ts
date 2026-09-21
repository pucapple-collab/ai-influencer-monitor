import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && publishableKey);

// Preview builds should compile even before Vercel environment variables are wired.
// The placeholder client cannot reach a real project and never contains credentials.
export const supabase = createClient(
  url || "https://preview-not-configured.invalid",
  publishableKey || "preview-not-configured"
);
