from pathlib import Path

app_path = Path('src/App.jsx')
voice_path = Path('src/dailyCashVoice.js')
app = app_path.read_text()
voice = voice_path.read_text()


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing patch target: {label}')
    return text.replace(old, new, 1)

app = replace_once(
    app,
    'function normalizeAccountingItems(items = []) { return items.map((item) => (typeof item === "string" ? { label: item, department: "" } : { label: item.label || "", department: item.department || "" })); }',
    '''function normalizeVoiceAliases(value) { if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean); if (typeof value === "string") return value.split(/\\n|,|，|、/).map((item) => item.trim()).filter(Boolean); return []; }\nfunction normalizeAccountingItems(items = []) { return items.map((item) => (typeof item === "string" ? { label: item, department: "", voiceAliases: [] } : { label: item.label || "", department: item.department || "", voiceAliases: normalizeVoiceAliases(item.voiceAliases) })); }''',
    'accounting item alias normalization',
)

app = replace_once(
    app,
    'function DailyCash({ currentUser, isAdmin, categories, departments, dailyCashData, setDailyCashData, vendors }) {',
    'function DailyCash({ currentUser, isAdmin, categories, setCategories, departments, dailyCashData, setDailyCashData, vendors, setVendors }) {',
    'DailyCash props',
)

app = replace_once(
    app,
    '  const [quickVoiceCandidates, setQuickVoiceCandidates] = useState([]);\n',
    '  const [quickVoiceCandidates, setQuickVoiceCandidates] = useState([]);\n  const [quickVoiceKeyword, setQuickVoiceKeyword] = useState("");\n',
    'quick voice keyword state',
)

app = replace_once(
    app,
    '    setQuickVoiceText(parsed?.transcript || "");\n    setQuickVoiceCandidates((parsed?.candidates || []).map((candidate) => ({ ...candidate, amount: parsed?.amount || 0 })));',
    '    setQuickVoiceText(parsed?.transcript || "");\n    setQuickVoiceKeyword(parsed?.keyword || "");\n    setQuickVoiceCandidates((parsed?.candidates || []).map((candidate) => ({ ...candidate, amount: parsed?.amount || 0 })));',
    'capture parsed keyword',
)

app = replace_once(
    app,
    '      else setQuickVoiceMessage("找不到符合的現結廠商或記帳項目，請確認設定中的名稱／語音別名。");',
    '      else setQuickVoiceMessage("找不到符合的名稱。可先在下方手動選正確廠商或記帳項目，再按「記住這個叫法」，下次即使語音仍聽錯也能直接命中。");',
    'not found message',
)

anchor = '''  function applyQuickVoiceText(transcript = quickVoiceText) {\n    const parsed = parseDailyCashQuickEntry({ transcript, vendors, categories });\n    applyQuickEntryResult(parsed);\n  }'''
replacement = '''  async function rememberQuickVoiceAlias() {\n    const alias = String(quickVoiceKeyword || "").trim();\n    if (!alias) return;\n\n    if (entryType === "expense" && category === "cash_purchase" && vendorId) {\n      const selectedVendor = cashVendors.find((vendor) => vendor.id === vendorId);\n      if (!selectedVendor) return;\n      const nextAliases = [...new Set([...normalizeVoiceAliases(selectedVendor.voiceAliases), alias])];\n      await setDoc(doc(db, "vendors", selectedVendor.id), { voiceAliases: nextAliases, updatedAt: serverTimestamp() }, { merge: true });\n      setVendors((prev) => prev.map((vendor) => vendor.id === selectedVendor.id ? { ...vendor, voiceAliases: nextAliases } : vendor));\n      setQuickVoiceMessage(`已記住「${alias}」＝${selectedVendor.vendorName}`);\n      setQuickVoiceKeyword("");\n      return;\n    }\n\n    if (!category || !entryItem) {\n      setQuickVoiceMessage("請先在下方選正確的記帳項目，再記住這個叫法。");\n      return;\n    }\n\n    let learned = false;\n    const nextOptions = getCategoryOptions(categories, entryType).map((categoryOption) => {\n      if (categoryOption.id !== category) return categoryOption;\n      const nextItems = normalizeAccountingItems(categoryOption.items || []).map((item) => {\n        if (item.label !== entryItem) return item;\n        learned = true;\n        return { ...item, voiceAliases: [...new Set([...normalizeVoiceAliases(item.voiceAliases), alias])] };\n      });\n      return { ...categoryOption, items: nextItems };\n    });\n\n    if (!learned) {\n      setQuickVoiceMessage("目前選擇的記帳項目無法建立語音別名。");\n      return;\n    }\n\n    const nextCategories = {\n      ...categories,\n      [entryType]: { ...(categories?.[entryType] || {}), options: nextOptions },\n    };\n    await setDoc(doc(db, "settings", "categories"), { categories: nextCategories, updatedAt: serverTimestamp() }, { merge: true });\n    setCategories(nextCategories);\n    setQuickVoiceMessage(`已記住「${alias}」＝${entryItem}`);\n    setQuickVoiceKeyword("");\n  }\n  function applyQuickVoiceText(transcript = quickVoiceText) {\n    const parsed = parseDailyCashQuickEntry({ transcript, vendors, categories });\n    applyQuickEntryResult(parsed);\n  }'''
app = replace_once(app, anchor, replacement, 'remember quick voice alias')

app = replace_once(
    app,
    '''  function selectQuickVoiceCandidate(candidate) {\n    if (candidate.kind === "vendor") {\n      const parsed = parseDailyCashQuickEntry({ transcript: `${candidate.vendor.vendorName} ${candidate.amount}`, vendors, categories });\n      applyQuickEntryResult(parsed);\n      return;\n    }\n    if (candidate.kind === "item") {\n      applyQuickEntryResult({ transcript: quickVoiceText, amount: candidate.amount, status: "matched_item", rule: candidate.rule, candidates: [] });\n    }\n  }''',
    '''  function selectQuickVoiceCandidate(candidate) {\n    const heardKeyword = quickVoiceKeyword;\n    if (candidate.kind === "vendor") {\n      const parsed = parseDailyCashQuickEntry({ transcript: `${candidate.vendor.vendorName} ${candidate.amount}`, vendors, categories });\n      applyQuickEntryResult(parsed);\n      setQuickVoiceKeyword(heardKeyword);\n      return;\n    }\n    if (candidate.kind === "item") {\n      applyQuickEntryResult({ transcript: quickVoiceText, keyword: heardKeyword, amount: candidate.amount, status: "matched_item", rule: candidate.rule, candidates: [] });\n    }\n  }''',
    'preserve heard keyword on candidate select',
)

app = replace_once(
    app,
    '    setQuickVoiceCandidates([]);\n    if (isManualItem) setEntryItem("");',
    '    setQuickVoiceCandidates([]);\n    setQuickVoiceKeyword("");\n    if (isManualItem) setEntryItem("");',
    'clear learned keyword after save',
)

old_ui = '''{quickVoiceMessage && <div className="rounded-2xl bg-white p-3 text-sm font-bold leading-6 text-gray-700">{quickVoiceMessage}</div>}{quickVoiceCandidates.length > 0 && <div className="flex flex-wrap gap-2">'''
new_ui = '''{quickVoiceMessage && <div className="rounded-2xl bg-white p-3 text-sm font-bold leading-6 text-gray-700">{quickVoiceMessage}</div>}{isAdmin && quickVoiceKeyword && ((entryType === "expense" && category === "cash_purchase" && vendorId) || (category && entryItem)) && <button type="button" onClick={rememberQuickVoiceAlias} className="w-full rounded-2xl border border-[#06C755]/30 bg-white px-4 py-3 text-sm font-black text-[#069648]">記住「{quickVoiceKeyword}」這個叫法</button>}{quickVoiceCandidates.length > 0 && <div className="flex flex-wrap gap-2">'''
app = replace_once(app, old_ui, new_ui, 'remember alias button')

old_item_ui = '''<div className="mt-2"><Field label="此項目歸帳部門"><Select value={item.department || ""} onChange={(e) => updateItem(cat.id, i, "department", e.target.value)}><option value="">未設定，跟隨分類或手動</option>{departments.map((dept) => <option key={dept.value} value={dept.value}>{dept.label}</option>)}</Select></Field></div></div>)}'''
new_item_ui = '''<div className="mt-2"><Field label="此項目歸帳部門"><Select value={item.department || ""} onChange={(e) => updateItem(cat.id, i, "department", e.target.value)}><option value="">未設定，跟隨分類或手動</option>{departments.map((dept) => <option key={dept.value} value={dept.value}>{dept.label}</option>)}</Select></Field></div><div className="mt-2"><Field label="語音叫法 / 常被聽成"><Input value={(item.voiceAliases || []).join("、")} onChange={(e) => updateItem(cat.id, i, "voiceAliases", e.target.value.split(/,|，|、/).map((value) => value.trim()).filter(Boolean))} placeholder="例如：好事多、costco" /></Field></div></div>)}'''
app = replace_once(app, old_item_ui, new_item_ui, 'accounting item voice aliases UI')

app = replace_once(
    app,
    '<DailyCash currentUser={currentUser} isAdmin={isAdmin} categories={categories} departments={departments} dailyCashData={dailyCashData} setDailyCashData={setDailyCashData} vendors={vendors} />',
    '<DailyCash currentUser={currentUser} isAdmin={isAdmin} categories={categories} setCategories={setCategories} departments={departments} dailyCashData={dailyCashData} setDailyCashData={setDailyCashData} vendors={vendors} setVendors={setVendors} />',
    'pass learning setters to DailyCash',
)

voice = replace_once(
    voice,
    'function normalizeItems(items = []) {\n  return items.map((item) => typeof item === "string" ? { label: item, department: "" } : { label: item?.label || "", department: item?.department || "" });\n}',
    '''function normalizeItems(items = []) {\n  return items.map((item) => {\n    if (typeof item === "string") return { label: item, department: "", voiceAliases: [] };\n    const voiceAliases = Array.isArray(item?.voiceAliases)\n      ? item.voiceAliases\n      : typeof item?.voiceAliases === "string"\n        ? item.voiceAliases.split(/[\\n,，、]/)\n        : [];\n    return {\n      label: item?.label || "",\n      department: item?.department || "",\n      voiceAliases: voiceAliases.map((value) => String(value || "").trim()).filter(Boolean),\n    };\n  });\n}''',
    'voice parser item aliases',
)

voice = replace_once(
    voice,
    '        const score = scoreLookupTerm(query, normalizeLookupText(item.label));\n        if (score > 0) scored.push({',
    '        const terms = [item.label, ...(item.voiceAliases || [])].map(normalizeLookupText).filter(Boolean);\n        const score = terms.reduce((best, term) => Math.max(best, scoreLookupTerm(query, term)), 0);\n        if (score > 0) scored.push({',
    'match accounting item aliases',
)

app_path.write_text(app)
voice_path.write_text(voice)
print('patched App.jsx and dailyCashVoice.js')
