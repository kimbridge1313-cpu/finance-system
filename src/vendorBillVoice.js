const CHINESE_DIGITS = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  兩: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

function chineseNumberToArabic(value) {
  const text = String(value || "").trim();
  if (!text) return NaN;
  if (/^\d+$/.test(text)) return Number(text);
  if (text === "十") return 10;
  if (text.includes("十")) {
    const [tensText, onesText] = text.split("十");
    const tens = tensText ? CHINESE_DIGITS[tensText] : 1;
    const ones = onesText ? CHINESE_DIGITS[onesText] : 0;
    if (Number.isFinite(tens) && Number.isFinite(ones)) return tens * 10 + ones;
  }
  if (text.length === 1 && Object.prototype.hasOwnProperty.call(CHINESE_DIGITS, text)) return CHINESE_DIGITS[text];
  return NaN;
}

function normalizeChineseDateNumbers(value) {
  return String(value || "").replace(/([零〇一二兩三四五六七八九十]{1,3})(?=月|日|號)/g, (match) => {
    const number = chineseNumberToArabic(match);
    return Number.isFinite(number) ? String(number) : match;
  });
}

function normalizeLookupText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s，。,.、:：;；!！?？()（）\-_/]/g, "");
}

function parseBillMonth(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function makeDate(year, month, day) {
  if (!year || !month || !day) return "";
  if (month < 1 || month > 12) return "";
  if (day < 1 || day > daysInMonth(year, month)) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateDistanceInDays(dateText, anchorText) {
  const date = new Date(`${dateText}T12:00:00`);
  const anchor = new Date(`${anchorText}T12:00:00`);
  return Math.abs(date.getTime() - anchor.getTime()) / 86400000;
}

function resolveExplicitMonthDate(anchor, month, day) {
  const anchorDate = makeDate(anchor.year, anchor.month, Math.min(15, daysInMonth(anchor.year, anchor.month)));
  const candidates = [anchor.year - 1, anchor.year, anchor.year + 1]
    .map((year) => makeDate(year, month, day))
    .filter(Boolean)
    .map((date) => ({ date, distance: dateDistanceInDays(date, anchorDate) }))
    .sort((a, b) => a.distance - b.distance);
  return candidates[0]?.date || "";
}

function previousMonth(anchor) {
  if (anchor.month === 1) return { year: anchor.year - 1, month: 12 };
  return { year: anchor.year, month: anchor.month - 1 };
}

function extractDateTokens(text) {
  const normalized = normalizeChineseDateNumbers(text);
  const tokens = [];
  const regex = /(?:(\d{1,2})\s*月\s*)?(\d{1,2})\s*(?:日|號)/g;
  let match;
  while ((match = regex.exec(normalized))) {
    tokens.push({
      month: match[1] ? Number(match[1]) : null,
      day: Number(match[2]),
      index: match.index,
      raw: match[0],
    });
  }
  return { normalized, tokens };
}

function resolveDateRange(text, billMonth) {
  const anchor = parseBillMonth(billMonth);
  if (!anchor) return { startDate: "", endDate: "" };
  const { normalized, tokens } = extractDateTokens(text);
  if (!tokens.length) return { startDate: "", endDate: "" };

  const mentionsStart = /(開始日期|開始|起始|從)/.test(normalized);
  const mentionsEnd = /(結束日期|結束|截止|到|至)/.test(normalized);

  if (tokens.length === 1) {
    const token = tokens[0];
    const resolved = token.month
      ? resolveExplicitMonthDate(anchor, token.month, token.day)
      : makeDate(anchor.year, anchor.month, token.day);
    if (mentionsStart && !mentionsEnd) return { startDate: resolved, endDate: "" };
    if (mentionsEnd && !mentionsStart) return { startDate: "", endDate: resolved };
    return { startDate: resolved, endDate: "" };
  }

  const start = tokens[0];
  const end = tokens[1];
  let startDate = "";
  let endDate = "";

  if (!start.month && !end.month) {
    endDate = makeDate(anchor.year, anchor.month, end.day);
    const startAnchor = start.day > end.day ? previousMonth(anchor) : anchor;
    startDate = makeDate(startAnchor.year, startAnchor.month, start.day);
    return { startDate, endDate };
  }

  if (start.month) startDate = resolveExplicitMonthDate(anchor, start.month, start.day);
  if (end.month) endDate = resolveExplicitMonthDate(anchor, end.month, end.day);

  if (!start.month && endDate) {
    const [endYear, endMonth] = endDate.split("-").map(Number);
    const startAnchor = start.day > end.day ? previousMonth({ year: endYear, month: endMonth }) : { year: endYear, month: endMonth };
    startDate = makeDate(startAnchor.year, startAnchor.month, start.day);
  }

  if (!end.month && startDate) {
    const [startYear, startMonth] = startDate.split("-").map(Number);
    const nextMonth = start.day > end.day
      ? (startMonth === 12 ? { year: startYear + 1, month: 1 } : { year: startYear, month: startMonth + 1 })
      : { year: startYear, month: startMonth };
    endDate = makeDate(nextMonth.year, nextMonth.month, end.day);
  }

  if (startDate && endDate && startDate > endDate) {
    const [year, month, day] = startDate.split("-").map(Number);
    const previous = previousMonth({ year, month });
    const adjusted = makeDate(previous.year, previous.month, day);
    if (adjusted) startDate = adjusted;
  }

  return { startDate, endDate };
}

function getVoiceAliases(vendor) {
  if (Array.isArray(vendor?.voiceAliases)) return vendor.voiceAliases.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof vendor?.voiceAliases === "string") return vendor.voiceAliases.split(/[\n,，、]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function getVendorVoicePhrase(transcript) {
  return normalizeChineseDateNumbers(transcript)
    .replace(/(?:(?:\d{1,2})\s*月\s*)?\d{1,2}\s*(?:日|號)/g, " ")
    .replace(/開始日期|結束日期|開始|結束|起始|截止|從|到|至|月份|月結|廠商|帳單|貨款/g, " ")
    .replace(/[，。,.、:：;；!！?？()（）\-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function longestCommonSubstringLength(a, b) {
  if (!a || !b) return 0;
  const previous = new Array(b.length + 1).fill(0);
  let best = 0;
  for (let i = 1; i <= a.length; i += 1) {
    const current = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        current[j] = previous[j - 1] + 1;
        best = Math.max(best, current[j]);
      }
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return best;
}

function scoreLookupTerm(query, term) {
  if (!query || !term) return 0;
  if (query === term) return 10000 + term.length;
  if (query.includes(term)) return 9000 + term.length * 10;
  if (query.length >= 2 && term.includes(query)) {
    return 8000 + query.length * 20 - Math.max(0, term.length - query.length);
  }

  const commonLength = longestCommonSubstringLength(query, term);
  const shorterLength = Math.min(query.length, term.length);
  const coverage = shorterLength ? commonLength / shorterLength : 0;
  if (commonLength >= 3 && coverage >= 0.6) {
    return 4000 + Math.round(coverage * 1000) + commonLength * 20;
  }
  return 0;
}

function findVendorMatches(transcript, vendors = []) {
  const haystack = normalizeLookupText(transcript);
  const phrase = normalizeLookupText(getVendorVoicePhrase(transcript));
  const queries = [...new Set([phrase, haystack].filter(Boolean))];

  const matches = vendors
    .map((vendor) => {
      const name = normalizeLookupText(vendor.vendorName);
      const code = normalizeLookupText(vendor.vendorCode);
      const aliases = getVoiceAliases(vendor).map(normalizeLookupText).filter(Boolean);

      let score = 0;
      queries.forEach((query) => {
        score = Math.max(score, scoreLookupTerm(query, name));
        score = Math.max(score, scoreLookupTerm(query, code) + (code ? 500 : 0));
        aliases.forEach((alias) => {
          score = Math.max(score, scoreLookupTerm(query, alias) + 700);
        });
      });

      return { vendor, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!matches.length) return { vendor: null, candidates: [] };
  if (matches.length === 1) return { vendor: matches[0].vendor, candidates: [] };

  const top = matches[0];
  const second = matches[1];
  const scoreGap = top.score - second.score;

  if (top.score >= 9000) return { vendor: top.vendor, candidates: [] };
  if (top.score >= 8000 && scoreGap >= 250) return { vendor: top.vendor, candidates: [] };
  if (top.score >= 4500 && scoreGap >= 180) return { vendor: top.vendor, candidates: [] };

  return { vendor: null, candidates: matches.slice(0, 4).map((entry) => entry.vendor) };
}

export function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported() {
  return Boolean(getSpeechRecognitionConstructor());
}

export function parseVendorBillVoice({ transcript, billMonth, vendors = [] }) {
  const cleanTranscript = String(transcript || "").trim();
  const vendorResult = findVendorMatches(cleanTranscript, vendors);
  const dates = resolveDateRange(cleanTranscript, billMonth);
  return {
    transcript: cleanTranscript,
    vendor: vendorResult.vendor,
    candidates: vendorResult.candidates,
    startDate: dates.startDate,
    endDate: dates.endDate,
    voicePhrase: getVendorVoicePhrase(cleanTranscript),
  };
}

export function getMonthDefaultRange(billMonth) {
  const anchor = parseBillMonth(billMonth);
  if (!anchor) return { startDate: "", endDate: "" };
  return {
    startDate: makeDate(anchor.year, anchor.month, 1),
    endDate: makeDate(anchor.year, anchor.month, daysInMonth(anchor.year, anchor.month)),
  };
}
