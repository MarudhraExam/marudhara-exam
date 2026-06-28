/**
 * generator.js
 * Static JSON Database Generator — Firebase-Free Result Storage
 *
 * Receives parsed student array from admin.js (parseExcel output).
 * Generates optimized sharded JSON files and bundles them into results.zip
 * for manual upload to GitHub static hosting.
 *
 * Architecture:
 *   results/
 *     metadata.json          — exam info + shard statistics
 *     roll/XX.json           — 100 shards (00–99), keyed by roll number (O(1) exact lookup)
 *     name/XX.json           — 2-letter prefix shards, array of lightweight index records
 *     father/XX.json         — 2-letter prefix shards, array of lightweight index records
 *
 * Scales to 1,000,000+ student records.
 * Each search loads only ONE shard file (~few KB), never the full database.
 */

// ─── JSZip: supports browser global, CDN ESM, or npm bundler ──────────────────
async function getJSZip() {
  if (typeof window !== 'undefined' && window.JSZip) return window.JSZip;
  try {
    const mod = await import('jszip');
    return mod.default || mod;
  } catch (_) {
    const cdnMod = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
    return cdnMod.default || cdnMod;
  }
}

// ─── Deterministic 2-digit bucket (00–99) for Roll Number sharding ────────────
// Uses polynomial rolling hash mod 100. Same function is mirrored in search.js.
export function getRollBucket(roll) {
  let hash = 0;
  const clean = String(roll || '').trim().toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) % 100;
  }
  return String(Math.abs(hash)).padStart(2, '0');
}

// ─── Extract 2-letter prefixes from a name for index shard routing ────────────
// "Chetan Chauhan" → ["ch"]     "Aarav Sharma" → ["aa", "sh"]
// Single-char words get an underscore appended: "A" → "a_"
export function getNamePrefixes(nameStr) {
  const clean = String(nameStr || '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = clean.split(/\s+/).filter(w => w.length > 0);
  const prefixes = new Set();
  for (const w of words) {
    prefixes.add(w.length === 1 ? w + '_' : w.slice(0, 2));
  }
  if (prefixes.size === 0) prefixes.add('__');
  return Array.from(prefixes);
}

/**
 * generateStaticDatabase
 * Builds all shard files and packages them into a downloadable ZIP.
 *
 * @param {Array}  students      - Array of student objects from parseExcel()
 * @param {Object} examMetadata  - { title, session } for metadata.json
 * @returns {Object} { metadata, filesMap, zipBlob, stats }
 *   filesMap — virtual in-memory map: "results/roll/62.json" → jsonString
 *              Stored on window.__VIRTUAL_SHARDS__ so search.js can preview immediately.
 *   zipBlob  — Blob ready for browser download as results.zip
 */
export async function generateStaticDatabase(students, examMetadata = {}) {
  const rollBuckets   = {};   // bucket → { rollNo: fullStudentObject }
  const nameIndexes   = {};   // prefix → [ lightweight index record ]
  const fatherIndexes = {};   // prefix → [ lightweight index record ]

  // ── 1. Shard every student record ──────────────────────────────────────────
  for (const s of students) {
    const roll = String(s.roll || s.rollNo || s.rollNumber || s.id || '').trim();
    if (!roll) continue; // skip records with no roll number

    const name   = String(s.name   || s.studentName   || s.candidateName || '').trim();
    const father = String(s.father || s.fatherName    || '').trim();
    const course = String(s.course || s.class || s.program || s.branch || '').trim();
    const result = String(s.result || s.status || s.division || 'PASS').trim();

    // Full record lives in roll shard (queried by exact roll → full result card)
    const rBucket = getRollBucket(roll);
    if (!rollBuckets[rBucket]) rollBuckets[rBucket] = {};
    rollBuckets[rBucket][roll] = s;

    // Lightweight index record (~60 bytes) for name/father prefix shards
    const idx = {
      r:   roll,
      n:   name   || 'Unknown Candidate',
      f:   father || 'Not Specified',
      c:   course || '',
      res: result
    };

    // Name prefix shards — student indexed under EVERY prefix of every word
    for (const p of getNamePrefixes(name)) {
      if (!nameIndexes[p]) nameIndexes[p] = [];
      nameIndexes[p].push(idx);
    }

    // Father name prefix shards
    for (const p of getNamePrefixes(father)) {
      if (!fatherIndexes[p]) fatherIndexes[p] = [];
      fatherIndexes[p].push(idx);
    }
  }

  // ── 2. Build metadata ───────────────────────────────────────────────────────
  const metadata = {
    title:        examMetadata.title   || 'Examination Results',
    session:      examMetadata.session || 'Annual Session',
    generatedAt:  new Date().toISOString(),
    totalStudents: students.length,
    storageArchitecture: 'Static Sharded JSON (GitHub Hosted — Firebase Free)',
    shardsCount: {
      roll:   Object.keys(rollBuckets).length,
      name:   Object.keys(nameIndexes).length,
      father: Object.keys(fatherIndexes).length
    }
  };

  // ── 3. Build virtual file map + ZIP archive ─────────────────────────────────
  const JSZip = await getJSZip();
  const zip   = new JSZip();
  const dir   = zip.folder('results');
  const filesMap = {};

  const addFile = (zipDir, filename, data) => {
    const str = JSON.stringify(data);
    zipDir.file(filename, str);
    filesMap[`results/${filename}`] = str;
  };

  // metadata.json
  addFile(dir, 'metadata.json', metadata);

  // roll/XX.json
  const rollDir = dir.folder('roll');
  for (const [bucket, data] of Object.entries(rollBuckets)) {
    addFile(rollDir, `${bucket}.json`, data);
    // Correct the filesMap key (addFile prepends "results/" but rollDir is "results/roll/")
    filesMap[`results/roll/${bucket}.json`] = JSON.stringify(data);
    delete filesMap[`results/roll/${bucket}.json`.replace('results/roll/', 'results/')];
  }

  // name/XX.json
  const nameDir = dir.folder('name');
  for (const [prefix, list] of Object.entries(nameIndexes)) {
    addFile(nameDir, `${prefix}.json`, list);
    filesMap[`results/name/${prefix}.json`] = JSON.stringify(list);
    delete filesMap[`results/name/${prefix}.json`.replace('results/name/', 'results/')];
  }

  // father/XX.json
  const fatherDir = dir.folder('father');
  for (const [prefix, list] of Object.entries(fatherIndexes)) {
    addFile(fatherDir, `${prefix}.json`, list);
    filesMap[`results/father/${prefix}.json`] = JSON.stringify(list);
    delete filesMap[`results/father/${prefix}.json`.replace('results/father/', 'results/')];
  }

  // Regenerate filesMap cleanly to avoid key collision from addFile helper
  const cleanFilesMap = {};
  cleanFilesMap['results/metadata.json'] = JSON.stringify(metadata);
  for (const [b, d] of Object.entries(rollBuckets))   cleanFilesMap[`results/roll/${b}.json`]    = JSON.stringify(d);
  for (const [p, l] of Object.entries(nameIndexes))   cleanFilesMap[`results/name/${p}.json`]    = JSON.stringify(l);
  for (const [p, l] of Object.entries(fatherIndexes)) cleanFilesMap[`results/father/${p}.json`]  = JSON.stringify(l);

  // Generate ZIP blob
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  return {
    metadata,
    filesMap: cleanFilesMap,
    zipBlob,
    stats: {
      totalRecords:  students.length,
      rollShards:    Object.keys(rollBuckets).length,
      nameShards:    Object.keys(nameIndexes).length,
      fatherShards:  Object.keys(fatherIndexes).length
    }
  };
}
