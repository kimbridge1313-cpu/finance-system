from pathlib import Path

parser_path = Path("src/vendorBillVoice.js")
parser = parser_path.read_text()

old = '''function findVendorMatches(transcript, vendors = []) {
  const haystack = normalizeLookupText(transcript);
  const matches = vendors
    .map((vendor) => {
      const name = normalizeLookupText(vendor.vendorName);
      const code = normalizeLookupText(vendor.vendorCode);
      const matchedByName = Boolean(name && haystack.includes(name));
      const matchedByCode = Boolean(code && haystack.includes(code));
      return {
        vendor,
        matched: matchedByName || matchedByCode,
        score: matchedByCode ? 1000 + code.length : matchedByName ? name.length : 0,
      };
    })
    .filter((entry) => entry.matched)
    .sort((a, b) => b.score - a.score);

  if (!matches.length) return { vendor: null, candidates: [] };
  if (matches.length === 1) return { vendor: matches[0].vendor, candidates: [] };

  const topScore = matches[0].score;
  const topMatches = matches.filter((entry) => entry.score === topScore);
  if (topMatches.length === 1) return { vendor: topMatches[0].vendor, candidates: [] };
  return { vendor: null, candidates: topMatches.slice(0, 4).map((entry) => entry.vendor) };
}
'''

new = '''function getVoiceAliases(vendor) {
  if (Array.isArray(vendor?.voiceAliases)) return vendor.voiceAliases.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof vendor?.voiceAliases === "string") return vendor.voiceAliases.split(/[\\n,，、]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function getVendorVoicePhrase(transcript) {
  return normalizeChineseDateNumbers(transcript)
    .replace(/(?:(?:\\d{1,2})\\s*月\\s*)?\\d{1,2}\\s*(?:日|號)/g, " ")
    .replace(/開始日期|結束日期|開始|結束|起始|截止|從|到|至|月份|月結|廠商|帳單|貨款/g, " ")
    .replace(/[，。,.、:：;；!！?？()（）\\-_/]/g, " ")
    .replace(/\\s+/g, " ")
    .trim();
}

function findVendorMatches(transcript, vendors = []) {
  const haystack = normalizeLookupText(transcript);
  const phrase = normalizeLookupText(getVendorVoicePhrase(transcript));
  const matches = vendors
    .map((vendor) => {
      const name = normalizeLookupText(vendor.vendorName);
      const code = normalizeLookupText(vendor.vendorCode);
      const aliases = getVoiceAliases(vendor).map(normalizeLookupText).filter(Boolean);
      const matchedAlias = aliases.find((alias) => haystack.includes(alias) || (phrase && phrase.includes(alias)));
      const matchedByName = Boolean(name && (haystack.includes(name) || (phrase && phrase.includes(name))));
      const matchedByCode = Boolean(code && haystack.includes(code));
      return {
        vendor,
        matched: Boolean(matchedAlias || matchedByName || matchedByCode),
        score: matchedAlias ? 3000 + matchedAlias.length : matchedByCode ? 2000 + code.length : matchedByName ? 1000 + name.length : 0,
      };
    })
    .filter((entry) => entry.matched)
    .sort((a, b) => b.score - a.score);

  if (!matches.length) return { vendor: null, candidates: [] };
  if (matches.length === 1) return { vendor: matches[0].vendor, candidates: [] };

  const topScore = matches[0].score;
  const topMatches = matches.filter((entry) => entry.score === topScore);
  if (topMatches.length === 1) return { vendor: topMatches[0].vendor, candidates: [] };
  return { vendor: null, candidates: topMatches.slice(0, 4).map((entry) => entry.vendor) };
}
'''

if old not in parser:
    raise SystemExit("findVendorMatches block not found")
parser = parser.replace(old, new, 1)
parser = parser.replace(
    "    endDate: dates.endDate,\n  };",
    "    endDate: dates.endDate,\n    voicePhrase: getVendorVoicePhrase(cleanTranscript),\n  };",
    1,
)
parser_path.write_text(parser)

app_path = Path("src/App.jsx")
app = app_path.read_text()

app = app.replace(
    "function VendorBills({ vendorBills, setVendorBills, vendors, departments }) {",
    "function VendorBills({ vendorBills, setVendorBills, vendors, setVendors, departments }) {",
    1,
)
app = app.replace(
    '  const [voiceCandidates, setVoiceCandidates] = useState([]);\n',
    '  const [voiceCandidates, setVoiceCandidates] = useState([]);\n  const [voicePhrase, setVoicePhrase] = useState("");\n',
    1,
)
app = app.replace(
    '    setVoiceCandidates(result.candidates || []);\n',
    '    setVoiceCandidates(result.candidates || []);\n    setVoicePhrase(result.voicePhrase || "");\n',
    1,
)

marker = '''  function selectVoiceVendor(vendor) {
    if (!vendor?.id) return;
    updateForm("vendorId", vendor.id);
    setVoiceCandidates([]);
    setVoiceMessage(`已帶入廠商：${vendor.vendorCode ? `${vendor.vendorCode}｜` : ""}${vendor.vendorName}`);
  }
'''
replacement = '''  async function rememberVoiceAlias(vendor, aliasText = voicePhrase) {
    const alias = String(aliasText || "").trim();
    if (!vendor?.id || !alias) return;
    const existing = Array.isArray(vendor.voiceAliases) ? vendor.voiceAliases : typeof vendor.voiceAliases === "string" ? vendor.voiceAliases.split(/[\\n,，、]/) : [];
    const nextAliases = [...new Set([...existing.map((item) => String(item || "").trim()).filter(Boolean), alias])];
    await setDoc(doc(db, "vendors", vendor.id), { voiceAliases: nextAliases, updatedAt: serverTimestamp() }, { merge: true });
    setVendors((prev) => prev.map((item) => item.id === vendor.id ? { ...item, voiceAliases: nextAliases } : item));
    setVoiceMessage(`已記住「${alias}」＝${vendor.vendorName}`);
    setVoicePhrase("");
  }

  async function selectVoiceVendor(vendor) {
    if (!vendor?.id) return;
    updateForm("vendorId", vendor.id);
    setVoiceCandidates([]);
    if (voicePhrase) {
      await rememberVoiceAlias(vendor, voicePhrase);
    } else {
      setVoiceMessage(`已帶入廠商：${vendor.vendorCode ? `${vendor.vendorCode}｜` : ""}${vendor.vendorName}`);
    }
  }
'''
if marker not in app:
    raise SystemExit("selectVoiceVendor block not found")
app = app.replace(marker, replacement, 1)

old_vendor_field = '<Field label="月結廠商"><SearchableVendorSelect value={form.vendorId} onChange={(nextVendorId) => updateForm("vendorId", nextVendorId)} vendors={monthlyVendors} departments={departments} placeholder="輸入月結廠商名稱或代碼搜尋" /></Field>'
new_vendor_field = '''<Field label="月結廠商"><SearchableVendorSelect value={form.vendorId} onChange={(nextVendorId) => updateForm("vendorId", nextVendorId)} vendors={monthlyVendors} departments={departments} placeholder="輸入月結廠商名稱或代碼搜尋" /></Field>{voicePhrase && form.vendorId && <div className="rounded-2xl border border-[#06C755]/20 bg-[#06C755]/5 p-3"><p className="text-xs font-bold text-gray-500">這次語音聽成「{voicePhrase}」</p><SmallButton type="button" className="mt-2" onClick={() => rememberVoiceAlias(monthlyVendors.find((vendor) => vendor.id === form.vendorId))}>記住這個叫法</SmallButton></div>}'''
if old_vendor_field not in app:
    raise SystemExit("vendor field marker not found")
app = app.replace(old_vendor_field, new_vendor_field, 1)

app = app.replace(
    'const empty = { vendorCode: "", vendorName: "", type: "cash", department: departments[0]?.value || "bakery", deductRule: "" };',
    'const empty = { vendorCode: "", vendorName: "", voiceAliases: [], type: "cash", department: departments[0]?.value || "bakery", deductRule: "" };',
    1,
)
app = app.replace(
    '<Field label="廠商名稱"><Input value={form.vendorName} onChange={(e) => setForm((p) => ({ ...p, vendorName: e.target.value }))} /></Field>',
    '<Field label="廠商名稱"><Input value={form.vendorName} onChange={(e) => setForm((p) => ({ ...p, vendorName: e.target.value }))} /></Field><Field label="語音叫法 / 常被聽成"><TextArea rows={3} value={(form.voiceAliases || []).join("\\n")} onChange={(e) => setForm((p) => ({ ...p, voiceAliases: e.target.value.split(/\\n|,|，|、/).map((item) => item.trim()).filter(Boolean) }))} placeholder="一行一個，例如：同意商行" /></Field>',
    1,
)
app = app.replace(
    '<Field label="廠商名稱"><Input value={draft.vendorName} onChange={(e) => updateVendorDraft(v.id, "vendorName", e.target.value)} /></Field>',
    '<Field label="廠商名稱"><Input value={draft.vendorName} onChange={(e) => updateVendorDraft(v.id, "vendorName", e.target.value)} /></Field><Field label="語音叫法 / 常被聽成"><TextArea rows={3} value={(Array.isArray(draft.voiceAliases) ? draft.voiceAliases : []).join("\\n")} onChange={(e) => updateVendorDraft(v.id, "voiceAliases", e.target.value.split(/\\n|,|，|、/).map((item) => item.trim()).filter(Boolean))} placeholder="一行一個，語音辨識錯誤的叫法也可加進來" /></Field>',
    1,
)
app = app.replace(
    '<VendorBills vendorBills={vendorBills} setVendorBills={setVendorBills} vendors={vendors} departments={departments} />',
    '<VendorBills vendorBills={vendorBills} setVendorBills={setVendorBills} vendors={vendors} setVendors={setVendors} departments={departments} />',
    1,
)

app_path.write_text(app)
