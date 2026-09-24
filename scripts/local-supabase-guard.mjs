export function assertLocalSupabaseTarget(rawUrl, label = "Supabase") {
  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new Error(`${label} URL is invalid; refusing to run local QA fixtures.`);
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!localHosts.has(target.hostname)) {
    throw new Error(`${label} target must be local; refusing ${target.origin}.`);
  }

  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error("Local QA fixtures cannot run in a production or Vercel environment.");
  }

  return target;
}
