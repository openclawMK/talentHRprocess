/**
 * Token-metered packages. A company with no package_tier is "unmetered" —
 * grandfathered in with nothing enforced, since most existing companies
 * predate this system. Once a tier is set, CV scans and AI assistant
 * questions draw from SEPARATE one-time balances (never reset on a
 * schedule) — a client burning through assistant questions can't starve
 * their own CV-scan quota, or vice versa. PeopleQuest staff tops up
 * manually when a client runs out. login_limit is derived from the tier
 * here, not stored, so changing a company's tier immediately changes
 * their seat cap without a migration.
 */
import { readTable } from "./store.js";
import { supabase } from "./supabaseClient.js";

export const PACKAGES = {
  basic: { cv: 50, assistant: 100, logins: 5 },
  intermediate: { cv: 100, assistant: 200, logins: 10 },
  pro: { cv: 200, assistant: 500, logins: 20 },
};

const BALANCE_COL = { cv: "cv_token_balance", assistant: "assistant_token_balance" };

export function loginLimitFor(tier) {
  return PACKAGES[tier]?.logins ?? null;
}

export async function getCompanyBilling(companyId) {
  const company = (await readTable("companies")).find((c) => c.id === companyId);
  if (!company) return null;
  const tier = company.package_tier || null;
  return {
    tier,
    cv_token_balance: company.cv_token_balance ?? 0,
    assistant_token_balance: company.assistant_token_balance ?? 0,
    login_limit: loginLimitFor(tier),
  };
}

/** Unmetered (no tier) always passes -- only a set tier with 0 in that pool blocks. */
export async function hasTokens(companyId, kind) {
  const billing = await getCompanyBilling(companyId);
  if (!billing || !billing.tier) return true;
  return billing[BALANCE_COL[kind]] > 0;
}

/** Call only after a scan/question actually succeeds -- failures shouldn't cost the client. */
export async function consumeToken(companyId, kind) {
  const billing = await getCompanyBilling(companyId);
  if (!billing || !billing.tier) return; // unmetered, nothing to decrement
  const col = BALANCE_COL[kind];
  const next = Math.max(0, billing[col] - 1);
  const { error } = await supabase.from("companies").update({ [col]: next }).eq("id", companyId);
  if (error) throw new Error(`consumeToken: ${error.message}`);
}

/** Staff action: set/change a company's tier, resetting both balances to that package's full amounts. */
export async function setCompanyPackage(companyId, tier) {
  if (!PACKAGES[tier]) throw new Error(`Unknown package tier: ${tier}`);
  const { error } = await supabase
    .from("companies")
    .update({ package_tier: tier, cv_token_balance: PACKAGES[tier].cv, assistant_token_balance: PACKAGES[tier].assistant })
    .eq("id", companyId);
  if (error) throw new Error(`setCompanyPackage: ${error.message}`);
}

/** Staff action: add tokens to one of a company's two balances (top-up after running out). */
export async function addTokens(companyId, kind, amount) {
  const billing = await getCompanyBilling(companyId);
  if (!billing) throw new Error("Company not found.");
  const col = BALANCE_COL[kind];
  const next = billing[col] + amount;
  const { error } = await supabase.from("companies").update({ [col]: next }).eq("id", companyId);
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
