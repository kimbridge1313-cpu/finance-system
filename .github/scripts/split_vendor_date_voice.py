from pathlib import Path
import re

path = Path('src/App.jsx')
app = path.read_text()

app = app.replace('const [voiceListening, setVoiceListening] = useState(false);', 'const [voiceListening, setVoiceListening] = useState("");', 1)

pattern = re.compile(r'  function applyVoiceTranscript\(transcript\) \{.*?\n  async function saveBill\(\)', re.S)
replacement = r'''  function applyVendorVoiceTranscripts(transcripts = []) {
    const alternatives = transcripts.map((item) => String(item || "").trim()).filter(Boolean);
    if (!alternatives.length) {
      setVoiceMessage("沒有聽到廠商名稱，請再試一次。");
      return;
    }

    let chosen = null;
    let fallback = null;
    for (const transcript of alternatives) {
      const result = parseVendorBillVoice({ transcript, billMonth: form.billMonth, vendors: monthlyVendors });
      if (!fallback) fallback = result;
      if (result.vendor?.id) {
        chosen = result;
        break;
      }
      if (!chosen && (result.candidates || []).length) chosen = result;
    }

    const result = chosen || fallback;
    setVoiceTranscript(alternatives.join(" ／ "));
    setVoiceCandidates(result?.candidates || []);
    setVoicePhrase(result?.voicePhrase || alternatives[0]);

    if (result?.vendor?.id) {
      updateForm("vendorId", result.vendor.id);
      setVoiceMessage(`已辨識廠商：${result.vendor.vendorCode ? `${result.vendor.vendorCode}｜` : ""}${result.vendor.vendorName}`);
    } else {
      updateForm("vendorId", "");
      setVoiceMessage("沒有直接找到廠商。請從下方手動選正確廠商，再按「記住這個叫法」，下次會優先匹配。");
    }
  }

  function applyDateVoiceTranscript(transcript) {
    const result = parseVendorBillVoice({ transcript, billMonth: form.billMonth, vendors: [] });
    setVoiceTranscript(result.transcript);
    setVoiceCandidates([]);
    setVoicePhrase("");
    if (result.startDate) updateForm("startDate", result.startDate);
    if (result.endDate) updateForm("endDate", result.endDate);

    if (result.startDate && result.endDate) {
      setVoiceMessage(`已帶入日期：${result.startDate} ～ ${result.endDate}`);
    } else if (result.startDate) {
      setVoiceMessage(`已帶入開始日期：${result.startDate}`);
    } else if (result.endDate) {
      setVoiceMessage(`已帶入結束日期：${result.endDate}`);
    } else {
      setVoiceMessage("沒有辨識到日期，請說例如「7月26號到8月25號」。");
    }
  }

  function startVoiceInput(mode) {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setVoiceMessage("目前這個瀏覽器不支援語音辨識，請改用手動輸入。");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-TW";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = mode === "vendor" ? 5 : 1;

    if (mode === "vendor") {
      const vendorTerms = [...new Set(monthlyVendors.flatMap((vendor) => [
        vendor.vendorName,
        ...(Array.isArray(vendor.voiceAliases) ? vendor.voiceAliases : []),
      ]).map((item) => String(item || "").trim()).filter(Boolean))];

      try {
        const SpeechRecognitionPhrase = window.SpeechRecognitionPhrase;
        if (SpeechRecognitionPhrase && "phrases" in recognition && vendorTerms.length) {
          recognition.phrases = vendorTerms.slice(0, 100).map((term) => new SpeechRecognitionPhrase(term, 10.0));
        }
      } catch (error) {
        console.warn("Speech phrase bias unavailable", error);
      }
    }

    recognition.onstart = () => {
      setVoiceListening(mode);
      setVoiceTranscript("");
      setVoiceCandidates([]);
      setVoiceMessage(mode === "vendor" ? "正在聽，現在只要說廠商名稱。" : "正在聽，現在只要說開始與結束日期。");
    };
    recognition.onresult = (event) => {
      const result = event.results?.[0];
      if (mode === "vendor") {
        const alternatives = result ? Array.from({ length: result.length }, (_, index) => result[index]?.transcript || "") : [];
        applyVendorVoiceTranscripts(alternatives);
      } else {
        applyDateVoiceTranscript(result?.[0]?.transcript || "");
      }
    };
    recognition.onerror = (event) => {
      const permissionDenied = event.error === "not-allowed" || event.error === "service-not-allowed";
      setVoiceMessage(permissionDenied ? "麥克風權限未開啟，請允許麥克風後再試一次。" : `語音辨識失敗：${event.error || "unknown"}`);
    };
    recognition.onend = () => setVoiceListening("");

    try {
      recognition.start();
    } catch (error) {
      setVoiceListening("");
      setVoiceMessage(`無法啟動語音辨識：${error?.message || "unknown"}`);
    }
  }

  async function saveBill()'''
app, count = pattern.subn(replacement, app, count=1)
if count != 1:
    raise SystemExit(f'voice function block replacement failed: {count}')

start_marker = '<div className="rounded-3xl bg-[#06C755]/10 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-black text-gray-950">語音快速帶入</p>'
start = app.find(start_marker)
if start < 0:
    raise SystemExit('voice UI start not found')
end_marker = '<Field label="月結廠商">'
end = app.find(end_marker, start)
if end < 0:
    raise SystemExit('vendor field marker not found')

new_ui = '''<div className="rounded-3xl bg-[#06C755]/10 p-4"><div><p className="font-black text-gray-950">語音快速帶入</p><p className="mt-1 text-xs font-bold leading-5 text-gray-500">廠商與日期分開說，避免專有名稱與日期互相干擾。</p></div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => startVoiceInput("vendor")} disabled={Boolean(voiceListening) || !speechSupported} className={`rounded-2xl px-3 py-3 text-sm font-black ${voiceListening === "vendor" ? "bg-red-500 text-white" : speechSupported ? "bg-[#06C755] text-white" : "bg-gray-200 text-gray-400"}`}>{voiceListening === "vendor" ? "聽廠商中…" : "🎙 辨識廠商"}</button><button type="button" onClick={() => startVoiceInput("date")} disabled={Boolean(voiceListening) || !speechSupported} className={`rounded-2xl px-3 py-3 text-sm font-black ${voiceListening === "date" ? "bg-red-500 text-white" : speechSupported ? "bg-gray-950 text-white" : "bg-gray-200 text-gray-400"}`}>{voiceListening === "date" ? "聽日期中…" : "🎙 辨識日期"}</button></div>{!speechSupported && <p className="mt-3 rounded-2xl bg-white/80 p-3 text-xs font-bold leading-5 text-gray-500">目前這個瀏覽器沒有提供語音辨識；仍可使用下方手動搜尋與日期輸入。</p>}{voiceTranscript && <div className="mt-3 rounded-2xl bg-white/80 p-3"><p className="text-[11px] font-black uppercase tracking-wider text-gray-400">這次聽到</p><p className="mt-1 text-sm font-bold text-gray-700">{voiceTranscript}</p></div>}{voiceMessage && <p className="mt-3 text-xs font-black leading-5 text-[#069648]">{voiceMessage}</p>}{voiceCandidates.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{voiceCandidates.map((vendor) => <button key={vendor.id} type="button" onClick={() => selectVoiceVendor(vendor)} className="rounded-full border border-[#06C755]/30 bg-white px-3 py-2 text-xs font-black text-[#069648]">{vendor.vendorCode ? `${vendor.vendorCode}｜` : ""}{vendor.vendorName}</button>)}</div>}</div>'''
app = app[:start] + new_ui + app[end:]

path.write_text(app)
