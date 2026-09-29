import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export function assertLocalCustomerTarget(value) {
  const url = new URL(value);
  if (!['http://127.0.0.1:54321', 'http://localhost:54321'].includes(url.origin)
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('LOCAL_CUSTOMER_QA_REJECTED');
  }
  return url.origin;
}

export async function createLocalCustomerFixture({ supabaseUrl, publishableKey, secretKey, options }) {
  const origin = assertLocalCustomerTarget(supabaseUrl);
  if (!publishableKey || !secretKey) throw new Error('LOCAL_CUSTOMER_QA_CONFIGURATION_MISSING');
  const backend = createClient(origin, secretKey, options);
  const client = createClient(origin, publishableKey, options);
  const email = `customer-${randomUUID()}@qa.1968.local`;
  const password = `${randomBytes(32).toString('base64url')}Aa1!`;
  let userId;
  async function cleanup() {
    await client.auth.signOut();
    if (userId) {
      const { error } = await backend.auth.admin.deleteUser(userId);
      if (error) throw new Error('LOCAL_CUSTOMER_QA_CLEANUP_FAILED');
      const { data } = await backend.auth.admin.getUserById(userId);
      if (data?.user) throw new Error('LOCAL_CUSTOMER_QA_USER_REMAINS');
    }
    await client.removeAllChannels();
    await backend.removeAllChannels();
  }
  try {
    const created = await backend.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error('LOCAL_CUSTOMER_QA_CREATE_FAILED');
    userId = created.data.user.id;
    const signedIn = await client.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) throw new Error('LOCAL_CUSTOMER_QA_LOGIN_FAILED');
    const verified = await client.auth.getUser();
    const claims = await client.auth.getClaims();
    if (verified.error || verified.data.user?.id !== userId || claims.error || claims.data?.claims?.sub !== userId) {
      throw new Error('LOCAL_CUSTOMER_QA_VERIFICATION_FAILED');
    }
    return { client, userId, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
