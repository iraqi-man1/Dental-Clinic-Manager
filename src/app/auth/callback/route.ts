import { ensureClinicMembership } from "@/lib/clinic-bootstrap";
import { safeInternalPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Builds a 307 redirect with a relative Location, so the browser stays on the host it used (for example
 * 127.0.0.1 rather than localhost). The request URL can show an internal host behind a proxy, so only the
 * path, query and hash are kept. The URL parser percent-encodes non-ASCII characters, which a header cannot
 * carry. The result is validated again because dot segments can turn "/.//host" into "//host", which
 * browsers read as another origin.
 */
function redirectTo(request: Request, path: string) {
  const target = new URL(path, request.url);
  const location = safeInternalPath(`${target.pathname}${target.search}${target.hash}`, "/");
  return new Response(null, { status: 307, headers: { Location: location } });
}

function loginRedirect(request: Request, error: string) {
  return redirectTo(request, `/login?${new URLSearchParams({ error }).toString()}`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeInternalPath(url.searchParams.get("next"), "/");

  if (!code) return loginRedirect(request, "auth_failed");

  const supabase = await createClient();
  if (!supabase) return loginRedirect(request, "auth_failed");

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return loginRedirect(request, "auth_failed");

  const membership = await ensureClinicMembership(supabase, data.user);
  if (!membership.ok) return loginRedirect(request, membership.error);

  return redirectTo(request, next);
}
