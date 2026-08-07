// Public, candidate-facing routes (see App.jsx) that need no HR login at
// all. Shared by AuthContext (skip the /me session check there entirely —
// it's pointless and was producing a false 401) and main.jsx's axios
// interceptor (never bounce one of these pages to /login on a 401).
const PUBLIC_PREFIXES = ["/apply/", "/assessment/", "/voice-screen/", "/interview-booking/", "/login"];

export function isPublicPath(pathname) {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}
