/**
 * CORS helper.
 *
 * The frontend is served from GitHub Pages (a different origin than the
 * Worker), so every response must carry CORS headers and preflight
 * (OPTIONS) requests must be answered directly.
 */

export function corsHeaders(env) {
  const origin = env.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

export function handlePreflight(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }
  return null;
}
