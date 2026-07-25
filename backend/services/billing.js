/**
 * Token-metered packages. A company with no package_tier is "unmetered" —
 * grandfathered in with nothing enforced, since most existing companies
 * predate this system. Once a tier is set, CV scans and AI assistant
 * questions each cost 1 token from a one-time balance (never resets on a
 * schedule); PeopleQuest staff top it up manually when a client runs out.
 * login_limit is derived from the tier here, not stored, so changing a
 * company's tier immediately changes their seat cap without a migration.
 */
import { readTable } from "./store.js";
import { supabase } from "./supabaseClient.js";

export const PACKAGES = {
  basic: { tokens: 50, logins: 5 },
  intermediate: { tokens: 100, logins: 10 },
  pro: { tokens: 200, logins: 20 },
};

export function loginLimitFor(tier) {
  return PACKAGES[tier]?.logins ?? null;
}

export async function getCompanyBilling(companyId) {
  const company = (await readTable("companies")).find((c) => c.id === companyId);
  if (!company) return null;
  const tier = company.package_tier || null;
  return {
    tier,
    token_balance: company.token_balance ?? 0,
    login_limit: loginLimitFor(tier),
  };
}

/** Unmetered (no tier) always passes -- only a set tier with 0 balance blocks. */
export async function hasTokens(companyId) {
  const billing = await getCompanyBilling(companyId);
  if (!billing || !billing.tier) return true;
  return billing.token_balance > 0;
}

/** Call only after a scan/question actually succeeds -- failures shouldn't cost the client. */
export async function consumeToken(companyId) {
  const billing = await getCompanyBilling(companyId);
  if (!billing || !billing.tier) return; // unmetered, nothing to decrement
  const next = Math.max(0, billing.token_balance - 1);
  const { error } = await supabase.from("companies").update({ token_balance: next }).eq("id", companyId);
  if (error) throw new Error(`consumeToken: ${error.message}`);
}

/** Staff action: set/change a company's tier, resetting their balance to that package's full amount. */
export async function setCompanyPackage(companyId, tier) {
  if (!PACKAGES[tier]) throw new Error(`Unknown package tier: ${tier}`);
  const { error } = await supabase
    .from("companies")
    .update({ package_tier: tier, token_balance: PACKAGES[tier].tokens })
    .eq("id", companyId);
  if (error) throw new Error(`setCompanyPackage: ${error.message}`);
}

/** Staff action: add tokens to a company's existing balance (top-up after running out). */
export async function addTokens(companyId, amount) {
  const billing = await getCompanyBilling(companyId);
  if (!billing) throw new Error("Company not found.");
  const next = billing.token_balance + amount;
  const { error } = await supabase.from("companies").update({ token_balance: next }).eq("id", companyId);
  if (error) throw new Error(`addTokens: ${error.message}`);
  return next;
}

/** Total Level 1 + Level 2 logins a company currently has, for the login_limit check. */
export async function countCompanyUsers(companyId) {
  const users = await readTable("users");
  return users.filter((u) => u.company_id === companyId).length;
}

export async function atLoginLimit(companyId) {
  const billing = await getCompanyBilling(companyId);
  if (!billing || billing.login_limit == null) return false; // unmetered
  const count = await countCompanyUsers(companyId);
  return count >= billing.login_limit;
}
