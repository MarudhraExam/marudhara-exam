import { corsHeaders } from './cors.js';

/** Build a JSON response with CORS + standard headers. */
export function json(env, body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(env),
      ...extraHeaders
    }
  });
}

export function errorResponse(env, status, code, message) {
  return json(env, { success: false, error: { code, message } }, status);
}
