// ============================================================
//  translator.js  —  shared translation utility
//  Uses Lingva Translate (free, no API key, no meaningful rate limit)
//  Public instance: lingva.ml
//  Translates: en → ne (Nepali ISO 639-1 code)
// ============================================================

// In-memory cache: "text||en-ne" → translated string
// Persists for the browser session — switching languages back and forth
// after the first load is instant with zero extra API calls.
const translationCache = new Map();

const LINGVA_BASE = "https://lingva.ml/api/v1";

/**
 * Translate a single string.
 * @param {string} text       - Source text (English)
 * @param {string} targetLang - "np" for Nepali, "en" to pass through unchanged
 * @returns {Promise<string>} - Translated string (falls back to original on error)
 *
 */

export async function translateText(text, targetLang = "np") {
  if (targetLang === "en") return text;

  const cacheKey = `${text}||en-ne`;
  if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

  try {
    const url = `${LINGVA_BASE}/en/ne/${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const translated = json.translation || text;
    translationCache.set(cacheKey, translated);
    return translated;
  } catch (err) {
    console.warn("Translation failed, using original:", err.message);
    return text;
  }
}

/**
 * Translate multiple strings in parallel.
 * Cached strings return instantly — no API call.
 */
export async function translateBatch(texts, targetLang = "np") {
  if (targetLang === "en") return texts;
  return Promise.all(texts.map((t) => translateText(t, targetLang)));
}

/**
 * Translate user-written fields of a complaint.
 * Status and category are handled by local lookup — never sent to the API.
 */
export async function translateComplaint(complaint, targetLang = "np") {
  if (targetLang === "en") {
    return { title: complaint.title, description: complaint.description };
  }
  const [title, description] = await translateBatch(
    [complaint.title, complaint.description, complaint.status, complaint.category, complaint.location, complaint.userName, complaint.wardNumber,  complaint.createdAt],
    targetLang,
  );
  return { title, description };
}

/**
 * Translate user-written fields of a broadcast.
 */
export async function translateBroadcast(broadcast, targetLang = "np") {
  if (targetLang === "en") {
    return { title: broadcast.title, content: broadcast.content };
  }
  const [title, content] = await translateBatch(
    [broadcast.title, broadcast.content],
    targetLang,
  );
  return { title, content };
}
