from pathlib import Path

path = Path("src/App.jsx")
app = path.read_text()

old = '''    setVoiceTranscript(result.transcript);
    setVoiceCandidates(result.candidates || []);
    setVoicePhrase(result.voicePhrase || "");

    const applied = [];
'''
new = '''    setVoiceTranscript(result.transcript);
    setVoiceCandidates(result.candidates || []);
    setVoicePhrase(result.voicePhrase || "");
    if (result.voicePhrase && !result.vendor?.id && !(result.candidates || []).length) {
      updateForm("vendorId", "");
    }

    const applied = [];
'''
if old not in app:
    raise SystemExit("voice result marker not found")
app = app.replace(old, new, 1)

old2 = '''    recognition.lang = "zh-TW";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
'''
new2 = '''    recognition.lang = "zh-TW";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    try {
      const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
      const vendorTerms = monthlyVendors.flatMap((vendor) => [vendor.vendorName, ...(Array.isArray(vendor.voiceAliases) ? vendor.voiceAliases : [])]).map((item) => String(item || "").trim().replace(/[;|=<>]/g, "")).filter(Boolean);
      if (SpeechGrammarList && vendorTerms.length) {
        const grammarList = new SpeechGrammarList();
        grammarList.addFromString(`#JSGF V1.0; grammar vendors; public <vendor> = ${vendorTerms.join(" | ")} ;`, 1);
        recognition.grammars = grammarList;
      }
    } catch {
      // Some Web Speech implementations ignore custom grammar; alias matching still works after transcription.
    }
'''
if old2 not in app:
    raise SystemExit("speech setup marker not found")
app = app.replace(old2, new2, 1)

path.write_text(app)
