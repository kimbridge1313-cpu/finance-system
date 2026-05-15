import React, { useEffect, useMemo, useState } from "react";
import liff from "@line/liff";
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, signInWithCustomToken } from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDolam_OIhFPGFlgibKcs1U8gr6KQXfplg",
  authDomain: "finance-system-52d62.firebaseapp.com",
  projectId: "finance-system-52d62",
  storageBucket: "finance-system-52d62.firebasestorage.app",
  messagingSenderId: "517046288884",
  appId: "1:517046288884:web:20f6b4af7f44bcef1479a1",
};

// 拿到 LINE Developers 的 LIFF ID 後，只改這一行。
const LIFF_ID = "請填入_LINE_LIFF_ID";

const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

const GREEN = "#06C755";
const PIE_COLORS = ["#06C755", "#00A5FF", "#FFB020", "#8B5CF6"];
const DEFAULT_DEPARTMENTS = [
  { value: "bakery", label: "烘焙部" },
  { value: "supermarket", label: "超市部" },
  { value: "lottery", label: "台彩部" },
];
const DEFAULT_CATEGORIES = {
  expense: [
    { id: "cash_purchase", label: "現結貨款", items: ["原物料進貨", "包材耗材", "飲料食品貨款", "彩券相關支出"] },
    { id: "operating_expense", label: "營運支出", items: ["水電瓦斯", "設備維修", "清潔用品", "廣告行銷"] },
    { id: "staff_expense", label: "人事支出", items: ["薪資", "獎金", "員工餐費", "加班費"] },
    { id: "other_expense", label: "其他支出", items: [] },
  ],
  income: [
    { id: "cash_revenue", label: "現金收入", items: ["門市現金", "外送現金", "市集現金"] },
    { id: "transfer_revenue", label: "轉帳收入", items: ["銀行轉帳", "LINE Pay", "信用卡"] },
    { id: "other_revenue", label: "其他收入", items: [] },
  ],
};

function today() { return new Date().toISOString().slice(0, 10); }
function monthNow() { return new Date().toISOString().slice(0, 7); }
function money(v) { return `$${Number(v || 0).toLocaleString()}`; }
function deptLabel(value, departments) { if (value === "all") return "全部部門"; return departments.find((d) => d.value === value)?.label || value; }
function csv(rows) { return rows.map((r) => r.map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`).join(",")).join("\n"); }
function downloadCsv(name, rows) { const href = `data:text/csv;charset=utf-8,${encodeURIComponent("\uFEFF" + csv(rows))}`; const a = document.createElement("a"); a.href = href; a.download = name.replace(/[\\/:*?"<>|]/g, "_"); document.body.appendChild(a); a.click(); document.body.removeChild(a); }
function categoryById(type, id) { return DEFAULT_CATEGORIES[type].find((c) => c.id === id); }

async function readCollection(name) { const snap = await getDocs(collection(db, name)); return snap.docs.map((d) => ({ id: d.id, ...d.data() })); }

async function lineLogin() {
  if (!LIFF_ID || LIFF_ID === "請填入_LINE_LIFF_ID") throw new Error("尚未設定 LIFF ID：請在 src/App.jsx 修改 LIFF_ID。Firebase 設定已寫入。 ");
  await liff.init({ liffId: LIFF_ID });
  if (!liff.isLoggedIn()) { liff.login(); return null; }
  const profile = await liff.getProfile();
  const lineUserId = profile.userId;
  const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lineUserId }) });
  if (!res.ok) throw new Error(`登入 API 失敗：${await res.text()}`);
  const { token } = await res.json();
  await signInWithCustomToken(auth, token);
  const userSnap = await getDoc(doc(db, "users", lineUserId));
  return { lineUserId, profile, user: userSnap.exists() ? { id: lineUserId, ...userSnap.data() } : null };
}

function Card({ children, className = "" }) { return <section className={`rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-gray-100 ${className}`}>{children}</section>; }
function Field({ label, children }) { return <label className="block"><span className="text-sm font-bold text-gray-700">{label}</span><div className="mt-2">{children}</div></label>; }
function Input(props) { return <input {...props} className={`w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-line focus:ring-4 focus:ring-line/10 ${props.className || ""}`} />; }
function Select({ children, ...props }) { return <select {...props} className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-line focus:ring-4 focus:ring-line/10">{children}</select>; }
function Button({ children, tone = "green", ...props }) { const bg = tone === "red" ? "bg-red-500" : tone === "gray" ? "bg-gray-700" : "bg-line"; return <button {...props} className={`${bg} w-full rounded-2xl px-4 py-3 font-black text-white active:scale-[0.99]`}>{children}</button>; }
function Header({ title, sub }) { return <div className="mb-5"><h1 className="text-2xl font-black">{title}</h1><p className="mt-1 text-sm text-gray-500">{sub}</p></div>; }

function Nav({ page, setPage, isAdmin }) {
  const items = [{ id: "daily", label: "每日", ok: true }, { id: "reports", label: "報表", ok: isAdmin }, { id: "fixed", label: "固定", ok: isAdmin }, { id: "bills", label: "月結", ok: isAdmin }, { id: "settings", label: "設定", ok: isAdmin }].filter((i) => i.ok);
  return <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-white/95"><div className="mx-auto grid h-[68px] max-w-xl" style={{ gridTemplateColumns: `repeat(${items.length},1fr)` }}>{items.map((i) => <button key={i.id} onClick={() => setPage(i.id)} className={`text-xs font-black ${page === i.id ? "text-line" : "text-gray-400"}`}>{i.label}</button>)}</div></nav>;
}

function LoginScreen({ authState }) {
  return <div className="min-h-screen bg-[#F6F8FA] p-4"><main className="mx-auto max-w-xl pt-12"><Card><p className="text-xs font-black uppercase tracking-widest text-line">Enterprise Finance</p><h1 className="mt-2 text-3xl font-black">企業財務系統</h1><p className="mt-3 text-sm leading-6 text-gray-500">正式登入會抓 LINE userId，並讀取 Firestore 的 users/{'{lineUserId}'}。</p>{authState.loading && <p className="mt-5 font-bold text-gray-500">登入檢查中...</p>}{authState.error && <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-500">{authState.error}</p>}{authState.lineUserId && !authState.user && <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-700">已取得 LINE userId：{authState.lineUserId}<br />但 Firestore 尚未建立 users/{authState.lineUserId}</p>}</Card></main></div>;
}

function DailyPage({ user, departments, vendors, dailyCash, setDailyCash }) {
  const defaultDept = user.department === "all" ? departments[0]?.value : user.department;
  const [date, setDate] = useState(today());
  const [queryDate, setQueryDate] = useState(today());
  const [department, setDepartment] = useState(defaultDept);
  const [type, setType] = useState("expense");
  const [categoryId, setCategoryId] = useState("cash_purchase");
  const [item, setItem] = useState("原物料進貨");
  const [vendorId, setVendorId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [editId, setEditId] = useState("");
  const isAdmin = user.role === "admin";
  const cats = DEFAULT_CATEGORIES[type];
  const cat = categoryById(type, categoryId);
  const manual = categoryId === "other_expense" || categoryId === "other_revenue";
  const cashVendors = vendors.filter((v) => v.type === "cash");

  function switchType(next) { const first = DEFAULT_CATEGORIES[next][0]; setType(next); setCategoryId(first.id); setItem(first.items[0] || ""); }
  function switchCategory(nextId) { const next = DEFAULT_CATEGORIES[type].find((c) => c.id === nextId); setCategoryId(nextId); setItem(nextId.includes("other") ? "" : next?.items[0] || ""); }
  function chooseVendor(id) { const v = cashVendors.find((x) => x.id === id); setVendorId(id); if (v?.department) setDepartment(v.department); }
  async function save() { const v = cashVendors.find((x) => x.id === vendorId); const record = { date, type, categoryId, category: cat?.label || "", item, vendorId: categoryId === "cash_purchase" ? vendorId : "", vendorName: categoryId === "cash_purchase" ? v?.vendorName || "" : "", department, amount: Number(amount || 0), note, updatedAt: serverTimestamp(), createdBy: user.id }; const id = editId || `${date}_${department}_${Date.now()}`; await setDoc(doc(db, "dailyCash", id), record, { merge: true }); setDailyCash((prev) => [{ id, ...record }, ...prev.filter((r) => r.id !== id)]); setEditId(""); setAmount(""); setNote(""); }
  async function remove(id) { await deleteDoc(doc(db, "dailyCash", id)); setDailyCash((prev) => prev.filter((r) => r.id !== id)); }
  function edit(r) { setEditId(r.id); setDate(r.date); setType(r.type); setCategoryId(r.categoryId); setItem(r.item); setVendorId(r.vendorId || ""); setDepartment(r.department); setAmount(String(r.amount || "")); setNote(r.note || ""); }
  const records = dailyCash.filter((r) => isAdmin ? r.date === queryDate : r.date === date && r.department === department);

  return <div><Header title="每日記帳" sub={isAdmin ? "老闆可查詢全部部門現金帳明細。" : "員工只能看自己部門當日明細。"} /><Card className="space-y-4"><div className="grid grid-cols-2 rounded-2xl border border-line p-1"><button onClick={() => switchType("expense")} className={`rounded-xl py-3 font-black ${type === "expense" ? "bg-red-500 text-white" : "text-red-500"}`}>支出</button><button onClick={() => switchType("income")} className={`rounded-xl py-3 font-black ${type === "income" ? "bg-line text-white" : "text-line"}`}>收入</button></div><Field label="日期"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><Field label="細項分類"><Select value={categoryId} onChange={(e) => switchCategory(e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field><Field label="記帳項目">{manual ? <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="手動輸入" /> : <Select value={item} onChange={(e) => setItem(e.target.value)}>{(cat?.items || []).map((x) => <option key={x}>{x}</option>)}</Select>}</Field>{type === "expense" && categoryId === "cash_purchase" && <Field label="現結貨款廠商"><Select value={vendorId} onChange={(e) => chooseVendor(e.target.value)}><option value="">請選擇</option>{cashVendors.map((v) => <option key={v.id} value={v.id}>{v.vendorCode}｜{v.vendorName}｜{deptLabel(v.department, departments)}</option>)}</Select></Field>}<Field label="歸帳部門"><Select value={department} onChange={(e) => setDepartment(e.target.value)} disabled={!isAdmin && user.department !== "all"}>{departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select></Field><Field label="金額"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field><Field label="備註"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field><Button onClick={save}>{editId ? "儲存修改" : "儲存本筆記帳"}</Button></Card><Card className="mt-5 overflow-hidden p-0"><div className="border-b p-5"><h2 className="font-black">{isAdmin ? "現金帳明細" : "當日明細"}</h2>{isAdmin && <div className="mt-3"><Field label="查詢日期"><Input type="date" value={queryDate} onChange={(e) => setQueryDate(e.target.value)} /></Field></div>}</div><div className="divide-y">{records.map((r) => <div key={r.id} className="p-4"><div className="flex justify-between gap-3"><div><p className="text-xs font-black text-gray-400">{deptLabel(r.department, departments)}｜{r.category}</p><p className="mt-1 font-black">{r.item}</p>{r.vendorName && <p className="text-xs font-bold text-line">廠商：{r.vendorName}</p>}</div><div className="text-right"><p className={`font-black ${r.type === "income" ? "text-line" : "text-red-500"}`}>{money(r.amount)}</p><div className="mt-2 flex gap-2"><button className="text-xs font-black text-gray-500" onClick={() => edit(r)}>編輯</button><button className="text-xs font-black text-red-500" onClick={() => remove(r.id)}>刪除</button></div></div></div></div>)}{records.length === 0 && <p className="p-5 text-sm font-bold text-gray-400">尚無明細。</p>}</div></Card></div>;
}

function FixedPage({ departments, fixedRecords, setFixedRecords }) {
  const [month, setMonth] = useState(monthNow()); const [department, setDepartment] = useState(departments[0]?.value || "bakery"); const [items, setItems] = useState([{ label: "租金", amount: "" }]);
  async function save() { const id = `${month}_${department}`; const record = { month, department, items: items.filter((i) => i.label).map((i) => ({ label: i.label, amount: Number(i.amount || 0) })), updatedAt: serverTimestamp() }; await setDoc(doc(db, "monthlyFixed", id), record, { merge: true }); setFixedRecords((prev) => [{ id, ...record }, ...prev.filter((r) => r.id !== id)]); }
  async function remove(id) { await deleteDoc(doc(db, "monthlyFixed", id)); setFixedRecords((prev) => prev.filter((r) => r.id !== id)); }
  function edit(r) { setMonth(r.month); setDepartment(r.department); setItems(r.items || []); }
  return <div><Header title="月固定支出" sub="每月設定會保留紀錄，可修改或刪除。" /><Card className="space-y-4"><Field label="月份"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field><Field label="部門"><Select value={department} onChange={(e) => setDepartment(e.target.value)}>{departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select></Field>{items.map((item, i) => <div key={i} className="grid grid-cols-[1fr_110px_40px] gap-2"><Input value={item.label} onChange={(e) => setItems((p) => p.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} /><Input type="number" value={item.amount} onChange={(e) => setItems((p) => p.map((x, idx) => idx === i ? { ...x, amount: e.target.value } : x))} /><button onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))} className="rounded-2xl bg-red-50 text-red-500">×</button></div>)}<div className="grid grid-cols-2 gap-2"><Button tone="gray" onClick={() => setItems((p) => [...p, { label: "", amount: "" }])}>新增項目</Button><Button onClick={save}>儲存設定</Button></div></Card><Card className="mt-5 overflow-hidden p-0"><div className="border-b p-5 font-black">固定支出紀錄</div><div className="divide-y">{fixedRecords.map((r) => <div key={r.id} className="flex justify-between p-4"><div><p className="font-black">{r.month}｜{deptLabel(r.department, departments)}</p><p className="text-xs text-gray-400">合計 {money((r.items || []).reduce((s, i) => s + Number(i.amount || 0), 0))}</p></div><div className="flex gap-2"><button onClick={() => edit(r)} className="text-xs font-black text-gray-500">編輯</button><button onClick={() => remove(r.id)} className="text-xs font-black text-red-500">刪除</button></div></div>)}</div></Card></div>;
}

function BillsPage({ departments, vendors, vendorBills, setVendorBills }) {
  const monthlyVendors = vendors.filter((v) => v.type === "monthly"); const defaultVendor = monthlyVendors[0]; const [form, setForm] = useState({ vendorId: defaultVendor?.id || "", startDate: `${monthNow()}-01`, endDate: `${monthNow()}-31`, billTotal: "", paymentMethod: "現金", checkNumber: "", ticketStatus: "none", note: "" }); const [filterMonth, setFilterMonth] = useState(monthNow()); const [filterDepartment, setFilterDepartment] = useState("all"); const [ticketFilter, setTicketFilter] = useState("all");
  const selectedVendor = monthlyVendors.find((v) => v.id === form.vendorId);
  async function save() { if (!selectedVendor) return; const id = `bill_${Date.now()}`; const record = { vendorId: selectedVendor.id, vendorCode: selectedVendor.vendorCode, vendorName: selectedVendor.vendorName, department: selectedVendor.department, deductPercent: Number(selectedVendor.deductPercent || 0), ...form, billTotal: Number(form.billTotal || 0), ticketStatus: form.paymentMethod === "支票" ? form.ticketStatus || "pending" : "none", checkNumber: form.paymentMethod === "支票" ? form.checkNumber : "", createdAt: serverTimestamp() }; await setDoc(doc(db, "vendorBills", id), record); setVendorBills((prev) => [{ id, ...record }, ...prev]); }
  async function remove(id) { await deleteDoc(doc(db, "vendorBills", id)); setVendorBills((prev) => prev.filter((r) => r.id !== id)); }
  async function toggle(r) { const next = (r.ticketStatus || "pending") === "arrived" ? "pending" : "arrived"; await setDoc(doc(db, "vendorBills", r.id), { ticketStatus: next }, { merge: true }); setVendorBills((p) => p.map((x) => x.id === r.id ? { ...x, ticketStatus: next } : x)); }
  const filtered = vendorBills.filter((b) => (!filterMonth || String(b.startDate || "").slice(0, 7) === filterMonth) && (filterDepartment === "all" || b.department === filterDepartment) && (ticketFilter === "all" || (b.paymentMethod === "支票" ? b.ticketStatus || "pending" : "none") === ticketFilter));
  function exportBills() { downloadCsv(`月結帳單_${filterMonth}_${filterDepartment}.csv`, [["廠編", "廠商", "部門", "總額", "領款", "票號", "到票"], ...filtered.map((b) => [b.vendorCode, b.vendorName, deptLabel(b.department, departments), b.billTotal, b.paymentMethod, b.checkNumber, b.paymentMethod === "支票" ? ((b.ticketStatus || "pending") === "arrived" ? "已到票" : "未到票") : "不適用"])]); }
  return <div><Header title="月結帳單" sub="月結廠商、支票到票與帳單輸出。" /><Card className="space-y-4"><Field label="月結廠商"><Select value={form.vendorId} onChange={(e) => setForm((p) => ({ ...p, vendorId: e.target.value }))}>{monthlyVendors.map((v) => <option key={v.id} value={v.id}>{v.vendorCode}｜{v.vendorName}｜{deptLabel(v.department, departments)}</option>)}</Select></Field><div className="grid grid-cols-2 gap-2"><Field label="開始日期"><Input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} /></Field><Field label="結束日期"><Input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} /></Field></div><Field label="帳單總額"><Input type="number" value={form.billTotal} onChange={(e) => setForm((p) => ({ ...p, billTotal: e.target.value }))} /></Field><Field label="領款方式"><Select value={form.paymentMethod} onChange={(e) => setForm((p) => ({ ...p, paymentMethod: e.target.value, ticketStatus: e.target.value === "支票" ? "pending" : "none" }))}><option>現金</option><option>支票</option></Select></Field>{form.paymentMethod === "支票" && <Field label="支票號碼"><Input value={form.checkNumber} onChange={(e) => setForm((p) => ({ ...p, checkNumber: e.target.value }))} /></Field>}<Button onClick={save}>新增月結帳單</Button></Card><Card className="mt-5 overflow-hidden p-0"><div className="border-b p-5"><div className="flex justify-between"><h2 className="font-black">月結帳單清單</h2><button onClick={exportBills} className="text-xs font-black text-line">輸出檔案</button></div><div className="mt-4 grid grid-cols-2 gap-2"><Field label="月份"><Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} /></Field><Field label="部門"><Select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}><option value="all">全部</option>{departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select></Field></div><div className="mt-3"><Field label="到票"><Select value={ticketFilter} onChange={(e) => setTicketFilter(e.target.value)}><option value="all">全部</option><option value="pending">未到票</option><option value="arrived">已到票</option><option value="none">非支票</option></Select></Field></div></div><div className="divide-y">{filtered.map((b) => <div key={b.id} className="flex justify-between gap-3 p-4"><div><p className="font-black">{b.vendorCode}｜{b.vendorName}</p><p className="text-xs text-gray-400">{deptLabel(b.department, departments)}｜{b.startDate}～{b.endDate}</p><p className="text-xs font-bold">{b.paymentMethod}{b.paymentMethod === "支票" ? `｜${b.checkNumber || "未填票號"}｜${(b.ticketStatus || "pending") === "arrived" ? "已到票" : "未到票"}` : ""}</p></div><div className="text-right"><p className="font-black">{money(b.billTotal)}</p><div className="mt-2 flex gap-2">{b.paymentMethod === "支票" && <button onClick={() => toggle(b)} className="text-xs font-black text-line">到票追蹤</button>}<button onClick={() => remove(b.id)} className="text-xs font-black text-red-500">刪除</button></div></div></div>)}</div></Card></div>;
}

function ReportsPage({ departments, dailyCash, fixedRecords }) {
  const [month, setMonth] = useState(monthNow());
  const summaries = departments.map((d) => { const day = dailyCash.filter((r) => String(r.date || "").startsWith(month) && r.department === d.value); const fixed = fixedRecords.find((r) => r.month === month && r.department === d.value)?.items || []; const revenue = day.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount || 0), 0); const expense = day.filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount || 0), 0); const fixedExpense = fixed.reduce((s, r) => s + Number(r.amount || 0), 0); return { ...d, revenue, expense, fixedExpense, net: revenue - expense - fixedExpense }; });
  const total = summaries.reduce((a, r) => ({ revenue: a.revenue + r.revenue, expense: a.expense + r.expense, fixedExpense: a.fixedExpense + r.fixedExpense, net: a.net + r.net }), { revenue: 0, expense: 0, fixedExpense: 0, net: 0 });
  function exportSummary() { downloadCsv(`${month}_企業總損益表.csv`, [["部門", "收入", "現金支出", "固定支出", "淨利"], ...summaries.map((s) => [s.label, s.revenue, s.expense, s.fixedExpense, s.net]), ["合計", total.revenue, total.expense, total.fixedExpense, total.net]]); }
  return <div><Header title="報表中心" sub="總損益表與部門損益表。" /><Card className="space-y-4"><Field label="月份"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field><Button onClick={exportSummary}>輸出總損益表 CSV</Button></Card><section className="mt-5 rounded-[28px] bg-line p-5 text-white"><p className="text-sm font-bold text-white/75">公司淨利</p><p className="mt-1 text-4xl font-black">{money(total.net)}</p></section><Card className="mt-5"><div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={summaries.map((s) => ({ name: s.label, value: s.revenue }))} cx="50%" cy="50%" outerRadius={86} dataKey="value" label>{summaries.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(v) => money(v)} /></PieChart></ResponsiveContainer></div></Card><Card className="mt-5">{summaries.map((s) => <div key={s.value} className="border-b py-3"><p className="font-black">{s.label}</p><div className="mt-2 grid grid-cols-2 gap-2 text-sm"><div className="rounded-2xl bg-gray-50 p-3">收入<br /><b>{money(s.revenue)}</b></div><div className="rounded-2xl bg-gray-50 p-3">淨利<br /><b>{money(s.net)}</b></div></div></div>)}</Card></div>;
}

function SettingsPage({ departments, setDepartments, vendors, setVendors }) {
  const [vendor, setVendor] = useState({ vendorCode: "", vendorName: "", type: "cash", department: departments[0]?.value || "bakery", deductPercent: "" });
  const [departmentName, setDepartmentName] = useState("");
  async function addVendor() { const id = `vendor_${Date.now()}`; const record = { ...vendor, deductPercent: Number(vendor.deductPercent || 0) }; await setDoc(doc(db, "vendors", id), record); setVendors((p) => [{ id, ...record }, ...p]); }
  async function removeVendor(id) { await deleteDoc(doc(db, "vendors", id)); setVendors((p) => p.filter((v) => v.id !== id)); }
  async function addDepartment() { const label = departmentName.trim(); if (!label) return; const id = label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || `department_${Date.now()}`; const record = { value: id, label }; await setDoc(doc(db, "departments", id), record); setDepartments((p) => [...p, record]); setDepartmentName(""); }
  return <div><Header title="設定" sub="部門、廠商、記帳設定與員工管理。" /><Card className="space-y-4"><h2 className="font-black">廠商管理</h2><Field label="廠商名稱"><Input value={vendor.vendorName} onChange={(e) => setVendor((p) => ({ ...p, vendorName: e.target.value }))} /></Field><div className="grid grid-cols-2 gap-2"><Field label="廠編"><Input value={vendor.vendorCode} onChange={(e) => setVendor((p) => ({ ...p, vendorCode: e.target.value }))} /></Field><Field label="扣％"><Input type="number" value={vendor.deductPercent} onChange={(e) => setVendor((p) => ({ ...p, deductPercent: e.target.value }))} /></Field></div><Field label="廠商類型"><Select value={vendor.type} onChange={(e) => setVendor((p) => ({ ...p, type: e.target.value }))}><option value="cash">現結</option><option value="monthly">月結</option></Select></Field><Field label="對應部門"><Select value={vendor.department} onChange={(e) => setVendor((p) => ({ ...p, department: e.target.value }))}>{departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select></Field><Button onClick={addVendor}>新增廠商</Button><div className="divide-y">{vendors.map((v) => <div key={v.id} className="flex justify-between py-3"><div><p className="font-black">{v.vendorCode}｜{v.vendorName}</p><p className="text-xs text-gray-400">{v.type === "cash" ? "現結" : "月結"}｜{deptLabel(v.department, departments)}</p></div><button onClick={() => removeVendor(v.id)} className="text-xs font-black text-red-500">刪除</button></div>)}</div></Card><Card className="mt-5 space-y-4"><h2 className="font-black">部門管理</h2><Field label="新增部門"><Input value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} /></Field><Button onClick={addDepartment}>新增部門</Button></Card></div>;
}

export default function App() {
  const [authState, setAuthState] = useState({ loading: true, error: "", lineUserId: "", user: null });
  const [page, setPage] = useState("daily");
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS);
  const [vendors, setVendors] = useState([]);
  const [dailyCash, setDailyCash] = useState([]);
  const [fixedRecords, setFixedRecords] = useState([]);
  const [vendorBills, setVendorBills] = useState([]);

  useEffect(() => { let mounted = true; async function boot() { try { const result = await lineLogin(); if (!mounted || !result) return; setAuthState({ loading: false, error: "", lineUserId: result.lineUserId, user: result.user }); if (!result.user) return; const [departmentDocs, vendorDocs, dailyDocs, fixedDocs, billDocs] = await Promise.all([readCollection("departments"), readCollection("vendors"), readCollection("dailyCash"), readCollection("monthlyFixed"), readCollection("vendorBills")]); if (!mounted) return; setDepartments(departmentDocs.length ? departmentDocs.map((d) => ({ value: d.value || d.id, label: d.label || d.id })) : DEFAULT_DEPARTMENTS); setVendors(vendorDocs); setDailyCash(dailyDocs); setFixedRecords(fixedDocs); setVendorBills(billDocs); } catch (e) { if (mounted) setAuthState((p) => ({ ...p, loading: false, error: e.message || "登入失敗" })); } } boot(); return () => { mounted = false; }; }, []);

  const user = authState.user;
  const isAdmin = user?.role === "admin";
  if (authState.loading || authState.error || !user) return <LoginScreen authState={authState} />;

  return <div className="min-h-screen bg-[#F6F8FA] pb-24 text-gray-950"><div className="sticky top-0 z-40 border-b bg-white/95"><div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3"><div><p className="text-xs font-black uppercase tracking-widest text-line">Enterprise Finance</p><p className="text-sm font-black">企業財務系統</p></div><div className="rounded-full bg-line/10 px-3 py-1 text-xs font-black text-line">{user.role === "admin" ? "管理者" : "員工"}｜{deptLabel(user.department, departments)}</div></div></div><main className="mx-auto max-w-xl px-4 py-5">{page === "daily" && <DailyPage user={user} departments={departments} vendors={vendors} dailyCash={dailyCash} setDailyCash={setDailyCash} />}{page === "reports" && isAdmin && <ReportsPage departments={departments} dailyCash={dailyCash} fixedRecords={fixedRecords} />}{page === "fixed" && isAdmin && <FixedPage departments={departments} fixedRecords={fixedRecords} setFixedRecords={setFixedRecords} />}{page === "bills" && isAdmin && <BillsPage departments={departments} vendors={vendors} vendorBills={vendorBills} setVendorBills={setVendorBills} />}{page === "settings" && isAdmin && <SettingsPage departments={departments} setDepartments={setDepartments} vendors={vendors} setVendors={setVendors} />}</main><Nav page={page} setPage={setPage} isAdmin={isAdmin} /></div>;
}
