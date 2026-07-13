import { json, errorResponse } from '../lib/response.js';
import { isValidDocId } from '../lib/validate.js';
import { getDocument } from '../lib/firestore.js';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

/**
 * GET /api/download-question-paper?mockId=<mockTests docId>&attemptId=<mockResults docId>
 *
 * Secure Question Paper PDF download.
 * --------------------------------------------------------------------
 * The Student Result page's existing "Download Question Paper" button
 * calls this endpoint instead of ever touching the admin-configured
 * GitHub PDF link directly. This endpoint is the ONLY place that reads
 * a mock's `pdfLink` field from Firestore — the browser never receives
 * `pdfLink`, only ever this URL.
 *
 * Flow:
 *   1. Verify the attempt (mockResults doc) exists and belongs to mockId.
 *   2. Read the student's name + mobile from that attempt.
 *   3. Read the mock's `pdfLink` from Firestore (mockTests doc).
 *   4. Fetch the original PDF from GitHub.
 *   5. Stamp a light, repeating, semi-transparent watermark with the
 *      student's name/mobile onto every page (pdf-lib — pure JS, no
 *      Node APIs, works fine inside the Workers runtime).
 *   6. Stream the watermarked PDF back as the response body.
 *
 * If the mock has no `pdfLink` configured, this returns 404 with code
 * 'NO_PDF_LINK' so the frontend can fall back to its existing
 * print-based question paper generator without breaking anything for
 * mocks that were never given a PDF link.
 */
export async function handleDownloadQuestionPaper(request, env) {
  const url = new URL(request.url);
  const mockId = url.searchParams.get('mockId');
  const attemptId = url.searchParams.get('attemptId') || url.searchParams.get('resultId');

  if (!isValidDocId(mockId)) {
    return errorResponse(env, 400, 'INVALID_MOCK_ID', 'A valid mockId query parameter is required.');
  }
  if (!isValidDocId(attemptId)) {
    return errorResponse(env, 400, 'INVALID_ATTEMPT_ID', 'A valid attemptId (or resultId) query parameter is required.');
  }

  // 1 & 2: Verify the attempt exists and read the student's identity from it.
  let attempt;
  try {
    attempt = await getDocument(env, 'mockResults', attemptId);
  } catch (err) {
    console.error('download-question-paper: attempt lookup failed:', err.message);
    return errorResponse(env, 502, 'LOOKUP_FAILED', 'Unable to verify this attempt right now.');
  }
  if (!attempt) {
    return errorResponse(env, 404, 'ATTEMPT_NOT_FOUND', 'No exam attempt was found for the given attemptId.');
  }
  if (attempt.mockId !== mockId) {
    return errorResponse(env, 400, 'MOCK_MISMATCH', 'This attempt does not belong to the given mockId.');
  }

  const studentName = (attempt.name || attempt.studentName || 'Student').toString();
  const studentMobile = (attempt.mobile || attempt.studentId || '').toString();

  // 3: Read the mock's pdfLink. Never sent to the frontend — read here only.
  let mock;
  try {
    mock = await getDocument(env, 'mockTests', mockId);
  } catch (err) {
    console.error('download-question-paper: mock lookup failed:', err.message);
    return errorResponse(env, 502, 'LOOKUP_FAILED', 'Unable to load this mock test right now.');
  }
  if (!mock) {
    return errorResponse(env, 404, 'MOCK_NOT_FOUND', 'No mock test was found for the given mockId.');
  }
  const pdfLink = mock.pdfLink;
  if (!pdfLink || typeof pdfLink !== 'string') {
    // Not an error condition for existing mocks — they simply were never
    // given a PDF link. The frontend falls back to its own generator.
    return errorResponse(env, 404, 'NO_PDF_LINK', 'No question paper PDF is configured for this mock.');
  }

  // 4: Fetch the original PDF from GitHub.
  let originalBytes;
  try {
    const pdfRes = await fetch(pdfLink);
    if (!pdfRes.ok) {
      throw new Error(`upstream responded ${pdfRes.status}`);
    }
    originalBytes = await pdfRes.arrayBuffer();
  } catch (err) {
    console.error('download-question-paper: PDF fetch failed:', err.message);
    return errorResponse(env, 502, 'PDF_FETCH_FAILED', 'Unable to fetch the question paper PDF right now.');
  }

  // 5: Stamp a light, repeating watermark with the student's name + mobile.
  let watermarkedBytes;
  try {
    watermarkedBytes = await addWatermark(originalBytes, studentName, studentMobile);
  } catch (err) {
    console.error('download-question-paper: watermarking failed:', err.message);
    return errorResponse(env, 500, 'WATERMARK_FAILED', 'Unable to prepare the question paper right now.');
  }

  // 6: Return the modified PDF as the download.
  return new Response(watermarkedBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="question-paper.pdf"',
      ...corsHeadersFor(env)
    }
  });
}

// Local helper so we don't have to import cors.js just for header names here —
// json()/errorResponse() already add these for JSON responses; this endpoint
// returns raw binary so it builds the same headers itself.
function corsHeadersFor(env) {
  const origin = env.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin'
  };
}

/**
 * Draws a light, transparent, repeating watermark on every page of the PDF.
 * Uses pdf-lib, the smallest widely-supported PDF library that works inside
 * the Cloudflare Workers runtime (pure JS, no Node/filesystem dependencies).
 */
async function addWatermark(pdfBytes, studentName, studentMobile) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const lines = ['MARUDHARA EXAM', `Student: ${studentName}`, `Mobile: ${studentMobile}`];
  const fontSize = 12;
  const lineHeight = fontSize * 1.4;
  const opacity = 0.15; // light/transparent so the underlying paper stays readable

  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();

    // Tile the watermark block across the page in a grid so it repeats
    // and can't be cropped out of a single spot.
    const stepX = 260;
    const stepY = 220;
    for (let y = 0; y < height + stepY; y += stepY) {
      for (let x = -stepX / 2; x < width + stepX; x += stepX) {
        lines.forEach((line, i) => {
          page.drawText(line, {
            x,
            y: y - i * lineHeight,
            size: fontSize,
            font,
            color: rgb(0.5, 0.5, 0.5),
            opacity,
            rotate: degrees(35)
          });
        });
      }
    }
  }

  return pdfDoc.save();
}
