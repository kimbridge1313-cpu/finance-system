from pathlib import Path

path = Path("src/App.jsx")
text = path.read_text()

replacements = []

old = 'import { getMonthDefaultRange, getSpeechRecognitionConstructor, isSpeechRecognitionSupported, parseVendorBillVoice } from "./vendorBillVoice.js";'
new = old + '\nimport { parseDailyCashQuickEntry } from "./dailyCashVoice.js";'
replacements.append((old, new, "voice parser import"))

old = '  const [successMessage, setSuccessMessage] = useState("");\n  const [expandedEntryKey, setExpandedEntryKey] = useState("");'
new = '''  const [successMessage, setSuccessMessage] = useState("");
  const [quickVoiceText, setQuickVoiceText] = useState("");
  const [quickVoiceMessage, setQuickVoiceMessage] = useState("");
  const [quickVoiceListening, setQuickVoiceListening] = useState(false);
  const [quickVoiceCandidates, setQuickVoiceCandidates] = useState([]);
  const [expandedEntryKey, setExpandedEntryKey] = useState("");'''
replacements.append((old, new, "quick voice state"))

old = '  function handleVendorChange(nextVendorId) { const selectedVendor = cashVendors.find((v) => v.id === nextVendorId); setVendorId(nextVendorId); if (selectedVendor?.department) setDepartment(selectedVendor.department); }\n  async function saveEntry() {'
new = '''  function handleVendorChange(nextVendorId) { const selectedVendor = cashVendors.find((v) => v.id === nextVendorId); setVendorId(nextVendorId); if (selectedVendor?.department) setDepartment(selectedVendor.department); }
  function applyQuickEntryResult(parsed) {
    setQuickVoiceText(parsed?.transcript || "");
    setQuickVoiceCandidates((parsed?.candidates || []).map((candidate) => ({ ...candidate, amount: parsed?.amount || 0 })));

    if (!parsed?.rule) {
      if (parsed?.status === "missing_amount") setQuickVoiceMessage("有辨識到名稱，但沒有抓到句尾金額。請說例如「三雅 2000」。");
      else if (parsed?.status === "ambiguous_vendor" || parsed?.status === "ambiguous_item") setQuickVoiceMessage("找到多個可能項目，請從下方候選選一個。");
      else if (parsed?.status === "missing_cash_purchase_category") setQuickVoiceMessage("設定裡找不到「現結貨款」分類，請先確認記帳分類設定。");
      else setQuickVoiceMessage("找不到符合的現結廠商或記帳項目，請確認設定中的名稱／語音別名。");
      return;
    }

    const targetDepartment = parsed.rule.department || department;
    if (!isAdmin && currentUser.department !== "all" && targetDepartment && targetDepartment !== currentUser.department) {
      setQuickVoiceMessage(`這筆規則屬於${getDepartmentLabel(targetDepartment, departments)}，目前帳號無法替其他部門記帳。`);
      return;
    }

    setEntryType(parsed.rule.type || "expense");
    setCategory(parsed.rule.categoryId || "");
    setEntryItem(parsed.rule.item || "");
    if (targetDepartment) setDepartment(targetDepartment);
    setVendorId(parsed.rule.vendorId || "");
    setAmount(String(parsed.amount || ""));
    setNote("");
    setQuickVoiceCandidates([]);

    const pathText = [parsed.rule.categoryLabel, parsed.rule.item, parsed.rule.vendorName, getDepartmentLabel(targetDepartment, departments)].filter(Boolean).join(" → ");
    setQuickVoiceMessage(`已帶入：${pathText}｜${money(parsed.amount)}`);
  }
  function applyQuickVoiceText(transcript = quickVoiceText) {
    const parsed = parseDailyCashQuickEntry({ transcript, vendors, categories });
    applyQuickEntryResult(parsed);
  }
  function selectQuickVoiceCandidate(candidate) {
    if (candidate.kind === "vendor") {
      const parsed = parseDailyCashQuickEntry({ transcript: `${candidate.vendor.vendorName} ${candidate.amount}`, vendors, categories });
      applyQuickEntryResult(parsed);
      return;
    }
    if (candidate.kind === "item") {
      applyQuickEntryResult({ transcript: quickVoiceText, amount: candidate.amount, status: "matched_item", rule: candidate.rule, candidates: [] });
    }
  }
  function startQuickVoiceInput() {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setQuickVoiceMessage("目前這個瀏覽器沒有提供語音辨識，可直接在輸入框打「三雅 2000」。");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-TW";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 5;
    recognition.onstart = () => {
      setQuickVoiceListening(true);
      setQuickVoiceMessage("正在聽，直接說「名稱 + 金額」。");
      setQuickVoiceCandidates([]);
    };
    recognition.onresult = (event) => {
      const result = event.results?.[0];
      const alternatives = result ? Array.from(result).map((item) => String(item.transcript || "").trim()).filter(Boolean) : [];
      const parsedResults = alternatives.map((transcript) => parseDailyCashQuickEntry({ transcript, vendors, categories }));
      const best = parsedResults.find((parsed) => parsed.rule) || parsedResults.find((parsed) => parsed.candidates?.length) || parsedResults[0];
      if (best) applyQuickEntryResult(best);
      else setQuickVoiceMessage("沒有辨識到內容，請再說一次。");
    };
    recognition.onerror = (event) => {
      setQuickVoiceMessage(`語音辨識失敗：${event.error || "unknown"}`);
    };
    recognition.onend = () => setQuickVoiceListening(false);
    recognition.start();
  }
  async function saveEntry() {'''
replacements.append((old, new, "quick voice handlers"))

old = '    setAmount("");\n    setNote("");\n    setVendorId("");\n    if (isManualItem) setEntryItem("");'
new = '''    setAmount("");
    setNote("");
    setVendorId("");
    setQuickVoiceText("");
    setQuickVoiceMessage("");
    setQuickVoiceCandidates([]);
    if (isManualItem) setEntryItem("");'''
replacements.append((old, new, "clear quick entry after save"))

old = '<PageHeader title="每日記帳" subtitle={isAdmin ? "老闆可查每天全部部門明細。" : "員工只能每日記帳與查看當日明細。"} icon={ICONS.wallet} /><Card className="space-y-5">'
new = '''<PageHeader title="每日記帳" subtitle={isAdmin ? "老闆可查每天全部部門明細。" : "員工只能每日記帳與查看當日明細。"} icon={ICONS.wallet} /><Card className="space-y-4 border border-[#06C755]/20 bg-[#06C755]/5"><div><p className="text-lg font-black text-gray-950">快速語音記帳</p><p className="mt-1 text-xs font-bold leading-5 text-gray-500">一句只說「名稱 + 金額」。先找現結廠商，找不到再從設定的記帳項目比對。</p></div><div className="grid grid-cols-[1fr_96px] gap-2"><Input value={quickVoiceText} onChange={(e) => setQuickVoiceText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") applyQuickVoiceText(); }} placeholder="例如：三雅 2000、好市多 3000" /><button type="button" onClick={startQuickVoiceInput} disabled={quickVoiceListening} className={`rounded-2xl px-3 py-3 text-sm font-black ${quickVoiceListening ? "bg-red-500 text-white" : "bg-[#06C755] text-white"}`}>{quickVoiceListening ? "聽取中…" : "🎙 說一筆"}</button></div><button type="button" onClick={() => applyQuickVoiceText()} className="w-full rounded-2xl bg-gray-950 px-4 py-3 text-sm font-black text-white">套用文字</button>{quickVoiceMessage && <div className="rounded-2xl bg-white p-3 text-sm font-bold leading-6 text-gray-700">{quickVoiceMessage}</div>}{quickVoiceCandidates.length > 0 && <div className="flex flex-wrap gap-2">{quickVoiceCandidates.map((candidate, index) => <button key={`${candidate.kind}_${index}`} type="button" onClick={() => selectQuickVoiceCandidate(candidate)} className="rounded-full border border-[#06C755]/30 bg-white px-3 py-2 text-xs font-black text-[#069648]">{candidate.kind === "vendor" ? candidate.vendor.vendorName : `${candidate.rule.categoryLabel}｜${candidate.rule.item}`}</button>)}</div>}<p className="text-[11px] font-bold leading-5 text-gray-400">辨識後會先帶入下方表單，確認分類、部門與金額後再儲存。</p></Card><Card className="space-y-5">'''
replacements.append((old, new, "quick voice UI"))

for old, new, label in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    text = text.replace(old, new, 1)

path.write_text(text)
print("patched src/App.jsx")
