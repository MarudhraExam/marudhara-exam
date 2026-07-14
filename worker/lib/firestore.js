/**
 * Minimal Firestore REST API client used server-side by this Worker.
 *
 * All requests are authenticated with a Google service-account OAuth2
 * access token (see googleAuth.js) — never with a client-side API key —
 * so payment and unlock writes cannot be forged from the browser and are
 * not bound by (nor a substitute for) Firestore Security Rules used by
 * the frontend's own client-side reads.
 */

import { getGoogleAccessToken } from './googleAuth.js';

function documentsBaseUrl(env) {
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
}

function documentFullName(env, collection, docId) {
  return `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
}

async function authedFetch(env, url, options = {}) {
  const accessToken = await getGoogleAccessToken(env);
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {})
    }
  });
  return res;
}

// ---------------------------------------------------------------------------
// Value conversion: plain JS object <-> Firestore REST "Value" wire format
// ---------------------------------------------------------------------------

export function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: toFirestoreFields(value) } };
  }
  throw new Error(`Unsupported Firestore value type: ${typeof value}`);
}

export function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    fields[key] = toFirestoreValue(value);
  }
  return fields;
}

export function fromFirestoreValue(value) {
  if (!value) return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return parseInt(value.integerValue, 10);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in value) return fromFirestoreFields(value.mapValue.fields || {});
  return null;
}

export function fromFirestoreFields(fields = {}) {
  const obj = {};
  for (const [key, value] of Object.entries(fields)) {
    obj[key] = fromFirestoreValue(value);
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Simple (non-transactional) document operations
// ---------------------------------------------------------------------------

/** Reads a single document. Returns null if it does not exist. */
export async function getDocument(env, collection, docId) {
  const res = await authedFetch(env, `${documentsBaseUrl(env)}/${collection}/${docId}`, {
    method: 'GET'
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore getDocument failed (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return fromFirestoreFields(data.fields || {});
}

/**
 * Creates or fully overwrites a document (equivalent to client SDK `set`).
 */
export async function setDocument(env, collection, docId, fields) {
  const res = await authedFetch(env, `${documentsBaseUrl(env)}/${collection}/${docId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: toFirestoreFields(fields) })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore setDocument failed (${res.status}): ${errText}`);
  }
  return res.json();
}

/**
 * Partially updates a document, only touching the given top-level field
 * names (equivalent to client SDK `update` with dot-free field paths).
 */
export async function patchDocument(env, collection, docId, fields) {
  const mask = Object.keys(fields).map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `${documentsBaseUrl(env)}/${collection}/${docId}?${mask}`;
  const res = await authedFetch(env, url, {
    method: 'PATCH',
    body: JSON.stringify({ fields: toFirestoreFields(fields) })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore patchDocument failed (${res.status}): ${errText}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Transactions — used wherever a read-then-write must be atomic
// (crediting a purchase, decrementing/consuming a credit on unlock).
// ---------------------------------------------------------------------------

async function beginTransaction(env) {
  const res = await authedFetch(env, `${documentsBaseUrl(env)}:beginTransaction`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore beginTransaction failed (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.transaction;
}

async function transactionalGet(env, transaction, collection, docId) {
  const res = await authedFetch(env, `${documentsBaseUrl(env)}:batchGet`, {
    method: 'POST',
    body: JSON.stringify({
      documents: [documentFullName(env, collection, docId)],
      transaction
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore batchGet failed (${res.status}): ${errText}`);
  }
  const results = await res.json();
  const entry = results[0];
  if (!entry || !entry.found) return null;
  return fromFirestoreFields(entry.found.fields || {});
}

async function commitTransaction(env, transaction, writes) {
  const res = await authedFetch(env, `${documentsBaseUrl(env)}:commit`, {
    method: 'POST',
    body: JSON.stringify({ writes, transaction })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore commit failed (${res.status}): ${errText}`);
  }
  return res.json();
}

async function rollbackTransaction(env, transaction) {
  try {
    await authedFetch(env, `${documentsBaseUrl(env)}:rollback`, {
      method: 'POST',
      body: JSON.stringify({ transaction })
    });
  } catch {
    // Best-effort only; Firestore also expires unused transactions on its own.
  }
}

/**
 * Runs a single-document read-modify-write transaction.
 *
 * `mutate(currentDoc)` receives the current document (or null if it does
 * not exist yet) and must return either:
 *   - `{ fields }`            -> full-document overwrite (set semantics)
 *   - `{ fields, mask }`      -> merge only the given field names
 *   - `null`                  -> abort with no write (e.g. nothing to do)
 *
 * Returns whatever `mutate` returned, plus the resolved document fields
 * actually persisted (or the unchanged current doc if `mutate` returned null).
 */
export async function runDocumentTransaction(env, collection, docId, mutate) {
  const transaction = await beginTransaction(env);
  const current = await transactionalGet(env, transaction, collection, docId);
  const outcome = await mutate(current);

  if (!outcome) {
    await rollbackTransaction(env, transaction);
    return { committed: false, document: current };
  }

  const write = {
    update: {
      name: documentFullName(env, collection, docId),
      fields: toFirestoreFields(outcome.fields)
    }
  };
  if (outcome.mask) {
    write.updateMask = { fieldPaths: outcome.mask };
  }

  await commitTransaction(env, transaction, [write]);
  return { committed: true, document: outcome.fields };
}
/**
 * Query documents by a single field value.
 * Returns plain JS objects with document id included as `id`.
 */
export async function queryDocumentsByField(env, collection, fieldName, value) {
  const accessToken = await getGoogleAccessToken(env);

  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;

  const firestoreValue =
    typeof value === 'string'
      ? { stringValue: value }
      : typeof value === 'boolean'
      ? { booleanValue: value }
      : Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };

  const body = {
    structuredQuery: {
      from: [
        {
          collectionId: collection
        }
      ],
      where: {
        fieldFilter: {
          field: {
            fieldPath: fieldName
          },
          op: 'EQUAL',
          value: firestoreValue
        }
      }
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore query failed (${res.status}): ${err}`);
  }

  const rows = await res.json();

  return rows
    .filter(r => r.document)
    .map(r => {
      const doc = r.document;
      return {
        id: doc.name.split('/').pop(),
        ...fromFirestoreFields(doc.fields || {})
      };
    });
}
