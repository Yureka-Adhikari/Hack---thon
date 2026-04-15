// ============================================================
//  translator.js  —  shared translation utility
//  Uses MyMemory API (free, no API key required, reliable)
//  Translates: en → ne (Nepali)
// ============================================================

const translationCache = new Map();

export async function translateText(text, targetLang = "np") {
  if (!text || targetLang === "en") return text;

  const cacheKey = `${text}||ne`;
  if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

  try {
    // Try MyMemory first (most reliable, free, no key needed)
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ne`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    // MyMemory returns responseStatus 200 on success
    const translated =
      json.responseStatus === 200 && json.responseData?.translatedText
        ? json.responseData.translatedText
        : text;

    translationCache.set(cacheKey, translated);
    return translated;
  } catch (err) {
    // Fallback: try Lingva as backup
    try {
      const fallbackUrl = `https://lingva.ml/api/v1/en/ne/${encodeURIComponent(text)}`;
      const fallbackRes = await fetch(fallbackUrl);
      if (!fallbackRes.ok) throw new Error("Lingva also failed");
      const fallbackJson = await fallbackRes.json();
      const translated = fallbackJson.translation || text;
      translationCache.set(cacheKey, translated);
      return translated;
    } catch {
      console.warn("Translation failed for:", text);
      return text;
    }
  }
}

export async function translateBatch(texts, targetLang = "np") {
  if (targetLang === "en") return texts;
  // Translate in parallel, max 5 at a time to avoid rate limits
  const results = [];
  for (let i = 0; i < texts.length; i += 5) {
    const chunk = texts.slice(i, i + 5);
    const translated = await Promise.all(
      chunk.map((t) => translateText(t, targetLang)),
    );
    results.push(...translated);
  }
  return results;
}

export async function translateComplaint(complaint, targetLang = "np") {
  if (targetLang === "en") {
    return { title: complaint.title, description: complaint.description };
  }
  const [title, description] = await translateBatch(
    [complaint.title || "", complaint.description || ""],
    targetLang,
  );
  return { title, description };
}

export async function translateBroadcast(broadcast, targetLang = "np") {
  if (targetLang === "en") {
    return { title: broadcast.title, content: broadcast.content };
  }
  const [title, content] = await translateBatch(
    [broadcast.title || "", broadcast.content || ""],
    targetLang,
  );
  return { title, content };
}
