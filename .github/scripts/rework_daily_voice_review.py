from pathlib import Path
import re

app_path = Path('src/App.jsx')
voice_path = Path('src/dailyCashVoice.js')
app = app_path.read_text()
voice = voice_path.read_text()

# State for review/edit flow.
app = app.replace(
    '  const [quickVoiceKeyword, setQuickVoiceKeyword] = useState("");\n',
    '  const [quickVoiceKeyword, setQuickVoiceKeyword] = useState("");\n'
    '  const [quickVoiceReviewOpen, setQuickVoiceReviewOpen] = useState(false);\n'
    '  const [quickVoiceEditing, setQuickVoiceEditing] = useState(false);\n'
    '  const [quickVoiceMatched, setQuickVoiceMatched] = useState(false);\n'
)

# Add derived values for the review card.
app = app.replace(
    '  const showCashVendorSelect = entryType === "expense" && category === "cash_purchase";\n',
    '  const showCashVendorSelect = entryType === "expense" && category === "cash_purchase";\n'
    '  const selectedCategoryLabel = categoryOptions.find((item) => item.id === category)?.label || category || "未辨識";\n'
    '  const selectedCashVendor = cashVendors.find((vendor) => vendor.id === vendorId);\n'
    '  const quickVoiceReadyToSave = Boolean(Number(amount) > 0 && category && entryItem && (!showCashVendorSelect || vendorId));\n'
)

# Type switch dedicated to voice flow.
pattern = re.compile(r'(  function handleTypeChange\(nextType\) \{[^\n]+\}\n)')
match = pattern.search(app)
assert match, 'handleTypeChange not found'
insert = match.group(1) + '''  function handleQuickVoiceTypeChange(nextType) {
    handleTypeChange(nextType);
    setVendorId("");
    setQuickVoiceText("");
    setQuickVoiceMessage("");
    setQuickVoiceCandidates([]);
    setQuickVoiceKeyword("");
    setQuickVoiceReviewOpen(false);
    setQuickVoiceEditing(false);
    setQuickVoiceMatched(false);
  }
'''
app = app[:match.start()] + insert + app[match.end():]

# Review state whenever recognition is applied.
app = app.replace(
    '    setQuickVoiceCandidates((parsed?.candidates || []).map((candidate) => ({ ...candidate, amount: parsed?.amount || 0 })));\n\n    if (!parsed?.rule) {',
    '    setQuickVoiceCandidates((parsed?.candidates || []).map((candidate) => ({ ...candidate, amount: parsed?.amount || 0 })));\n'
    '    setQuickVoiceReviewOpen(true);\n'
    '    setQuickVoiceEditing(false);\n'
    '    setQuickVoiceMatched(Boolean(parsed?.rule));\n\n'
    '    if (!parsed?.rule) {'
)

# Failed recognition should still open review, but cannot be confirmed until manually fixed.
failed_pattern = re.compile(r'    if \(!parsed\?\.rule\) \{.*?      return;\n    \}', re.S)
failed_match = failed_pattern.search(app)
assert failed_match, 'parsed failure block not found'
failed_block = '''    if (!parsed?.rule) {
      handleTypeChange(entryType);
      setVendorId("");
      if (parsed?.amount) setAmount(String(parsed.amount));
      if (parsed?.status === "missing_amount") setQuickVoiceMessage("有辨識到名稱，但沒有抓到句尾金額。請再說一次或按手動修改。");
      else if (parsed?.status === "missing_cash_purchase_category") setQuickVoiceMessage("設定裡找不到「現結貨款」分類，請按手動修改確認。");
      else setQuickVoiceMessage("有聽到內容，但無法安全判斷記帳規則。請按「手動修改」確認一次。");
      return;
    }'''
app = app[:failed_match.start()] + failed_block + app[failed_match.end():]

# Parse within the selected income/expense scope.
app = app.replace('parseDailyCashQuickEntry({ transcript, vendors, categories })', 'parseDailyCashQuickEntry({ transcript, vendors, categories, entryType })')
app = app.replace('parseDailyCashQuickEntry({ transcript: `${candidate.vendor.vendorName} ${candidate.amount}`, vendors, categories })', 'parseDailyCashQuickEntry({ transcript: `${candidate.vendor.vendorName} ${candidate.amount}`, vendors, categories, entryType })')

# Reset review state after save.
app = app.replace(
    '    setQuickVoiceKeyword("");\n    if (isManualItem) setEntryItem("");',
    '    setQuickVoiceKeyword("");\n'
    '    setQuickVoiceReviewOpen(false);\n'
    '    setQuickVoiceEditing(false);\n'
    '    setQuickVoiceMatched(false);\n'
    '    if (isManualItem) setEntryItem("");'
)

# Clear stale review when listening starts.
app = app.replace(
    '      setQuickVoiceCandidates([]);\n    };',
    '      setQuickVoiceCandidates([]);\n'
    '      setQuickVoiceReviewOpen(false);\n'
    '      setQuickVoiceEditing(false);\n'
    '      setQuickVoiceMatched(false);\n'
    '    };',
    1
)

# Replace the old voice card + permanently visible form with one recognition/review card.
ui_pattern = re.compile(
    r'(<PageHeader title="每日記帳" subtitle=\{isAdmin \? "老闆可查每天全部部門明細。" : "員工只能每日記帳與查看當日明細。"\} icon=\{ICONS\.wallet\} />)'
    r'<Card className="space-y-4 border border-\[#06C755\]/20 bg-\[#06C755\]/5">.*?</Card><Card className="space-y-5">.*?</Card>'
    r'(\{isAdmin && <Card className="overflow-hidden p-0">)',
    re.S,
)
ui_match = ui_pattern.search(app)
assert ui_match, 'daily voice UI block not found'
new_ui = r'''<Card className="space-y-4 border border-[#06C755]/20 bg-[#06C755]/5"><div><p className="text-lg font-black text-gray-950">快速語音記帳</p><p className="mt-1 text-xs font-bold leading-5 text-gray-500">先選支出或收入，再說「名稱 + 金額」。系統只會在該類型的既有規則中比對。</p></div><div className="grid grid-cols-2 rounded-2xl bg-white p-1"><button type="button" onClick={() => handleQuickVoiceTypeChange("expense")} className={`rounded-xl px-4 py-3 font-black ${entryType === "expense" ? "bg-red-500 text-white" : "text-red-500"}`}>支出</button><button type="button" onClick={() => handleQuickVoiceTypeChange("income")} className={`rounded-xl px-4 py-3 font-black ${entryType === "income" ? "bg-[#06C755] text-white" : "text-[#06C755]"}`}>收入</button></div><div className="grid grid-cols-[1fr_112px] gap-2"><Input value={quickVoiceText} onChange={(e) => setQuickVoiceText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") applyQuickVoiceText(); }} placeholder={entryType === "expense" ? "例如：三雅 2000、好市多 3000" : "例如：營業收入 38000"} /><button type="button" onClick={startQuickVoiceInput} disabled={quickVoiceListening} className={`rounded-2xl px-3 py-3 text-sm font-black ${quickVoiceListening ? "bg-red-500 text-white" : "bg-[#06C755] text-white"}`}>{quickVoiceListening ? "聽取中…" : "🎙 語音辨識"}</button></div><p className="text-[11px] font-bold leading-5 text-gray-400">也可直接輸入文字後按 Enter 測試；語音辨識後先顯示預填結果，不會直接寫入帳。</p>{quickVoiceMessage && <div className="rounded-2xl bg-white p-3 text-sm font-bold leading-6 text-gray-700">{quickVoiceMessage}</div>}{quickVoiceReviewOpen && <div className="space-y-4 rounded-[24px] border border-gray-100 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-widest text-gray-400">預填結果</p><p className="mt-1 break-words text-sm font-black text-gray-950">{quickVoiceText || "未辨識到文字"}</p></div><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${entryType === "expense" ? "bg-red-50 text-red-500" : "bg-[#06C755]/10 text-[#06C755]"}`}>{entryType === "expense" ? "支出" : "收入"}</span></div>{!quickVoiceEditing ? <><div className="grid grid-cols-2 gap-2 text-sm font-bold"><div className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] text-gray-400">分類</p><p className="mt-1 text-gray-900">{quickVoiceMatched ? selectedCategoryLabel : "待手動確認"}</p></div><div className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] text-gray-400">項目</p><p className="mt-1 text-gray-900">{quickVoiceMatched ? entryItem || "未辨識" : "待手動確認"}</p></div>{entryType === "expense" && <div className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] text-gray-400">廠商</p><p className="mt-1 text-gray-900">{quickVoiceMatched && selectedCashVendor ? selectedCashVendor.vendorName : quickVoiceMatched && !showCashVendorSelect ? "—" : "待手動確認"}</p></div>}<div className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] text-gray-400">部門</p><p className="mt-1 text-gray-900">{quickVoiceMatched ? getDepartmentLabel(department, departments) : "待手動確認"}</p></div><div className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] text-gray-400">金額</p><p className="mt-1 text-lg font-black text-gray-950">{Number(amount) > 0 ? money(Number(amount)) : "待確認"}</p></div></div><div className={`grid gap-2 ${quickVoiceMatched ? "grid-cols-2" : "grid-cols-1"}`}>{quickVoiceMatched && <button type="button" onClick={saveEntry} disabled={!quickVoiceReadyToSave} className={`rounded-2xl px-4 py-3 text-sm font-black ${quickVoiceReadyToSave ? "bg-[#06C755] text-white" : "bg-gray-100 text-gray-400"}`}>確認記帳</button>}<button type="button" onClick={() => setQuickVoiceEditing(true)} className="rounded-2xl bg-gray-950 px-4 py-3 text-sm font-black text-white">手動修改</button></div></> : <><div className="space-y-4 rounded-2xl bg-gray-50 p-4"><Field label="日期"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><Field label="細項分類"><Select value={category} onChange={(e) => handleCategoryChange(e.target.value)}>{categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field><Field label="記帳項目">{isManualItem ? <Input value={entryItem} onChange={(e) => setEntryItem(e.target.value)} placeholder={entryType === "expense" ? "請輸入其他支出項目" : "請輸入其他收入項目"} /> : <Select value={entryItem} onChange={(e) => handleEntryItemChange(e.target.value)}>{itemOptions.map((item) => <option key={item} value={item}>{item}</option>)}</Select>}</Field>{showCashVendorSelect && <Field label="現結貨款廠商"><SearchableVendorSelect value={vendorId} onChange={handleVendorChange} vendors={cashVendors} departments={departments} placeholder="輸入現結廠商名稱或代碼搜尋" /></Field>}<Field label="歸帳部門"><Select value={department} onChange={(e) => setDepartment(e.target.value)} disabled={!isAdmin && currentUser.department !== "all"}>{availableDepartments.some((d) => d.value === department) ? null : <option value={department}>{getDepartmentLabel(department, departments)}</option>}{availableDepartments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select></Field><Field label="金額"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field><Field label="備註"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>{isAdmin && quickVoiceKeyword && ((entryType === "expense" && category === "cash_purchase" && vendorId) || (category && entryItem)) && <button type="button" onClick={rememberQuickVoiceAlias} className="w-full rounded-2xl border border-[#06C755]/30 bg-white px-4 py-3 text-sm font-black text-[#069648]">記住「{quickVoiceKeyword}」這個叫法</button>}<div className="grid grid-cols-2 gap-2"><button type="button" onClick={saveEntry} disabled={!quickVoiceReadyToSave} className={`rounded-2xl px-4 py-3 text-sm font-black ${quickVoiceReadyToSave ? "bg-[#06C755] text-white" : "bg-gray-100 text-gray-400"}`}>確認記帳</button><button type="button" onClick={() => setQuickVoiceEditing(false)} className="rounded-2xl bg-gray-100 px-4 py-3 text-sm font-black text-gray-600">取消修改</button></div></>}</div>}</Card>'''
app = app[:ui_match.start()] + ui_match.group(1) + new_ui + ui_match.group(2) + app[ui_match.end():]

# Parser: restrict matching to selected type; vendors only apply to expense.
voice = voice.replace('function findAccountingItem(keyword, categories) {', 'function findAccountingItem(keyword, categories, entryType = "") {')
voice = voice.replace('["expense", "income"].forEach((type) => {', '(entryType ? [entryType] : ["expense", "income"]).forEach((type) => {')
voice = voice.replace(
    'export function parseDailyCashQuickEntry({ transcript, vendors = [], categories = {} }) {\n  const cleanTranscript = String(transcript || "").trim();\n  const amountResult = extractTrailingAmount(cleanTranscript);\n  const keyword = amountResult.keyword;\n',
    'export function parseDailyCashQuickEntry({ transcript, vendors = [], categories = {}, entryType = "expense" }) {\n'
    '  const cleanTranscript = String(transcript || "").trim();\n'
    '  const amountResult = extractTrailingAmount(cleanTranscript);\n'
    '  const targetType = entryType === "income" ? "income" : "expense";\n'
    '  const rawKeyword = amountResult.keyword;\n'
    '  const keyword = rawKeyword.replace(targetType === "income" ? /^(收入|收款|入帳)\\s*/ : /^(支出|付款|出帳)\\s*/, "").trim() || rawKeyword;\n'
)

vendor_pattern = re.compile(r'  const cashVendors = vendors\.filter\(\(vendor\) => vendor\.type === "cash"\);.*?\n\n  const itemResult = findAccountingItem\(keyword, categories\);', re.S)
vm = vendor_pattern.search(voice)
assert vm, 'vendor matching block not found'
replacement = '''  if (targetType === "expense") {
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

  const itemResult = findAccountingItem(keyword, categories, targetType);'''
voice = voice[:vm.start()] + replacement + voice[vm.end():]

app_path.write_text(app)
voice_path.write_text(voice)
print('patched')
