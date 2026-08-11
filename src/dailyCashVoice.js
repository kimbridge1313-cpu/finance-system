const CHINESE_DIGITS = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  兩: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

const CHINESE_UNITS = {
  十: 10,
  百: 100,
  千: 1000,
  萬: 10000,
  万: 10000,
};

function chineseAmountToNumber(value) {
  const text = String(value || "").trim();
  if (!text) return NaN;
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);

  let total = 0;
  let section = 0;
  let number = 0;
  let found = false;

  for (const char of text) {
    if (Object.prototype.hasOwnProperty.call(CHINESE_DIGITS, char)) {
      number = CHINESE_DIGITS[char];
      found = true;
      continue;
    }

    const unit = CHINESE_UNITS[char];
    if (!unit) return NaN;
    found = true;

    if (unit === 10000) {
      section += number;
      total += (section || 1) * unit;
      section = 0;
      number = 0;
      continue;
    }

    if (number === 0) number = 1;
    section += number * unit;
    number = 0;
  }

  return found ? total + section + number : NaN;
}

function normalizeLookupText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s，。,.、:：;；!！?？()（）\-_/]/g, "");
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
  if (query.length >= 2 && term.includes(query)) return 8000 + query.length * 20 - Math.max(0, term.length - query.length);

  const commonLength = longestCommonSubstringLength(query, term);
  const shorterLength = Math.min(query.length, term.length);
  const coverage = shorterLength ? commonLength / shorterLength : 0;
  if (commonLength >= 2 && coverage >= 0.67) return 4000 + Math.round(coverage * 1000) + commonLength * 20;
  return 0;
}

function getVoiceAliases(vendor) {
  if (Array.isArray(vendor?.voiceAliases)) return vendor.voiceAliases.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof vendor?.voiceAliases === "string") return vendor.voiceAliases.split(/[\n,，、]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function extractTrailingAmount(transcript) {
  const original = String(transcript || "").trim();
  if (!original) return { amount: 0, keyword: "", amountText: "" };

  const arabicMatch = original.match(/([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:元整|塊錢|块钱|元|塊|块)?\s*$/);
  if (arabicMatch) {
    const amount = Number(arabicMatch[1].replaceAll(",", ""));
    return {
      amount: Number.isFinite(amount) ? amount : 0,
      amountText: arabicMatch[0].trim(),
      keyword: original.slice(0, arabicMatch.index).replace(/[，,、\s]+$/g, "").trim(),
    };
  }

  const chineseMatch = original.match(/([零〇一二兩两三四五六七八九十百千萬万]+)\s*(?:元整|塊錢|块钱|元|塊|块)?\s*$/);
  if (chineseMatch) {
    const amount = chineseAmountToNumber(chineseMatch[1]);
    if (Number.isFinite(amount) && amount > 0) {
      return {
        amount,
        amountText: chineseMatch[0].trim(),
        keyword: original.slice(0, chineseMatch.index).replace(/[，,、\s]+$/g, "").trim(),
      };
    }
  }

  return { amount: 0, keyword: original, amountText: "" };
}

function pickUniqueTop(matches, minimumScore = 4000) {
  const filtered = matches.filter((entry) => entry.score >= minimumScore).sort((a, b) => b.score - a.score);
  if (!filtered.length) return { match: null, candidates: [] };
  if (filtered.length === 1) return { match: filtered[0], candidates: [] };

  const top = filtered[0];
  const second = filtered[1];
  const gap = top.score - second.score;
  if (top.score >= 9000 || gap >= 250) return { match: top, candidates: [] };
  return { match: null, candidates: filtered.slice(0, 4) };
}

function findVendor(keyword, vendors = []) {
  const query = normalizeLookupText(keyword);
  if (!query) return { vendor: null, candidates: [] };

  const scored = vendors.map((vendor) => {
    const terms = [vendor.vendorName, vendor.vendorCode, ...getVoiceAliases(vendor)].map(normalizeLookupText).filter(Boolean);
    const score = terms.reduce((best, term) => Math.max(best, scoreLookupTerm(query, term)), 0);
    return { vendor, score };
  });

  const result = pickUniqueTop(scored);
  return {
    vendor: result.match?.vendor || null,
    candidates: result.candidates.map((entry) => entry.vendor),
  };
}

function getCategoryOptions(categories, type) {
  return Array.isArray(categories?.[type]?.options) ? categories[type].options : [];
}

function normalizeItems(items = []) {
  return items.map((item) => {
    if (typeof item === "string") return { label: item, department: "", voiceAliases: [] };
    const voiceAliases = Array.isArray(item?.voiceAliases)
      ? item.voiceAliases
      : typeof item?.voiceAliases === "string"
        ? item.voiceAliases.split(/[\n,，、]/)
        : [];
    return {
      label: item?.label || "",
      department: item?.department || "",
      voiceAliases: voiceAliases.map((value) => String(value || "").trim()).filter(Boolean),
    };
  });
}

function findAccountingItem(keyword, categories, entryType = "") {
  const query = normalizeLookupText(keyword);
  if (!query) return { rule: null, candidates: [] };

  const scored = [];
  (entryType ? [entryType] : ["expense", "income"]).forEach((type) => {
    getCategoryOptions(categories, type).forEach((category) => {
      normalizeItems(category.items || []).forEach((item) => {
        const terms = [item.label, ...(item.voiceAliases || [])].map(normalizeLookupText).filter(Boolean);
        const score = terms.reduce((best, term) => Math.max(best, scoreLookupTerm(query, term)), 0);
        if (score > 0) scored.push({
          score,
          rule: {
            type,
            categoryId: category.id,
            categoryLabel: category.label,
            item: item.label,
            department: item.department || category.department || "",
          },
        });
      });
    });
  });

  const result = pickUniqueTop(scored);
  return {
    rule: result.match?.rule || null,
    candidates: result.candidates.map((entry) => entry.rule),
  };
}

function getCashPurchaseRule(categories) {
  const expenseOptions = getCategoryOptions(categories, "expense");
  const category = expenseOptions.find((item) => item.id === "cash_purchase" || item.label === "現結貨款") || null;
  if (!category) return null;
  const items = normalizeItems(category.items || []);
  const preferred = items.find((item) => item.label === "進貨") || items.find((item) => item.label.includes("進貨")) || items[0] || { label: "", department: "" };
  return {
    type: "expense",
    categoryId: category.id,
    categoryLabel: category.label,
    item: preferred.label,
    department: preferred.department || category.department || "",
  };
}

export function parseDailyCashQuickEntry({ transcript, vendors = [], categories = {}, entryType = "expense" }) {
  const cleanTranscript = String(transcript || "").trim();
  const amountResult = extractTrailingAmount(cleanTranscript);
  const targetType = entryType === "income" ? "income" : "expense";
  const rawKeyword = amountResult.keyword;
  const keyword = rawKeyword.replace(targetType === "income" ? /^(收入|收款|入帳)\s*/ : /^(支出|付款|出帳)\s*/, "").trim() || rawKeyword;

  if (!keyword || !amountResult.amount) {
    return {
      transcript: cleanTranscript,
      keyword,
      amount: amountResult.amount,
      status: !keyword ? "missing_keyword" : "missing_amount",
      rule: null,
      candidates: [],
    };
  }

  if (targetType === "expense") {
    const cashVendors = vendors.filter((vendor) => vendor.type === "cash");
    const vendorResult = findVendor(keyword, cashVendors);
    if (vendorResult.vendor) {
      const baseRule = getCashPurchaseRule(categories);
      if (!baseRule) return { transcript: cleanTranscript, keyword, amount: amountResult.amount, status: "missing_cash_purchase_category", rule: null, candidates: [] };
      return {
        transcript: cleanTranscript,
        keyword,
        amount: amountResult.amount,
        status: "matched_vendor",
        rule: {
          ...baseRule,
          vendorId: vendorResult.vendor.id,
          vendorName: vendorResult.vendor.vendorName,
          department: vendorResult.vendor.department || baseRule.department,
        },
        candidates: [],
      };
    }

    if (vendorResult.candidates.length) {
      return {
        transcript: cleanTranscript,
        keyword,
        amount: amountResult.amount,
        status: "ambiguous_vendor",
        rule: null,
        candidates: vendorResult.candidates.map((vendor) => ({ kind: "vendor", vendor })),
      };
    }
  }

  const itemResult = findAccountingItem(keyword, categories, targetType);
  if (itemResult.rule) {
    return {
      transcript: cleanTranscript,
      keyword,
      amount: amountResult.amount,
      status: "matched_item",
      rule: itemResult.rule,
      candidates: [],
    };
  }

  return {
    transcript: cleanTranscript,
    keyword,
    amount: amountResult.amount,
    status: itemResult.candidates.length ? "ambiguous_item" : "not_found",
    rule: null,
    candidates: itemResult.candidates.map((rule) => ({ kind: "item", rule })),
  };
}
