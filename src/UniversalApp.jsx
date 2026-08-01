import React, { useEffect, useMemo, useState } from "react";
import liff from "@line/liff";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, getIdToken, signInWithCustomToken } from "firebase/auth";
import App from "./App.jsx";

const runtimeEnv = import.meta.env;
const firebaseConfig = {
  apiKey: runtimeEnv.VITE_FIREBASE_API_KEY,
  authDomain: runtimeEnv.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: runtimeEnv.VITE_FIREBASE_PROJECT_ID,
  storageBucket: runtimeEnv.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: runtimeEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: runtimeEnv.VITE_FIREBASE_APP_ID,
};

const LIFF_ID = runtimeEnv.VITE_LINE_LIFF_ID;
const AUTH_ENDPOINT = runtimeEnv.VITE_AUTH_ENDPOINT || "/api/auth";
const BOOTSTRAP_ENDPOINT = runtimeEnv.VITE_BOOTSTRAP_ENDPOINT || "/api/bootstrap";
const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

let sessionPromise = null;

function Button({ children, disabled = false, ...props }) {
  return <button {...props} disabled={disabled} className="w-full rounded-2xl bg-[#06C755] px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{children}</button>;
}

function Input({ className = "", ...props }) {
  return <input {...props} className={`block w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[15px] outline-none transition focus:border-[#06C755] focus:ring-4 focus:ring-[#06C755]/10 ${className}`} />;
}

function Select({ children, ...props }) {
  return <select {...props} className="block w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[15px] outline-none transition focus:border-[#06C755] focus:ring-4 focus:ring-[#06C755]/10">{children}</select>;
}

function Field({ label, children }) {
  return <label className="block"><span className="text-sm font-bold text-gray-700">{label}</span><div className="mt-2">{children}</div></label>;
}

function Shell({ systemName = "企業財務系統", eyebrow = "Universal Deployment", children }) {
  return <div className="min-h-screen bg-[#F6F8FA] p-4 text-gray-950"><main className="mx-auto max-w-xl pt-10"><section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-gray-100"><p className="text-xs font-black uppercase tracking-widest text-[#06C755]">{eyebrow}</p><h1 className="mt-2 text-3xl font-black">{systemName}</h1>{children}</section></main></div>;
}

async function callJson(url, body, firebaseIdToken = "") {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(firebaseIdToken ? { Authorization: `Bearer ${firebaseIdToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
  return payload;
}

async function createSession() {
  if (!LIFF_ID) throw new Error("尚未設定 VITE_LINE_LIFF_ID。");

  await liff.init({ liffId: LIFF_ID });
  if (!liff.isLoggedIn()) {
    liff.login();
    return null;
  }

  const lineIdToken = liff.getIDToken();
  if (!lineIdToken) {
    throw new Error("無法取得 LINE ID Token，請確認 LIFF 已啟用 openid scope。");
  }

  const authResult = await callJson(AUTH_ENDPOINT, { idToken: lineIdToken });
  const credential = await signInWithCustomToken(auth, authResult.token);
  const firebaseIdToken = await getIdToken(credential.user, true);
  const status = await callJson(BOOTSTRAP_ENDPOINT, { action: "status" }, firebaseIdToken);

  return {
    firebaseIdToken,
    profile: authResult.profile || {},
    status,
  };
}

function getSession() {
  if (!sessionPromise) {
    sessionPromise = createSession().catch((error) => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

function SetupScreen({ session, onComplete }) {
  const defaultName = session.profile?.displayName || "管理者";
  const [systemName, setSystemName] = useState("企業財務系統");
  const [adminName, setAdminName] = useState(defaultName);
  const [departments, setDepartments] = useState(["主要部門"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateDepartment(index, value) {
    setDepartments((previous) => previous.map((item, itemIndex) => itemIndex === index ? value : item));
  }

  function addDepartment() {
    setDepartments((previous) => [...previous, ""]);
  }

  function removeDepartment(index) {
    setDepartments((previous) => previous.length > 1 ? previous.filter((_, itemIndex) => itemIndex !== index) : previous);
  }

  async function submit(event) {
    event.preventDefault();
    const cleanDepartments = departments.map((item) => item.trim()).filter(Boolean);
    if (!systemName.trim() || !adminName.trim() || !cleanDepartments.length) return;

    setSaving(true);
    setError("");
    try {
      const result = await callJson(BOOTSTRAP_ENDPOINT, {
        action: "initialize",
        systemName: systemName.trim(),
        adminName: adminName.trim(),
        departments: cleanDepartments,
      }, session.firebaseIdToken);
      onComplete(result);
    } catch (submitError) {
      setError(submitError.message || "初始化失敗");
    } finally {
      setSaving(false);
    }
  }

  return <Shell systemName={systemName || "企業財務系統"} eyebrow="首次部署初始化"><p className="mt-3 text-sm leading-6 text-gray-500">這個 Firebase 尚未建立公司設定。完成後，目前經 LINE 驗證的帳號會成為第一位管理者。</p><form onSubmit={submit} className="mt-6 space-y-4"><Field label="系統名稱"><Input value={systemName} onChange={(event) => setSystemName(event.target.value)} maxLength={80} /></Field><Field label="管理者姓名"><Input value={adminName} onChange={(event) => setAdminName(event.target.value)} maxLength={80} /></Field><div><div className="flex items-center justify-between"><span className="text-sm font-bold text-gray-700">部門</span><button type="button" onClick={addDepartment} className="rounded-full bg-[#06C755]/10 px-3 py-2 text-xs font-black text-[#06C755]">新增部門</button></div><div className="mt-2 space-y-2">{departments.map((department, index) => <div key={index} className="grid grid-cols-[1fr_48px] gap-2"><Input value={department} onChange={(event) => updateDepartment(index, event.target.value)} placeholder={`部門 ${index + 1}`} maxLength={40} /><button type="button" onClick={() => removeDepartment(index)} className="rounded-2xl bg-red-50 font-black text-red-500" disabled={departments.length === 1}>×</button></div>)}</div></div>{error && <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-500">{error}</p>}<Button type="submit" disabled={saving}>{saving ? "建立中…" : "建立系統"}</Button></form></Shell>;
}

function JoinScreen({ session, status, onSubmitted }) {
  const departments = status.departments || [];
  const [name, setName] = useState(session.profile?.displayName || "");
  const [department, setDepartment] = useState(departments[0]?.value || "");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await callJson(BOOTSTRAP_ENDPOINT, {
        action: "join",
        name: name.trim(),
        department,
      }, session.firebaseIdToken);
      setSubmitted(true);
      onSubmitted?.();
    } catch (submitError) {
      setError(submitError.message || "送出申請失敗");
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return <Shell systemName={status.appSettings?.systemName} eyebrow="加入申請"><p className="mt-5 rounded-2xl bg-[#06C755]/10 p-4 text-sm font-bold leading-6 text-[#06C755]">加入申請已送出，請等待管理者核准。</p></Shell>;
  }

  return <Shell systemName={status.appSettings?.systemName} eyebrow="加入系統"><p className="mt-3 text-sm leading-6 text-gray-500">你的 LINE 帳號尚未建立員工權限，請送出申請。</p><form onSubmit={submit} className="mt-6 space-y-4"><Field label="姓名"><Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} /></Field><Field label="申請部門"><Select value={department} onChange={(event) => setDepartment(event.target.value)}>{departments.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>{error && <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-500">{error}</p>}<Button type="submit" disabled={saving || !departments.length}>{saving ? "送出中…" : "送出加入申請"}</Button></form></Shell>;
}

export default function UniversalApp() {
  const [state, setState] = useState({ loading: true, error: "", session: null, status: null });

  useEffect(() => {
    let mounted = true;
    getSession()
      .then((session) => {
        if (!mounted || !session) return;
        setState({ loading: false, error: "", session, status: session.status });
      })
      .catch((error) => {
        if (!mounted) return;
        setState({ loading: false, error: error.message || "系統啟動失敗", session: null, status: null });
      });
    return () => { mounted = false; };
  }, []);

  const systemName = useMemo(() => state.status?.appSettings?.systemName || "企業財務系統", [state.status]);

  useEffect(() => {
    document.title = systemName;
  }, [systemName]);

  if (state.loading) return <Shell systemName="企業財務系統" eyebrow="Secure Bootstrap"><p className="mt-5 font-bold text-gray-500">正在驗證 LINE 與部署設定…</p></Shell>;
  if (state.error) return <Shell systemName="企業財務系統" eyebrow="啟動失敗"><p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold leading-6 text-red-500">{state.error}</p></Shell>;
  if (state.status?.setupRequired) return <SetupScreen session={state.session} onComplete={(status) => setState((previous) => ({ ...previous, status }))} />;
  if (!state.status?.appUser) return <JoinScreen session={state.session} status={state.status} />;

  return <App systemName={systemName} />;
}
