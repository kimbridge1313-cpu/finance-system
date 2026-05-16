import React, { useEffect, useMemo, useState } from "react";
import liff from "@line/liff";
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, signInWithCustomToken } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const GREEN = "#06C755";
const PIE_COLORS = ["#06C755", "#00A5FF", "#FFB020", "#8B5CF6", "#EF4444"];

// ============================================================================
// 正式部署連線設定
// ---------------------------------------------------------------------------
// 這份檔案可以直接覆蓋 GitHub 的 src/App.jsx。
// Firebase Web Config 可以公開在前端；Service Account 私鑰只放 Vercel Environment Variables。
// LINE userId 正式版由 liff.getProfile().userId 動態取得，不寫死。
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDolam_OIhFPGFlgibKcs1U8gr6KQXfplg",
  authDomain: "finance-system-52d62.firebaseapp.com",
  projectId: "finance-system-52d62",
  storageBucket: "finance-system-52d62.firebasestorage.app",
  messagingSenderId: "517046288884",
  appId: "1:517046288884:web:20f6b4af7f44bcef1479a1",
};

// TODO：請把這裡改成你 LINE Developers 取得的 LIFF ID。
const LIFF_ID = "2010101193-M9eYhgFD";
const AUTH_ENDPOINT = "/api/auth";

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const DEFAULT_DEPARTMENTS = [
  { value: "bakery", label: "烘焙部" },
  { value: "supermarket", label: "超市部" },
  { value: "lottery", label: "台彩部" },
];

const ROLE_OPTIONS = [
  { value: "admin", label: "管理者" },
  { value: "staff", label: "員工" },
];

const ICONS = {
  calendar: "□",
  chart: "▥",
  settings: "⚙",
  vendor: "▣",
  wallet: "$",
  plus: "+",
  trash: "×",
  save: "✓",
  chevron: "⌄",
};

const DEFAULT_DAILY_CATEGORIES = {
  expense: {
    label: "支出",
    options: [
      { id: "cash_purchase", label: "現結貨款", items: ["原物料進貨", "包材耗材", "飲料食品貨款", "彩券相關支出"] },
      { id: "operating_expense", label: "營運支出", items: ["水電瓦斯", "設備維修", "清潔用品", "廣告行銷"] },
      { id: "staff_expense", label: "人事支出", items: ["薪資", "獎金", "員工餐費", "加班費"] },
      { id: "other_expense", label: "其他支出", items: [] },
    ],
  },
  income: {
    label: "收入",
    options: [
      { id: "cash_revenue", label: "現金收入", items: ["門市現金", "外送現金", "市集現金"] },
      { id: "transfer_revenue", label: "轉帳收入", items: ["銀行轉帳", "LINE Pay", "信用卡"] },
      { id: "other_revenue", label: "其他收入", items: [] },
    ],
  },
};

const initialDailyCash = {
  bakery: [
    { date: "2026-05-01", type: "income", category: "現金收入", item: "門市現金", department: "bakery", amount: 12800, note: "母親節預購收入" },
    { date: "2026-05-01", type: "expense", category: "現結貨款", item: "原物料進貨", department: "bakery", amount: 3200, vendorId: "vendor_003", vendorName: "現結水果行", note: "母親節備料" },
    { date: "2026-05-04", type: "income", category: "轉帳收入", item: "銀行轉帳", department: "bakery", amount: 18200, note: "團購出貨" },
    { date: "2026-05-04", type: "expense", category: "現結貨款", item: "原物料進貨", department: "bakery", amount: 5200, vendorId: "vendor_003", vendorName: "現結水果行", note: "鮮奶油與水果" },
  ],
  supermarket: [
    { date: "2026-05-01", type: "income", category: "現金收入", item: "門市現金", department: "supermarket", amount: 42800, note: "超市門市收入" },
    { date: "2026-05-01", type: "expense", category: "現結貨款", item: "飲料食品貨款", department: "supermarket", amount: 8600, vendorId: "vendor_004", vendorName: "現結包材行", note: "日用品進貨" },
    { date: "2026-05-04", type: "income", category: "現金收入", item: "門市現金", department: "supermarket", amount: 37100, note: "一般營業" },
    { date: "2026-05-04", type: "expense", category: "營運支出", item: "設備維修", department: "supermarket", amount: 6800, note: "冷藏櫃維修" },
  ],
  lottery: [
    { date: "2026-05-01", type: "income", category: "現金收入", item: "門市現金", department: "lottery", amount: 22800, note: "彩券銷售" },
    { date: "2026-05-01", type: "expense", category: "營運支出", item: "廣告行銷", department: "lottery", amount: 1800, note: "活動看板" },
    { date: "2026-05-04", type: "income", category: "現金收入", item: "門市現金", department: "lottery", amount: 19700, note: "一般營業" },
    { date: "2026-05-04", type: "expense", category: "營運支出", item: "清潔用品", department: "lottery", amount: 1300, note: "環境整理" },
  ],
};

const initialFixed = {
  bakery: [{ label: "租金", amount: 18000 }, { label: "人事費", amount: 56000 }, { label: "電費", amount: 8800 }],
  supermarket: [{ label: "租金", amount: 42000 }, { label: "人事費", amount: 92000 }, { label: "冷藏電費", amount: 16800 }],
  lottery: [{ label: "櫃位租金", amount: 12000 }, { label: "人事費", amount: 36000 }, { label: "系統費", amount: 3000 }],
};

const initialFixedRecords = [
  { id: "fixed_2026_05_bakery", month: "2026-05", department: "bakery", items: initialFixed.bakery },
  { id: "fixed_2026_05_supermarket", month: "2026-05", department: "supermarket", items: initialFixed.supermarket },
  { id: "fixed_2026_05_lottery", month: "2026-05", department: "lottery", items: initialFixed.lottery },
];

const initialVendors = [
  { id: "vendor_001", vendorCode: "A001", vendorName: "大成原物料", type: "monthly", department: "bakery", deductPercent: 3 },
  { id: "vendor_002", vendorCode: "B018", vendorName: "日用品批發商", type: "monthly", department: "supermarket", deductPercent: 0 },
  { id: "vendor_003", vendorCode: "C006", vendorName: "現結水果行", type: "cash", department: "bakery", deductPercent: 0 },
  { id: "vendor_004", vendorCode: "D012", vendorName: "現結包材行", type: "cash", department: "supermarket", deductPercent: 0 },
];

const initialVendorBills = [
  { id: "bill_001", vendorId: "vendor_001", vendorCode: "A001", vendorName: "大成原物料", department: "bakery", deductPercent: 3, startDate: "2026-05-01", endDate: "2026-05-31", note: "五月烘焙原料月結", billTotal: 48600, paymentMethod: "支票", checkNumber: "CK202605001", ticketStatus: "arrived" },
  { id: "bill_002", vendorId: "vendor_002", vendorCode: "B018", vendorName: "日用品批發商", department: "supermarket", deductPercent: 0, startDate: "2026-05-01", endDate: "2026-05-31", note: "超市日用品月結", billTotal: 73900, paymentMethod: "現金", checkNumber: "", ticketStatus: "none" },
];

const initialUsers = [
  { id: "Uadminxxxx001", name: "老闆", role: "admin", department: "all" },
  { id: "U9a01xxxxbakery", name: "小林", role: "staff", department: "bakery" },
  { id: "U3b22xxxxmarket", name: "阿美", role: "staff", department: "supermarket" },
];

function getTodayDate() { const now = new Date(); const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, "0"); const day = String(now.getDate()).padStart(2, "0"); return `${year}-${month}-${day}`; }
function money(value) { return `$${Number(value || 0).toLocaleString()}`; }
function plainMoney(value) { return Number(value || 0).toLocaleString(); }
function percent(value, base) { return base ? `${((Number(value || 0) / Number(base || 1)) * 100).toFixed(2)}%` : "0%"; }
function getDepartmentLabel(value, departments = DEFAULT_DEPARTMENTS) { if (value === "all") return "全部部門"; return departments.find((d) => d.value === value)?.label || value; }
function getRoleLabel(value) { return ROLE_OPTIONS.find((r) => r.value === value)?.label || value; }
function getCategoryOptions(categories, type) { return categories[type]?.options || []; }
function getItemLabel(item) { return typeof item === "string" ? item : item?.label || ""; }
function getItemDepartment(item) { return typeof item === "string" ? "" : item?.department || ""; }
function normalizeAccountingItems(items = []) { return items.map((item) => (typeof item === "string" ? { label: item, department: "" } : { label: item.label || "", department: item.department || "" })); }
function getItemOptions(categories, type, categoryId) { const category = getCategoryOptions(categories, type).find((item) => item.id === categoryId || item.label === categoryId); return normalizeAccountingItems(category?.items || []).map((item) => item.label).filter(Boolean); }
function getCategoryDepartment(categories, type, categoryId) { return getCategoryOptions(categories, type).find((item) => item.id === categoryId || item.label === categoryId)?.department || ""; }
function getAccountingItemDepartment(categories, type, categoryId, itemLabel) { const category = getCategoryOptions(categories, type).find((item) => item.id === categoryId || item.label === categoryId); const item = normalizeAccountingItems(category?.items || []).find((entry) => entry.label === itemLabel); return item?.department || ""; }
function getAutoDepartmentForAccounting(categories, type, categoryId, itemLabel) { return getAccountingItemDepartment(categories, type, categoryId, itemLabel) || getCategoryDepartment(categories, type, categoryId) || ""; }
function getTypeLabel(type, categories) { return categories[type]?.label || type; }
function getVisibleNavItems(isAdmin) { return [{ id: "daily", label: "每日", icon: ICONS.calendar, visible: true }, { id: "reports", label: "報表", icon: ICONS.chart, visible: isAdmin }, { id: "monthly-fixed", label: "固定", icon: ICONS.settings, visible: isAdmin }, { id: "vendor-bills", label: "月結", icon: ICONS.vendor, visible: isAdmin }, { id: "settings", label: "設定", icon: ICONS.settings, visible: isAdmin }].filter((item) => item.visible); }

function buildCsvText(rows) { return rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n"); }
function createCsvExportPayload(filename, rows) { const csvText = buildCsvText(rows); const safeFilename = String(filename || "export.csv").replace(/[\\/:*?"<>|]/g, "_"); const href = `data:text/csv;charset=utf-8,${encodeURIComponent("\uFEFF" + csvText)}`; return { filename: safeFilename, href, csvText }; }
function downloadCsv(filename, rows) { const payload = createCsvExportPayload(filename, rows); if (typeof document !== "undefined") { const link = document.createElement("a"); link.href = payload.href; link.download = payload.filename; document.body.appendChild(link); link.click(); document.body.removeChild(link); } if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("finance-export-ready", { detail: payload })); return payload; }
function normalizeDailyCashDocs(docs, departments = DEFAULT_DEPARTMENTS) { const data = {}; departments.forEach((dept) => { data[dept.value] = []; }); docs.forEach((item) => { const dept = item.department || "bakery"; if (!data[dept]) data[dept] = []; data[dept].push(item); }); return data; }
function normalizeFixedDocs(docs, departments = DEFAULT_DEPARTMENTS) { const data = {}; departments.forEach((dept) => { data[dept.value] = []; }); docs.forEach((item) => { if (item.department) data[item.department] = item.items || []; }); return data; }
async function readCollection(name) { const snap = await getDocs(collection(db, name)); return snap.docs.map((item) => ({ id: item.id, ...item.data() })); }
async function loadSettingsFromFirestore() { const [departmentDocs, vendorDocs, dailyDocs, fixedDocs, billDocs, userDocs, requestDocs, categorySnap] = await Promise.all([readCollection("departments"), readCollection("vendors"), readCollection("dailyCash"), readCollection("monthlyFixed"), readCollection("vendorBills"), readCollection("users"), readCollection("joinRequests"), getDoc(doc(db, "settings", "categories"))]); const departments = departmentDocs.length ? departmentDocs.map((entry) => ({ value: entry.value || entry.id, label: entry.label || entry.id })) : DEFAULT_DEPARTMENTS; const categories = categorySnap.exists() ? categorySnap.data().categories || DEFAULT_DAILY_CATEGORIES : DEFAULT_DAILY_CATEGORIES; return { departments, vendors: vendorDocs, dailyCashData: normalizeDailyCashDocs(dailyDocs, departments), fixedRecords: fixedDocs, fixedData: normalizeFixedDocs(fixedDocs, departments), vendorBills: billDocs, users: userDocs, joinRequests: requestDocs, categories }; }
async function loginWithLine() { if (!LIFF_ID || LIFF_ID === "請填入_LINE_LIFF_ID") throw new Error("尚未設定 LIFF ID，請先在 src/App.jsx 填入 LIFF_ID。"); await liff.init({ liffId: LIFF_ID }); if (!liff.isLoggedIn()) { liff.login(); return null; } const profile = await liff.getProfile(); const lineUserId = profile.userId; const response = await fetch(AUTH_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lineUserId }) }); if (!response.ok) throw new Error(`登入 API 失敗：${await response.text()}`); const { token } = await response.json(); await signInWithCustomToken(auth, token); const userSnap = await getDoc(doc(db, "users", lineUserId)); return { lineUserId, profile, appUser: userSnap.exists() ? { id: lineUserId, ...userSnap.data() } : null }; }
function LoginScreen({ authState }) {
  const [requestName, setRequestName] = useState(authState.profile?.displayName || "");
  const [requestDepartment, setRequestDepartment] = useState(DEFAULT_DEPARTMENTS[0]?.value || "bakery");
  const [requestMessage, setRequestMessage] = useState("");

  async function submitJoinRequest() {
    if (!authState.lineUserId) return;
    const record = {
      lineUserId: authState.lineUserId,
      name: requestName || authState.profile?.displayName || "未命名員工",
      department: requestDepartment,
      role: "staff",
      status: "pending",
      source: "line_liff",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, "joinRequests", authState.lineUserId), record, { merge: true });
    setRequestMessage("已送出加入申請，請等待管理者審核。你可以把此畫面傳給老闆確認。 ");
  }

  return <div className="min-h-screen bg-[#F6F8FA] p-4"><main className="mx-auto max-w-xl pt-12"><Card><p className="text-xs font-black uppercase tracking-widest text-[#06C755]">Enterprise Finance</p><h1 className="mt-2 text-3xl font-black text-gray-950">企業財務系統</h1><p className="mt-3 text-sm leading-6 text-gray-500">系統透過 LINE LIFF 取得 LINE userId，再登入 Firebase。</p>{authState.loading && <p className="mt-5 font-bold text-gray-500">登入檢查中...</p>}{authState.error && <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-500">{authState.error}</p>}{authState.lineUserId && !authState.user && <div className="mt-5 space-y-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-700"><div>已取得 LINE userId：<span className="break-all">{authState.lineUserId}</span><br />但尚未建立員工帳號，可直接送出加入申請。</div><Field label="姓名"><Input value={requestName} onChange={(e) => setRequestName(e.target.value)} placeholder="請輸入姓名" /></Field><Field label="申請部門"><Select value={requestDepartment} onChange={(e) => setRequestDepartment(e.target.value)}>{DEFAULT_DEPARTMENTS.map((dept) => <option key={dept.value} value={dept.value}>{dept.label}</option>)}</Select></Field><PrimaryButton type="button" onClick={submitJoinRequest}>送出加入申請</PrimaryButton>{requestMessage && <p className="rounded-2xl bg-white/70 p-3 text-[#06C755]">{requestMessage}</p>}</div>}</Card></main></div>;
}

function calcDepartment(department, dailyCashData, fixedData, departments) {
  const records = dailyCashData[department] || [];
  const fixedItems = fixedData[department] || [];
  const revenue = records.reduce((sum, item) => item.type === "income" ? sum + Number(item.amount || 0) : sum, 0);
  const cashExpense = records.reduce((sum, item) => item.type === "expense" ? sum + Number(item.amount || 0) : sum, 0);
  const fixedExpense = fixedItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return { department, departmentLabel: getDepartmentLabel(department, departments), revenue, cashExpense, fixedExpense, totalExpense: cashExpense + fixedExpense, netProfit: revenue - cashExpense - fixedExpense };
}

function getCategoryBreakdown(department, type, dailyCashData) {
  const groups = {};
  (dailyCashData[department] || []).filter((record) => record.type === type).forEach((record) => {
    if (!groups[record.category]) groups[record.category] = { label: record.category, amount: 0, items: {} };
    groups[record.category].amount += Number(record.amount || 0);
    groups[record.category].items[record.item] = (groups[record.category].items[record.item] || 0) + Number(record.amount || 0);
  });
  return Object.values(groups).map((group) => ({ ...group, items: Object.entries(group.items).map(([label, amount]) => ({ label, amount })) }));
}

function buildProfitReportRows(department, dailyCashData, fixedData, departments) {
  const summary = calcDepartment(department, dailyCashData, fixedData, departments);
  const incomeGroups = getCategoryBreakdown(department, "income", dailyCashData);
  const expenseGroups = getCategoryBreakdown(department, "expense", dailyCashData);
  const fixedItems = fixedData[department] || [];
  const grossProfit = summary.revenue - summary.cashExpense;
  const beforeTax = summary.netProfit;
  const tax = Math.max(Math.round(beforeTax * 0.05), 0);
  const rows = [{ kind: "section", name: "營業收入(A)", amount: summary.revenue, percent: "100%" }];
  incomeGroups.forEach((group) => { rows.push({ kind: "category", name: group.label, amount: group.amount, percent: percent(group.amount, summary.revenue) }); group.items.forEach((item) => rows.push({ kind: "item", name: item.label, amount: item.amount, percent: "" })); });
  rows.push({ kind: "section", name: "營業成本(B)", amount: summary.cashExpense, percent: percent(summary.cashExpense, summary.revenue) });
  expenseGroups.forEach((group) => { rows.push({ kind: "category", name: group.label, amount: group.amount, percent: "" }); group.items.forEach((item) => rows.push({ kind: "item", name: item.label, amount: item.amount, percent: "" })); });
  rows.push({ kind: "section", name: "毛利(C=A-B)", amount: grossProfit, percent: percent(grossProfit, summary.revenue) });
  rows.push({ kind: "section", name: "營運費用(D)", amount: summary.fixedExpense, percent: percent(summary.fixedExpense, summary.revenue) });
  fixedItems.forEach((item) => rows.push({ kind: "item", name: item.label, amount: item.amount, percent: "" }));
  rows.push({ kind: "section", name: "利益(E=C-D)", amount: summary.netProfit, percent: percent(summary.netProfit, summary.revenue) });
  rows.push({ kind: "section", name: "非營業收益(F)", amount: 0, percent: "" });
  rows.push({ kind: "section", name: "非營業損損(G)", amount: 0, percent: "" });
  rows.push({ kind: "section", name: "本期稅前損益(I)", amount: beforeTax, percent: percent(beforeTax, summary.revenue) });
  rows.push({ kind: "section", name: "稅金總計(A*5%)", amount: tax, percent: "" });
  rows.push({ kind: "final", name: "本期稅後損益", amount: beforeTax - tax, percent: percent(beforeTax - tax, summary.revenue) });
  return rows;
}

function runSelfTests(categories, departments) {
  const bakery = calcDepartment("bakery", initialDailyCash, initialFixed, departments);
  const adminNav = getVisibleNavItems(true);
  const staffNav = getVisibleNavItems(false);
  return [
    { name: "系統名稱", pass: "企業財務系統" === "企業財務系統" },
    { name: "admin nav 五項", pass: adminNav.length === 5 },
    { name: "staff nav 一項", pass: staffNav.length === 1 },
    { name: "其他支出存在", pass: getCategoryOptions(categories, "expense").some((x) => x.id === "other_expense") },
    { name: "其他收入手動輸入", pass: getItemOptions(categories, "income", "other_revenue").length === 0 },
    { name: "超市部預設部門存在", pass: departments.some((dept) => dept.value === "supermarket") },
    { name: "今日日期格式正確", pass: /^\d{4}-\d{2}-\d{2}$/.test(getTodayDate()) },
    { name: "Firebase projectId 已接入", pass: firebaseConfig.projectId === "finance-system-52d62" },
    { name: "登入 API 路徑正確", pass: AUTH_ENDPOINT === "/api/auth" },
    { name: "CSV 轉義正常", pass: buildCsvText([["a\"b"]]) === "\"a\"\"b\"" },
  ];
}

function InlineIcon({ icon }) { return <span className="inline-flex h-5 w-5 items-center justify-center font-black leading-none">{icon}</span>; }
function PageHeader({ title, subtitle, icon }) { return <div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-black tracking-tight text-gray-950">{title}</h1><p className="mt-1 text-sm leading-6 text-gray-500">{subtitle}</p></div><span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#06C755]/10 text-xl font-black text-[#06C755]">{icon}</span></div>; }
function Card({ children, className = "" }) { return <section className={`rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-gray-100 ${className}`}>{children}</section>; }
function Field({ label, children }) { return <label className="block min-w-0"><span className="text-sm font-bold text-gray-700">{label}</span><div className="mt-2 min-w-0">{children}</div></label>; }
function Input(props) { const { className = "", ...rest } = props; return <input {...rest} className={`block min-w-0 max-w-full box-border w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[15px] outline-none transition focus:border-[#06C755] focus:ring-4 focus:ring-[#06C755]/10 ${className}`} />; }
function TextArea(props) { const { className = "", ...rest } = props; return <textarea {...rest} className={`block min-w-0 max-w-full box-border w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[15px] outline-none transition focus:border-[#06C755] focus:ring-4 focus:ring-[#06C755]/10 ${className}`} />; }
function getDeductRule(vendor) { return vendor?.deductRule ?? vendor?.deductPercent ?? ""; }
function Select(props) { const { className = "", children, ...rest } = props; return <div className="relative"><select {...rest} className={`block min-w-0 max-w-full box-border w-full appearance-none rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-10 text-[15px] outline-none transition focus:border-[#06C755] focus:ring-4 focus:ring-[#06C755]/10 disabled:bg-gray-50 disabled:text-gray-400 ${className}`}>{children}</select><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">{ICONS.chevron}</span></div>; }
function vendorSearchText(vendor, departments = DEFAULT_DEPARTMENTS) { return `${vendor.vendorCode || ""} ${vendor.vendorName || ""} ${getDepartmentLabel(vendor.department, departments)}`.toLowerCase(); }
function SearchableVendorSelect({ value, onChange, vendors, departments, placeholder = "輸入廠商名稱或代碼搜尋" }) { const [keyword, setKeyword] = useState(""); const keywordText = keyword.trim().toLowerCase(); const filteredVendors = keywordText ? vendors.filter((vendor) => vendorSearchText(vendor, departments).includes(keywordText)) : vendors; return <div className="space-y-2"><Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={placeholder} /><Select value={value} onChange={(e) => onChange(e.target.value)}><option value="">請選擇廠商</option>{filteredVendors.map((v) => <option key={v.id} value={v.id}>{v.vendorCode}｜{v.vendorName}｜{getDepartmentLabel(v.department, departments)}</option>)}</Select>{keywordText && filteredVendors.length === 0 && <p className="text-xs font-bold text-red-400">找不到符合的廠商，請確認代碼或名稱。</p>}</div>; }
function PrimaryButton({ children, className = "", ...props }) { return <button {...props} className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-[#06C755] px-4 py-3 font-black text-white shadow-sm transition active:scale-[0.99] ${className}`}>{children}</button>; }
function SmallButton({ children, tone = "green", className = "", ...props }) { const styles = tone === "red" ? "bg-red-50 text-red-500" : tone === "gray" ? "bg-gray-100 text-gray-600" : "bg-[#06C755]/10 text-[#06C755]"; return <button {...props} className={`inline-flex items-center justify-center gap-1 rounded-full px-3 py-2 text-xs font-black ${styles} ${className}`}>{children}</button>; }
function StatCard({ label, value, tone = "white" }) { const green = tone === "green"; return <div className={`rounded-[24px] p-4 ${green ? "bg-[#06C755] text-white" : "bg-white text-gray-950 ring-1 ring-gray-100"}`}><p className={`text-xs font-bold ${green ? "text-white/75" : "text-gray-400"}`}>{label}</p><p className="mt-1 text-xl font-black tracking-tight">{money(value)}</p></div>; }
function TestStatus({ tests }) { const failed = tests.filter((t) => !t.pass); return <div className={`mb-5 rounded-[20px] px-4 py-3 text-xs font-bold ${failed.length ? "bg-red-50 text-red-600" : "bg-[#06C755]/10 text-[#06C755]"}`}><div className="flex items-center justify-between"><span>前端自我檢查：{tests.length - failed.length}/{tests.length} 通過</span><span>{failed.length ? "需修正" : "OK"}</span></div>{failed.length > 0 && <ul className="mt-2 list-disc pl-4">{failed.map((t) => <li key={t.name}>{t.name}</li>)}</ul>}</div>; }
function AccordionSection({ title, subtitle, icon, open, onToggle, children }) { return <Card className="overflow-hidden p-0"><button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-4 p-5 text-left"><div className="flex items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#06C755]/10 font-black text-[#06C755]">{icon}</span><div><h2 className="font-black text-gray-950">{title}</h2><p className="mt-1 text-xs font-bold text-gray-400">{subtitle}</p></div></div><span className={`text-xl font-black text-gray-400 transition ${open ? "rotate-180" : ""}`}>{ICONS.chevron}</span></button>{open && <div className="border-t border-gray-100 p-5">{children}</div>}</Card>; }
function NavBar({ page, setPage, isAdmin }) { const items = getVisibleNavItems(isAdmin); return <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-100 bg-white/95 backdrop-blur print:hidden"><div className="mx-auto grid h-[68px] max-w-xl" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>{items.map((item) => <button key={item.id} type="button" onClick={() => setPage(item.id)} className={`flex flex-col items-center justify-center gap-1 text-xs font-black ${page === item.id ? "text-[#06C755]" : "text-gray-400"}`}><span className={`flex h-6 w-6 items-center justify-center rounded-xl text-base ${page === item.id ? "bg-[#06C755]/10" : ""}`}>{item.icon}</span><span>{item.label}</span></button>)}</div></nav>; }
function ExportPanel({ exportFile, onClose }) { if (!exportFile) return null; return <div className="mb-5 rounded-[24px] border border-[#06C755]/20 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-gray-950">檔案已產生</p><p className="mt-1 break-all text-xs font-bold text-gray-400">{exportFile.filename}</p></div><button type="button" onClick={onClose} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-500">關閉</button></div><div className="mt-4 grid grid-cols-2 gap-2"><a href={exportFile.href} download={exportFile.filename} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center rounded-2xl bg-[#06C755] px-4 py-3 text-sm font-black text-white">下載 CSV</a><button type="button" onClick={() => navigator?.clipboard?.writeText(exportFile.csvText)} className="rounded-2xl bg-[#06C755]/10 px-4 py-3 text-sm font-black text-[#06C755]">複製內容</button></div></div>; }
function IntegrationPanel({ currentUser }) { return <Card className="mb-5 space-y-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-[#06C755]">正式登入設定</p><h2 className="mt-1 font-black text-gray-950">Firebase + LIFF + LINE userId</h2><p className="mt-1 text-xs font-bold text-gray-400">目前登入資料來自 Firestore users/{currentUser.id}</p></div><span className="rounded-full bg-[#06C755]/10 px-3 py-1 text-xs font-black text-[#06C755]">已接正式登入</span></div><div className="grid grid-cols-1 gap-2 text-xs font-bold text-gray-500"><div className="rounded-2xl bg-gray-50 p-3">Firebase projectId：{firebaseConfig.projectId}</div><div className="rounded-2xl bg-gray-50 p-3">Auth endpoint：{AUTH_ENDPOINT}</div><div className="rounded-2xl bg-gray-50 p-3">目前 LINE userId：{currentUser.id}</div></div></Card>; }

function DailyCash({ currentUser, isAdmin, categories, departments, dailyCashData, setDailyCashData, vendors }) {
  const initialDepartment = currentUser.department === "all" ? "supermarket" : currentUser.department;
  const firstExpenseCategory = getCategoryOptions(categories, "expense")[0];
  const [department, setDepartment] = useState(initialDepartment);
  const [date, setDate] = useState(() => getTodayDate());
  const [adminQueryDate, setAdminQueryDate] = useState(() => getTodayDate());
  const [entryType, setEntryType] = useState("expense");
  const [category, setCategory] = useState(firstExpenseCategory?.id || "");
  const [entryItem, setEntryItem] = useState(firstExpenseCategory?.items?.[0] || "");
  const [vendorId, setVendorId] = useState("");
  const [amount, setAmount] = useState("3200");
  const [note, setNote] = useState("");
  const [expandedEntryKey, setExpandedEntryKey] = useState("");
  const [entryDrafts, setEntryDrafts] = useState({});
  const cashVendors = vendors.filter((v) => v.type === "cash");
  const availableDepartments = isAdmin || currentUser.department === "all" ? departments : departments.filter((d) => d.value === currentUser.department);
  const categoryOptions = getCategoryOptions(categories, entryType);
  const itemOptions = getItemOptions(categories, entryType, category);
  const isManualItem = category === "other_expense" || category === "other_revenue";
  const showCashVendorSelect = entryType === "expense" && category === "cash_purchase";
  const visibleRecords = (dailyCashData[department] || []).map((record, index) => ({ ...record, sourceIndex: index })).filter((record) => record.date === date);

  function handleTypeChange(nextType) { const firstCategory = getCategoryOptions(categories, nextType)[0]; const firstItem = getItemOptions(categories, nextType, firstCategory?.id || "")[0] || ""; setEntryType(nextType); setCategory(firstCategory?.id || ""); setEntryItem(firstItem); const autoDepartment = getAutoDepartmentForAccounting(categories, nextType, firstCategory?.id || "", firstItem); if (autoDepartment) setDepartment(autoDepartment); setAmount(nextType === "income" ? "12800" : "3200"); }
  function handleCategoryChange(nextCategory) { const firstItem = nextCategory === "other_expense" || nextCategory === "other_revenue" ? "" : getItemOptions(categories, entryType, nextCategory)[0] || ""; setCategory(nextCategory); setEntryItem(firstItem); const autoDepartment = getAutoDepartmentForAccounting(categories, entryType, nextCategory, firstItem); if (autoDepartment) setDepartment(autoDepartment); }
  function handleEntryItemChange(nextItem) { setEntryItem(nextItem); const autoDepartment = getAutoDepartmentForAccounting(categories, entryType, category, nextItem); if (autoDepartment) setDepartment(autoDepartment); }
  function handleVendorChange(nextVendorId) { const selectedVendor = cashVendors.find((v) => v.id === nextVendorId); setVendorId(nextVendorId); if (selectedVendor?.department) setDepartment(selectedVendor.department); }
  async function saveEntry() { const selectedVendor = cashVendors.find((v) => v.id === vendorId); const categoryLabel = categoryOptions.find((x) => x.id === category)?.label || category; const shouldVendor = entryType === "expense" && category === "cash_purchase"; const id = `${date}_${department}_${Date.now()}`; const entry = { id, date, type: entryType, category: categoryLabel, categoryId: category, item: entryItem, department, amount: Number(amount || 0), note, vendorId: shouldVendor ? vendorId : "", vendorName: shouldVendor ? selectedVendor?.vendorName || "" : "", createdBy: currentUser.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }; await setDoc(doc(db, "dailyCash", id), entry); setDailyCashData((prev) => ({ ...prev, [department]: [...(prev[department] || []), entry] })); }
  function keyOf(record) { return `${record.department}-${record.sourceIndex}`; }
  function startEdit(record) { const match = getCategoryOptions(categories, record.type).find((c) => c.label === record.category || c.id === record.category); const key = keyOf(record); setExpandedEntryKey(key); setEntryDrafts((prev) => ({ ...prev, [key]: { ...record, originalDepartment: record.department, categoryId: match?.id || record.category, amount: String(record.amount || 0), vendorId: record.vendorId || "" } })); }
  function updateDraft(key, field, value) { setEntryDrafts((prev) => { const draft = prev[key] || {}; if (field === "vendorId") { const selectedVendor = cashVendors.find((v) => v.id === value); return { ...prev, [key]: { ...draft, vendorId: value, department: selectedVendor?.department || draft.department } }; } if (field === "type") { const first = getCategoryOptions(categories, value)[0]; return { ...prev, [key]: { ...draft, type: value, categoryId: first?.id || "", item: first?.items?.[0] || "", vendorId: "" } }; } if (field === "categoryId") return { ...prev, [key]: { ...draft, categoryId: value, item: value === "other_expense" || value === "other_revenue" ? "" : getItemOptions(categories, draft.type, value)[0] || "" } }; return { ...prev, [key]: { ...draft, [field]: value } }; }); }
  async function saveInline(key) { const draft = entryDrafts[key]; if (!draft) return; const selectedVendor = cashVendors.find((v) => v.id === draft.vendorId); const shouldVendor = draft.type === "expense" && draft.categoryId === "cash_purchase"; const categoryLabel = getCategoryOptions(categories, draft.type).find((c) => c.id === draft.categoryId)?.label || draft.categoryId; const id = draft.id || `${draft.date}_${draft.department}_${Date.now()}`; const nextEntry = { ...draft, id, date: draft.date, type: draft.type, category: categoryLabel, categoryId: draft.categoryId, item: draft.item, department: draft.department, amount: Number(draft.amount || 0), note: draft.note || "", vendorId: shouldVendor ? draft.vendorId : "", vendorName: shouldVendor ? selectedVendor?.vendorName || "" : "", updatedAt: serverTimestamp() }; await setDoc(doc(db, "dailyCash", id), nextEntry, { merge: true }); setDailyCashData((prev) => { const next = { ...prev }; const original = [...(next[draft.originalDepartment] || [])]; original.splice(draft.sourceIndex, 1); next[draft.originalDepartment] = original; if (nextEntry.department === draft.originalDepartment) { original.splice(draft.sourceIndex, 0, nextEntry); next[draft.originalDepartment] = original; } else next[nextEntry.department] = [...(next[nextEntry.department] || []), nextEntry]; return next; }); setExpandedEntryKey(""); }
  async function deleteEntry(record) { if (record.id) await deleteDoc(doc(db, "dailyCash", record.id)); setDailyCashData((prev) => ({ ...prev, [record.department]: (prev[record.department] || []).filter((_, i) => i !== record.sourceIndex) })); }
  function EntryEditor({ record }) { const key = keyOf(record); const draft = entryDrafts[key]; if (!draft) return null; const draftCats = getCategoryOptions(categories, draft.type); const draftItems = getItemOptions(categories, draft.type, draft.categoryId); const manual = draft.categoryId === "other_expense" || draft.categoryId === "other_revenue"; const showVendor = draft.type === "expense" && draft.categoryId === "cash_purchase"; return <div className="mt-4 space-y-4 rounded-3xl bg-gray-50 p-4"><div className="grid grid-cols-2 gap-3"><Field label="日期"><Input type="date" value={draft.date} onChange={(e) => updateDraft(key, "date", e.target.value)} /></Field><Field label="類型"><Select value={draft.type} onChange={(e) => updateDraft(key, "type", e.target.value)}><option value="expense">支出</option><option value="income">收入</option></Select></Field></div><Field label="細項分類"><Select value={draft.categoryId} onChange={(e) => updateDraft(key, "categoryId", e.target.value)}>{draftCats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field><Field label="記帳項目">{manual ? <Input value={draft.item} onChange={(e) => updateDraft(key, "item", e.target.value)} /> : <Select value={draft.item} onChange={(e) => updateDraft(key, "item", e.target.value)}>{draftItems.map((item) => <option key={item} value={item}>{item}</option>)}</Select>}</Field>{showVendor && <Field label="現結貨款廠商"><SearchableVendorSelect value={draft.vendorId} onChange={(nextVendorId) => updateDraft(key, "vendorId", nextVendorId)} vendors={cashVendors} departments={departments} placeholder="輸入現結廠商名稱或代碼搜尋" /></Field>}<Field label="歸帳部門"><Select value={draft.department} onChange={(e) => updateDraft(key, "department", e.target.value)}>{departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select></Field><Field label="金額"><Input type="number" value={draft.amount} onChange={(e) => updateDraft(key, "amount", e.target.value)} /></Field><Field label="備註"><Input value={draft.note || ""} onChange={(e) => updateDraft(key, "note", e.target.value)} /></Field><div className="grid grid-cols-2 gap-2"><PrimaryButton type="button" onClick={() => saveInline(key)}>儲存修改</PrimaryButton><SmallButton type="button" tone="gray" className="rounded-2xl py-3" onClick={() => setExpandedEntryKey("")}>收合</SmallButton></div></div>; }
  const adminDayRecords = departments.flatMap((dept) => (dailyCashData[dept.value] || []).map((record, index) => ({ ...record, sourceIndex: index, departmentLabel: dept.label })).filter((record) => record.date === adminQueryDate));
  function DetailList({ records, showDepartment }) { if (!records.length) return <div className="p-5 text-sm font-bold text-gray-400">沒有記帳明細。</div>; return <div className="divide-y divide-gray-100">{records.map((record) => <div key={`${showDepartment ? "all" : "one"}-${record.department}-${record.sourceIndex}`} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2">{showDepartment && <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-black text-gray-500">{record.departmentLabel}</span>}<span className={`rounded-full px-2 py-1 text-xs font-black ${record.type === "income" ? "bg-[#06C755]/10 text-[#06C755]" : "bg-red-50 text-red-500"}`}>{getTypeLabel(record.type, categories)}</span><span className="text-sm font-black text-gray-950">{record.category}</span></div><p className="mt-2 text-sm font-bold text-gray-700">{record.item}</p>{record.vendorName && <p className="mt-1 text-xs font-black text-[#06C755]">廠商：{record.vendorName}</p>}<p className="mt-1 text-xs text-gray-400">{record.note || "無備註"}</p></div><div className="shrink-0 text-right"><p className={`text-base font-black ${record.type === "income" ? "text-[#06C755]" : "text-red-500"}`}>{money(record.amount)}</p><div className="mt-3 flex gap-2"><SmallButton type="button" tone="gray" onClick={() => startEdit(record)}>編輯</SmallButton><SmallButton type="button" tone="red" onClick={() => deleteEntry(record)}>刪除</SmallButton></div></div></div>{expandedEntryKey === keyOf(record) && <EntryEditor record={record} />}</div>)}</div>; }
  const incomeTotal = visibleRecords.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount || 0), 0);
  const expenseTotal = visibleRecords.filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount || 0), 0);
  const adminIncome = adminDayRecords.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount || 0), 0);
  const adminExpense = adminDayRecords.filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount || 0), 0);
  return <div className="space-y-5"><PageHeader title="每日記帳" subtitle={isAdmin ? "老闆可查每天全部部門明細。" : "員工只能每日記帳與查看當日明細。"} icon={ICONS.wallet} /><Card className="space-y-5"><div className="grid grid-cols-2 rounded-2xl border border-[#06C755] bg-white p-1"><button type="button" onClick={() => handleTypeChange("expense")} className={`rounded-xl px-4 py-3 font-black ${entryType === "expense" ? "bg-red-500 text-white" : "text-red-500"}`}>支出</button><button type="button" onClick={() => handleTypeChange("income")} className={`rounded-xl px-4 py-3 font-black ${entryType === "income" ? "bg-[#06C755] text-white" : "text-[#06C755]"}`}>收入</button></div><Field label="日期"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><Field label="細項分類"><Select value={category} onChange={(e) => handleCategoryChange(e.target.value)}>{categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field><Field label="記帳項目">{isManualItem ? <Input value={entryItem} onChange={(e) => setEntryItem(e.target.value)} placeholder={entryType === "expense" ? "請輸入其他支出項目" : "請輸入其他收入項目"} /> : <Select value={entryItem} onChange={(e) => handleEntryItemChange(e.target.value)}>{itemOptions.map((item) => <option key={item} value={item}>{item}</option>)}</Select>}</Field>{showCashVendorSelect && <Field label="現結貨款廠商"><SearchableVendorSelect value={vendorId} onChange={handleVendorChange} vendors={cashVendors} departments={departments} placeholder="輸入現結廠商名稱或代碼搜尋" /></Field>}<Field label="歸帳部門"><Select value={department} onChange={(e) => setDepartment(e.target.value)} disabled={!isAdmin && currentUser.department !== "all"}>{availableDepartments.some((d) => d.value === department) ? null : <option value={department}>{getDepartmentLabel(department, departments)}</option>}{availableDepartments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select></Field><Field label="金額"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field><Field label="備註"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field><PrimaryButton type="button" onClick={saveEntry}>儲存本筆記帳</PrimaryButton></Card><Card className="overflow-hidden p-0"><div className="border-b border-gray-100 p-5"><div className="flex items-center justify-between"><div><h2 className="font-black text-gray-950">當日明細</h2><p className="mt-1 text-xs font-bold text-gray-400">{date}｜{getDepartmentLabel(department, departments)}</p></div><div className="text-right text-xs font-black"><p className="text-[#06C755]">收入 {money(incomeTotal)}</p><p className="mt-1 text-red-500">支出 {money(expenseTotal)}</p></div></div></div><DetailList records={visibleRecords} showDepartment={false} /></Card>{isAdmin && <Card className="overflow-hidden p-0"><div className="border-b border-gray-100 p-5"><div className="flex items-center justify-between"><div><h2 className="font-black text-gray-950">現金帳明細</h2><p className="mt-1 text-xs font-bold text-gray-400">{adminQueryDate}｜全部部門</p></div><div className="text-right text-xs font-black"><p className="text-[#06C755]">收入 {money(adminIncome)}</p><p className="mt-1 text-red-500">支出 {money(adminExpense)}</p></div></div></div><div className="border-b border-gray-100 px-5 py-4"><Field label="查詢日期"><Input type="date" value={adminQueryDate} onChange={(e) => setAdminQueryDate(e.target.value)} /></Field></div><DetailList records={adminDayRecords} showDepartment /></Card>}</div>;
}

function MonthlyFixed({ departments, fixedData, setFixedData, fixedRecords, setFixedRecords }) {
  const [month, setMonth] = useState("2026-05");
  const [department, setDepartment] = useState(departments[0]?.value || "bakery");
  const [items, setItems] = useState(fixedData[departments[0]?.value || "bakery"] || []);
  const [expandedId, setExpandedId] = useState("");
  const [drafts, setDrafts] = useState({});
  function saveRecord() { const clean = items.filter((i) => String(i.label || "").trim()).map((i) => ({ label: i.label, amount: Number(i.amount || 0) })); const id = `fixed_${month}_${department}`; const record = { id, month, department, items: clean }; setFixedRecords((prev) => prev.some((r) => r.id === id) ? prev.map((r) => r.id === id ? record : r) : [record, ...prev]); setFixedData((prev) => ({ ...prev, [department]: clean })); }
  function loadRecord(m, d) { const record = fixedRecords.find((r) => r.month === m && r.department === d); setItems(record ? record.items.map((x) => ({ ...x })) : []); }
  function startEdit(record) { setExpandedId(record.id); setDrafts((prev) => ({ ...prev, [record.id]: { ...record, items: record.items.map((i) => ({ ...i })) } })); }
  function updateDraft(id, field, value) { setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } })); }
  function updateDraftItem(id, index, field, value) { setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], items: prev[id].items.map((item, i) => i === index ? { ...item, [field]: value } : item) } })); }
  function saveInline(id) { const draft = drafts[id]; const clean = draft.items.filter((i) => String(i.label || "").trim()).map((i) => ({ label: i.label, amount: Number(i.amount || 0) })); const next = { ...draft, items: clean }; setFixedRecords((prev) => prev.map((r) => r.id === id ? next : r)); setFixedData((prev) => ({ ...prev, [next.department]: clean })); setExpandedId(""); }
  function deleteRecord(id) { const target = fixedRecords.find((r) => r.id === id); setFixedRecords((prev) => prev.filter((r) => r.id !== id)); if (target) setFixedData((prev) => ({ ...prev, [target.department]: [] })); }
  const total = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  return <div className="space-y-5"><PageHeader title="月固定支出" subtitle="每月儲存後保留紀錄，可直接展開修改。" icon={ICONS.settings} /><Card className="space-y-4"><Field label="月份"><Input type="month" value={month} onChange={(e) => { setMonth(e.target.value); loadRecord(e.target.value, department); }} /></Field><Field label="部門"><Select value={department} onChange={(e) => { setDepartment(e.target.value); loadRecord(month, e.target.value); }}>{departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select></Field></Card><Card className="overflow-hidden p-0"><div className="bg-slate-800 px-4 py-3 text-center text-lg font-black text-white">{month} {getDepartmentLabel(department, departments)} 固定支出設定</div><div className="divide-y divide-gray-100">{items.map((item, index) => <div key={index} className="grid grid-cols-[1fr_120px_48px] items-center gap-2 px-4 py-3"><Input value={item.label} onChange={(e) => setItems((prev) => prev.map((x, i) => i === index ? { ...x, label: e.target.value } : x))} /><Input type="number" value={item.amount} onChange={(e) => setItems((prev) => prev.map((x, i) => i === index ? { ...x, amount: e.target.value } : x))} className="text-right" /><button type="button" onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))} className="h-10 rounded-xl bg-red-50 text-red-500">×</button></div>)}</div><div className="grid grid-cols-[1fr_120px_48px] bg-green-100 px-4 py-3 font-black"><div>合計</div><div className="text-right">{plainMoney(total)}</div><div /></div></Card><div className="grid grid-cols-2 gap-3"><SmallButton type="button" onClick={() => setItems((prev) => [...prev, { label: "", amount: "" }])} className="rounded-2xl py-3">新增費用</SmallButton><PrimaryButton type="button" onClick={saveRecord}>儲存設定</PrimaryButton></div><Card className="overflow-hidden p-0"><div className="border-b border-gray-100 p-5"><h2 className="font-black text-gray-950">固定支出紀錄</h2></div><div className="divide-y divide-gray-100">{fixedRecords.map((record) => { const total = record.items.reduce((s, i) => s + Number(i.amount || 0), 0); const draft = drafts[record.id]; return <div key={record.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex gap-2"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-black text-gray-500">{record.month}</span><span className="font-black text-gray-950">{getDepartmentLabel(record.department, departments)}</span></div><p className="mt-2 text-xs font-bold text-gray-400">{record.items.length} 個項目｜合計 {money(total)}</p></div><div className="flex gap-2"><SmallButton type="button" tone="gray" onClick={() => startEdit(record)}>編輯</SmallButton><SmallButton type="button" tone="red" onClick={() => deleteRecord(record.id)}>刪除</SmallButton></div></div>{expandedId === record.id && draft && <div className="mt-4 space-y-3 rounded-3xl bg-gray-50 p-4"><div className="grid grid-cols-2 gap-3"><Field label="月份"><Input type="month" value={draft.month} onChange={(e) => updateDraft(record.id, "month", e.target.value)} /></Field><Field label="部門"><Select value={draft.department} onChange={(e) => updateDraft(record.id, "department", e.target.value)}>{departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select></Field></div>{draft.items.map((item, i) => <div key={i} className="grid grid-cols-[1fr_104px_40px] gap-2"><Input value={item.label} onChange={(e) => updateDraftItem(record.id, i, "label", e.target.value)} /><Input type="number" value={item.amount} onChange={(e) => updateDraftItem(record.id, i, "amount", e.target.value)} /><button type="button" onClick={() => updateDraft(record.id, "items", draft.items.filter((_, idx) => idx !== i))} className="rounded-2xl bg-red-50 text-red-500">×</button></div>)}<div className="grid grid-cols-3 gap-2"><SmallButton type="button" onClick={() => updateDraft(record.id, "items", [...draft.items, { label: "", amount: "" }])}>新增</SmallButton><PrimaryButton type="button" onClick={() => saveInline(record.id)}>儲存</PrimaryButton><SmallButton type="button" tone="gray" onClick={() => setExpandedId("")}>收合</SmallButton></div></div>}</div>; })}</div></Card></div>;
}

function ProfitReportTable({ title, rows, onExportCsv }) { const rowClass = (kind) => kind === "final" ? "bg-orange-100 font-black" : kind === "section" ? "bg-green-100 font-black" : kind === "category" ? "bg-white font-black text-sky-700" : "bg-white text-gray-600"; return <Card className="overflow-hidden p-0"><div className="bg-slate-800 px-4 py-3 text-white"><h2 className="text-center text-base font-black">{title}</h2><button type="button" onClick={onExportCsv} className="mt-3 w-full rounded-2xl bg-white/15 px-3 py-2 text-xs font-black">輸出 CSV</button></div><div className="divide-y divide-gray-100 md:hidden">{rows.map((row, i) => <div key={i} className={`px-4 py-3 ${rowClass(row.kind)}`}><div className="flex justify-between gap-3"><div className={row.kind === "item" ? "pl-4 text-sm" : "text-sm"}>{row.kind === "item" ? `- ${row.name}` : row.name}</div><div className="text-right"><div className="font-black">{plainMoney(row.amount)}</div><div className="text-xs text-gray-500">{row.percent}</div></div></div></div>)}</div><div className="hidden overflow-x-auto md:block"><table className="w-full text-sm"><tbody>{rows.map((row, i) => <tr key={i} className={rowClass(row.kind)}><td className="border px-2 py-2">{row.kind === "item" ? `- ${row.name}` : row.name}</td><td className="border px-2 py-2 text-right">{plainMoney(row.amount)}</td><td className="border px-2 py-2 text-right">{row.percent}</td></tr>)}</tbody></table></div></Card>; }
function ProfitLoss({ currentUser, isAdmin, departments, dailyCashData, fixedData }) { const [month, setMonth] = useState("2026-05"); const [department, setDepartment] = useState(currentUser.department === "all" ? departments[0]?.value || "bakery" : currentUser.department); const available = isAdmin ? departments : departments.filter((d) => d.value === currentUser.department); const summary = calcDepartment(department, dailyCashData, fixedData, departments); const rows = buildProfitReportRows(department, dailyCashData, fixedData, departments); function exportCsv() { downloadCsv(`${month}_${getDepartmentLabel(department, departments)}_損益表.csv`, [["會計科目", "金額", "%"], ...rows.map((r) => [r.kind === "item" ? `- ${r.name}` : r.name, r.amount, r.percent])]); } return <div className="space-y-5"><PageHeader title="部門損益表" subtitle="手機版營運月報表。" icon={ICONS.chart} /><Card className="space-y-4"><Field label="月份"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field><Field label="部門"><Select value={department} onChange={(e) => setDepartment(e.target.value)}>{available.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select></Field></Card><div className="grid grid-cols-2 gap-3"><StatCard label="營業收入" value={summary.revenue} /><StatCard label="營業成本" value={summary.cashExpense} /><StatCard label="營運費用" value={summary.fixedExpense} /><StatCard label="稅前損益" value={summary.netProfit} tone="green" /></div><Card><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={[{ name: "收入", 金額: summary.revenue }, { name: "成本", 金額: summary.cashExpense }, { name: "費用", 金額: summary.fixedExpense }]}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(v) => money(v)} /><Bar dataKey="金額" fill={GREEN} radius={[12, 12, 0, 0]} /></BarChart></ResponsiveContainer></div></Card><ProfitReportTable title={`${month} ${getDepartmentLabel(department, departments)} 營運月報表`} rows={rows} onExportCsv={exportCsv} /></div>; }
function Summary({ departments, dailyCashData, fixedData }) { const [month, setMonth] = useState("2026-05"); const rows = departments.map((d) => calcDepartment(d.value, dailyCashData, fixedData, departments)); const total = rows.reduce((a, r) => ({ revenue: a.revenue + r.revenue, cashExpense: a.cashExpense + r.cashExpense, fixedExpense: a.fixedExpense + r.fixedExpense, totalExpense: a.totalExpense + r.totalExpense, netProfit: a.netProfit + r.netProfit }), { revenue: 0, cashExpense: 0, fixedExpense: 0, totalExpense: 0, netProfit: 0 }); function exportCsv() { downloadCsv(`${month}_企業總損益表.csv`, [["部門", "收入", "現金支出", "固定支出", "淨利"], ...rows.map((r) => [r.departmentLabel, r.revenue, r.cashExpense, r.fixedExpense, r.netProfit]), ["合計", total.revenue, total.cashExpense, total.fixedExpense, total.netProfit]]); } return <div className="space-y-5"><PageHeader title="總損益表" subtitle="公司全部部門彙總。" icon={ICONS.chart} /><Card className="space-y-4"><Field label="月份"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field><SmallButton type="button" onClick={exportCsv} className="rounded-2xl py-3">輸出 CSV</SmallButton></Card><section className="rounded-[28px] bg-[#06C755] p-5 text-white"><p className="text-sm font-bold text-white/75">公司稅前淨利</p><p className="mt-1 text-4xl font-black">{money(total.netProfit)}</p></section><Card><div className="h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows.map((r) => ({ name: r.departmentLabel, value: r.revenue }))} cx="50%" cy="50%" outerRadius={92} dataKey="value" label={({ name, percent: p }) => `${name} ${(p * 100).toFixed(0)}%`}>{rows.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(v) => money(v)} /></PieChart></ResponsiveContainer></div></Card><Card className="overflow-hidden p-0"><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><tbody>{rows.map((r) => <tr key={r.department}><td className="border px-2 py-2 font-black">{r.departmentLabel}</td><td className="border px-2 py-2 text-right">{plainMoney(r.revenue)}</td><td className="border px-2 py-2 text-right">{plainMoney(r.cashExpense)}</td><td className="border px-2 py-2 text-right">{plainMoney(r.fixedExpense)}</td><td className="border px-2 py-2 text-right font-black">{plainMoney(r.netProfit)}</td></tr>)}</tbody></table></div></Card></div>; }
function ReportsPage(props) { const [open, setOpen] = useState("summary"); return <div className="space-y-5"><PageHeader title="報表中心" subtitle="總損益表與部門損益表。" icon={ICONS.chart} /><AccordionSection title="總損益表" subtitle="查看全部部門彙總" icon={ICONS.chart} open={open === "summary"} onToggle={() => setOpen(open === "summary" ? "" : "summary")}><Summary {...props} /></AccordionSection><AccordionSection title="部門損益表" subtitle="查看單一部門營運月報表" icon={ICONS.chart} open={open === "profit"} onToggle={() => setOpen(open === "profit" ? "" : "profit")}><ProfitLoss currentUser={{ role: "admin", department: "all" }} isAdmin {...props} /></AccordionSection></div>; }

function VendorBills({ vendorBills, setVendorBills, vendors, departments }) {
  const monthlyVendors = vendors.filter((v) => v.type === "monthly");
  const defaultVendor = monthlyVendors[0];
  const defaultBillMonth = getTodayDate().slice(0, 7);
  const [form, setForm] = useState({ billMonth: defaultBillMonth, vendorId: defaultVendor?.id || "", vendorCode: defaultVendor?.vendorCode || "", vendorName: defaultVendor?.vendorName || "", department: defaultVendor?.department || "bakery", deductPercent: getDeductRule(defaultVendor) || "", startDate: `${defaultBillMonth}-01`, endDate: `${defaultBillMonth}-31`, note: "", billTotal: "", paymentMethod: "現金", checkNumber: "", ticketStatus: "none" });
  const [filterMonth, setFilterMonth] = useState(defaultBillMonth);
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [ticketFilter, setTicketFilter] = useState("all");
  const [expandedId, setExpandedId] = useState("");
  const [drafts, setDrafts] = useState({});

  function getBillMonth(bill) { return bill.billMonth || String(bill.startDate || "").slice(0, 7); }
  function paymentDefaults(source) { return source.paymentMethod === "支票" ? { ...source, ticketStatus: source.ticketStatus && source.ticketStatus !== "none" ? source.ticketStatus : "pending" } : { ...source, checkNumber: "", ticketStatus: "none" }; }
  function updateForm(field, value) { if (field === "vendorId") { const vendor = monthlyVendors.find((v) => v.id === value); setForm((p) => ({ ...p, vendorId: value, vendorCode: vendor?.vendorCode || "", vendorName: vendor?.vendorName || "", department: vendor?.department || "", deductPercent: getDeductRule(vendor) || "" })); } else if (field === "billMonth") { setForm((p) => ({ ...p, billMonth: value })); } else setForm((p) => paymentDefaults({ ...p, [field]: value })); }
  async function saveBill() { if (!form.vendorId || !form.billMonth) return; const id = `bill_${Date.now()}`; const record = { ...paymentDefaults(form), id, billMonth: form.billMonth, billTotal: Number(form.billTotal || 0), deductPercent: String(form.deductPercent || ""), updatedAt: serverTimestamp() }; await setDoc(doc(db, "vendorBills", id), record); setVendorBills((prev) => [record, ...prev]); }
  function filteredBills() { return vendorBills.filter((b) => { const monthOk = !filterMonth || getBillMonth(b) === filterMonth; const depOk = filterDepartment === "all" || b.department === filterDepartment; const status = b.paymentMethod === "支票" ? b.ticketStatus || "pending" : "none"; const ticketOk = ticketFilter === "all" || status === ticketFilter; return monthOk && depOk && ticketOk; }); }
  const bills = filteredBills();
  const sortedBillsForExport = [...bills].sort((a, b) => String(a.vendorCode || "").localeCompare(String(b.vendorCode || ""), "zh-Hant", { numeric: true, sensitivity: "base" }));
  const total = bills.reduce((s, b) => s + Number(b.billTotal || 0), 0);
  const pending = vendorBills.filter((b) => b.paymentMethod === "支票" && (b.ticketStatus || "pending") !== "arrived").length;
  const arrived = vendorBills.filter((b) => b.paymentMethod === "支票" && (b.ticketStatus || "pending") === "arrived").length;
  function exportBills() {
    downloadCsv(`月結貨款帳單_${filterMonth}_${filterDepartment}.csv`, [
      ["結算月份", "廠編", "廠商", "部門", "扣款規則", "開始", "結束", "備註", "總額", "領款", "票號", "到票"],
      ...sortedBillsForExport.map((b) => [
        getBillMonth(b),
        b.vendorCode,
        b.vendorName,
        getDepartmentLabel(b.department, departments),
        b.deductPercent,
        b.startDate,
        b.endDate,
        b.note,
        b.billTotal,
        b.paymentMethod,
        b.checkNumber,
        b.paymentMethod === "支票" ? ((b.ticketStatus || "pending") === "arrived" ? "已到票" : "未到票") : "不適用",
      ]),
    ]);
  }
  function startEdit(bill) { setExpandedId(bill.id); setDrafts((prev) => ({ ...prev, [bill.id]: { ...bill, billMonth: getBillMonth(bill), billTotal: String(bill.billTotal || 0), deductPercent: String(bill.deductPercent || 0) } })); }
  function updateDraft(id, field, value) { setDrafts((prev) => { const d = prev[id] || {}; if (field === "vendorId") { const vendor = monthlyVendors.find((v) => v.id === value); return { ...prev, [id]: { ...d, vendorId: value, vendorCode: vendor?.vendorCode || "", vendorName: vendor?.vendorName || "", department: vendor?.department || "", deductPercent: String(getDeductRule(vendor) || "") } }; } return { ...prev, [id]: paymentDefaults({ ...d, [field]: value }) }; }); }
  async function saveDraft(id) { const d = drafts[id]; const record = { ...paymentDefaults(d), billMonth: d.billMonth || getBillMonth(d), billTotal: Number(d.billTotal || 0), deductPercent: String(d.deductPercent || ""), updatedAt: serverTimestamp() }; await setDoc(doc(db, "vendorBills", id), record, { merge: true }); setVendorBills((prev) => prev.map((b) => b.id === id ? record : b)); setExpandedId(""); }
  async function toggleTicket(bill) { if (bill.paymentMethod !== "支票") return; const next = (bill.ticketStatus || "pending") === "arrived" ? "pending" : "arrived"; await setDoc(doc(db, "vendorBills", bill.id), { ticketStatus: next, updatedAt: serverTimestamp() }, { merge: true }); setVendorBills((prev) => prev.map((b) => b.id === bill.id ? { ...b, ticketStatus: next } : b)); }
  async function deleteBill(billId) { await deleteDoc(doc(db, "vendorBills", billId)); setVendorBills((prev) => prev.filter((b) => b.id !== billId)); }
  return <div className="space-y-5"><PageHeader title="月結貨款帳單" subtitle="以結算月份檢索，不再用開始 / 結束日期判斷月份。" icon={ICONS.vendor} /><Card className="space-y-4"><Field label="結算月份"><Input type="month" value={form.billMonth} onChange={(e) => updateForm("billMonth", e.target.value)} /></Field><Field label="月結廠商"><SearchableVendorSelect value={form.vendorId} onChange={(nextVendorId) => updateForm("vendorId", nextVendorId)} vendors={monthlyVendors} departments={departments} placeholder="輸入月結廠商名稱或代碼搜尋" /></Field><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="開始日期"><Input type="date" value={form.startDate} onChange={(e) => updateForm("startDate", e.target.value)} /></Field><Field label="結束日期"><Input type="date" value={form.endDate} onChange={(e) => updateForm("endDate", e.target.value)} /></Field></div><Field label="帳單總額"><Input type="number" value={form.billTotal} onChange={(e) => updateForm("billTotal", e.target.value)} /></Field><Field label="領款方式"><Select value={form.paymentMethod} onChange={(e) => updateForm("paymentMethod", e.target.value)}><option value="現金">現金</option><option value="支票">支票</option></Select></Field>{form.paymentMethod === "支票" && <><Field label="支票號碼"><Input value={form.checkNumber} onChange={(e) => updateForm("checkNumber", e.target.value)} /></Field><Field label="到票狀態"><Select value={form.ticketStatus || "pending"} onChange={(e) => updateForm("ticketStatus", e.target.value)}><option value="pending">未到票</option><option value="arrived">已到票</option></Select></Field></>}<Field label="帳單備註"><Input value={form.note} onChange={(e) => updateForm("note", e.target.value)} /></Field><PrimaryButton type="button" onClick={saveBill}>新增月結貨款帳單</PrimaryButton></Card><Card className="overflow-hidden p-0"><div className="border-b border-gray-100 p-5"><div className="flex items-start justify-between"><div><h2 className="font-black text-gray-950">月結貨款帳單清單</h2><p className="mt-1 text-xs font-bold text-gray-400">檢索 {bills.length} 筆｜未到票 {pending}｜已到票 {arrived}</p></div><div className="text-right"><p className="font-black text-[#06C755]">{money(total)}</p><SmallButton type="button" onClick={exportBills}>輸出檔案</SmallButton></div></div></div><div className="space-y-3 border-b border-gray-100 p-5"><div className="grid grid-cols-2 gap-3"><Field label="結算月份"><Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} /></Field><Field label="部門"><Select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}><option value="all">全部部門</option>{departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select></Field></div><Field label="到票"><Select value={ticketFilter} onChange={(e) => setTicketFilter(e.target.value)}><option value="all">全部</option><option value="pending">未到票</option><option value="arrived">已到票</option><option value="none">非支票</option></Select></Field></div><div className="divide-y divide-gray-100">{bills.map((bill) => { const draft = drafts[bill.id]; const isTicket = bill.paymentMethod === "支票"; const ticketArrived = (bill.ticketStatus || "pending") === "arrived"; return <div key={bill.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-[#06C755]/10 px-2 py-1 text-xs font-black text-[#06C755]">{getBillMonth(bill)}</span><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-black text-gray-500">{bill.vendorCode}</span><span className="font-black">{bill.vendorName}</span><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-black text-gray-500">{getDepartmentLabel(bill.department, departments)}</span>{isTicket && <span className={`rounded-full px-2 py-1 text-xs font-black ${ticketArrived ? "bg-[#06C755]/10 text-[#06C755]" : "bg-orange-50 text-orange-500"}`}>{ticketArrived ? "已到票" : "未到票"}</span>}</div><p className="mt-2 text-xs text-gray-400">日期範圍：{bill.startDate || "未填"} ～ {bill.endDate || "未填"}</p><p className="mt-1 text-xs font-bold text-gray-500">領款：{bill.paymentMethod}{isTicket ? `｜票號 ${bill.checkNumber || "未填"}` : ""}</p></div><div className="text-right"><p className="font-black">{money(bill.billTotal)}</p><div className="mt-3 flex flex-col gap-2"><SmallButton type="button" tone="gray" onClick={() => startEdit(bill)}>編輯</SmallButton>{isTicket && <SmallButton type="button" onClick={() => toggleTicket(bill)}>{ticketArrived ? "改未到" : "到票追蹤"}</SmallButton>}<SmallButton type="button" tone="red" onClick={() => deleteBill(bill.id)}>刪除</SmallButton></div></div></div>{expandedId === bill.id && draft && <div className="mt-4 space-y-3 rounded-3xl bg-gray-50 p-4"><Field label="結算月份"><Input type="month" value={draft.billMonth || getBillMonth(draft)} onChange={(e) => updateDraft(bill.id, "billMonth", e.target.value)} /></Field><Field label="月結廠商"><SearchableVendorSelect value={draft.vendorId} onChange={(nextVendorId) => updateDraft(bill.id, "vendorId", nextVendorId)} vendors={monthlyVendors} departments={departments} placeholder="輸入月結廠商名稱或代碼搜尋" /></Field><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="開始"><Input type="date" value={draft.startDate || ""} onChange={(e) => updateDraft(bill.id, "startDate", e.target.value)} /></Field><Field label="結束"><Input type="date" value={draft.endDate || ""} onChange={(e) => updateDraft(bill.id, "endDate", e.target.value)} /></Field></div><Field label="帳單總額"><Input type="number" value={draft.billTotal} onChange={(e) => updateDraft(bill.id, "billTotal", e.target.value)} /></Field><Field label="領款方式"><Select value={draft.paymentMethod} onChange={(e) => updateDraft(bill.id, "paymentMethod", e.target.value)}><option value="現金">現金</option><option value="支票">支票</option></Select></Field>{draft.paymentMethod === "支票" && <><Field label="支票號碼"><Input value={draft.checkNumber} onChange={(e) => updateDraft(bill.id, "checkNumber", e.target.value)} /></Field><Field label="到票狀態"><Select value={draft.ticketStatus || "pending"} onChange={(e) => updateDraft(bill.id, "ticketStatus", e.target.value)}><option value="pending">未到票</option><option value="arrived">已到票</option></Select></Field></>}<div className="grid grid-cols-2 gap-2"><PrimaryButton type="button" onClick={() => saveDraft(bill.id)}>儲存修改</PrimaryButton><SmallButton type="button" tone="gray" onClick={() => setExpandedId("")}>收合</SmallButton></div></div>}</div>; })}</div></Card></div>;
}

function AccountingSettings({ categories, setCategories, departments = DEFAULT_DEPARTMENTS }) {
  const [type, setType] = useState("expense");
  const [newCategory, setNewCategory] = useState("");
  const [newItems, setNewItems] = useState({});
  const [newItemDepartments, setNewItemDepartments] = useState({});
  const options = getCategoryOptions(categories, type);

  async function persistCategories(nextCategories) {
    setCategories(nextCategories);
    await setDoc(doc(db, "settings", "categories"), { categories: nextCategories, updatedAt: serverTimestamp() }, { merge: true });
  }

  function updateTypeOptions(updater) {
    const nextCategories = {
      ...categories,
      [type]: {
        ...categories[type],
        options: updater(categories[type]?.options || []),
      },
    };
    persistCategories(nextCategories);
  }

  function addCategory() {
    if (!newCategory.trim()) return;
    updateTypeOptions((prev) => [...prev, { id: `cat_${Date.now()}`, label: newCategory.trim(), department: "", items: [] }]);
    setNewCategory("");
  }

  function updateCategory(id, field, value) {
    updateTypeOptions((prev) => prev.map((category) => (category.id === id ? { ...category, [field]: value } : category)));
  }

  function deleteCategory(id) {
    updateTypeOptions((prev) => prev.filter((category) => category.id !== id));
  }

  function addItem(id) {
    const value = (newItems[id] || "").trim();
    if (!value) return;
    const itemDepartment = newItemDepartments[id] || "";
    updateTypeOptions((prev) => prev.map((category) => {
      if (category.id !== id) return category;
      const nextItems = normalizeAccountingItems(category.items || []);
      return { ...category, items: [...nextItems, { label: value, department: itemDepartment }] };
    }));
    setNewItems((prev) => ({ ...prev, [id]: "" }));
    setNewItemDepartments((prev) => ({ ...prev, [id]: "" }));
  }

  function updateItem(categoryId, itemIndex, field, value) {
    updateTypeOptions((prev) => prev.map((category) => {
      if (category.id !== categoryId) return category;
      const nextItems = normalizeAccountingItems(category.items || []).map((item, index) => index === itemIndex ? { ...item, [field]: value } : item);
      return { ...category, items: nextItems };
    }));
  }

  function deleteItem(categoryId, itemIndex) {
    updateTypeOptions((prev) => prev.map((category) => {
      if (category.id !== categoryId) return category;
      return { ...category, items: normalizeAccountingItems(category.items || []).filter((_, index) => index !== itemIndex) };
    }));
  }

  return <div className="space-y-5"><div className="grid grid-cols-2 rounded-2xl bg-gray-50 p-1"><button type="button" onClick={() => setType("expense")} className={`rounded-xl px-4 py-3 font-black ${type === "expense" ? "bg-red-500 text-white" : "text-red-500"}`}>支出分類</button><button type="button" onClick={() => setType("income")} className={`rounded-xl px-4 py-3 font-black ${type === "income" ? "bg-[#06C755] text-white" : "text-[#06C755]"}`}>收入分類</button></div><div className="grid grid-cols-[1fr_84px] gap-2"><Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="新增細項分類" /><SmallButton type="button" onClick={addCategory}>新增</SmallButton></div><p className="text-xs font-bold leading-5 text-gray-400">可為分類或記帳項目設定歸帳部門。每日記帳選到該分類 / 項目時，歸帳部門會自動連動；未設定則維持手動選擇。</p>{options.map((cat) => { const itemObjects = normalizeAccountingItems(cat.items || []); return <div key={cat.id} className="rounded-3xl border border-gray-100 p-4"><div className="grid grid-cols-[1fr_44px] gap-2"><Input value={cat.label} onChange={(e) => updateCategory(cat.id, "label", e.target.value)} /><button type="button" onClick={() => deleteCategory(cat.id)} className="rounded-2xl bg-red-50 text-red-500">×</button></div><div className="mt-3"><Field label="分類預設歸帳部門"><Select value={cat.department || ""} onChange={(e) => updateCategory(cat.id, "department", e.target.value)}><option value="">未設定，手動選擇</option>{departments.map((dept) => <option key={dept.value} value={dept.value}>{dept.label}</option>)}</Select></Field></div><div className="mt-4 space-y-2">{itemObjects.map((item, i) => <div key={`${cat.id}_${i}`} className="rounded-2xl bg-gray-50 p-3"><div className="grid grid-cols-[1fr_40px] gap-2"><Input value={item.label} onChange={(e) => updateItem(cat.id, i, "label", e.target.value)} /><button type="button" onClick={() => deleteItem(cat.id, i)} className="rounded-2xl bg-red-50 text-red-500">×</button></div><div className="mt-2"><Field label="此項目歸帳部門"><Select value={item.department || ""} onChange={(e) => updateItem(cat.id, i, "department", e.target.value)}><option value="">未設定，跟隨分類或手動</option>{departments.map((dept) => <option key={dept.value} value={dept.value}>{dept.label}</option>)}</Select></Field></div></div>)}<div className="rounded-2xl border border-dashed border-gray-200 p-3"><Input value={newItems[cat.id] || ""} onChange={(e) => setNewItems((p) => ({ ...p, [cat.id]: e.target.value }))} placeholder="新增記帳項目" /><div className="mt-2 grid grid-cols-[1fr_84px] gap-2"><Select value={newItemDepartments[cat.id] || ""} onChange={(e) => setNewItemDepartments((p) => ({ ...p, [cat.id]: e.target.value }))}><option value="">未設定部門</option>{departments.map((dept) => <option key={dept.value} value={dept.value}>{dept.label}</option>)}</Select><SmallButton type="button" onClick={() => addItem(cat.id)}>新增</SmallButton></div></div></div></div>; })}</div>;
}
function DepartmentSettings({ departments, setDepartments, setDailyCashData, setFixedData }) { const [name, setName] = useState(""); function add() { if (!name.trim()) return; const value = name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || `department_${Date.now()}`; setDepartments((p) => [...p, { value, label: name.trim() }]); setDailyCashData((p) => ({ ...p, [value]: [] })); setFixedData((p) => ({ ...p, [value]: [] })); setName(""); } return <div className="space-y-4"><div className="grid grid-cols-[1fr_84px] gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="新增部門" /><SmallButton type="button" onClick={add}>新增</SmallButton></div>{departments.map((d, i) => <div key={d.value} className="rounded-3xl border border-gray-100 p-4"><Field label="部門名稱"><Input value={d.label} onChange={(e) => setDepartments((p) => p.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} /></Field><Field label="部門代碼"><Input value={d.value} onChange={(e) => setDepartments((p) => p.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} /></Field></div>)}</div>; }
function VendorManagement({ vendors, setVendors, departments }) {
  const empty = { vendorCode: "", vendorName: "", type: "cash", department: departments[0]?.value || "bakery", deductRule: "" };
  const [form, setForm] = useState(empty);
  const [filter, setFilter] = useState("cash");
  const [expandedVendorId, setExpandedVendorId] = useState("");
  const [vendorDrafts, setVendorDrafts] = useState({});

  async function save() {
    if (!form.vendorCode || !form.vendorName) return;
    const id = `vendor_${Date.now()}`;
    const record = { ...form, id, deductRule: String(form.deductRule || ""), deductPercent: form.deductRule || "", updatedAt: serverTimestamp() };
    await setDoc(doc(db, "vendors", id), record);
    setVendors((p) => [record, ...p]);
    setForm({ ...empty, type: filter });
  }

  function startVendorEdit(vendor) {
    setExpandedVendorId(vendor.id);
    setVendorDrafts((prev) => ({
      ...prev,
      [vendor.id]: {
        ...vendor,
        deductRule: String(getDeductRule(vendor) || ""),
        deductPercent: String(getDeductRule(vendor) || ""),
      },
    }));
  }

  function updateVendorDraft(vendorId, field, value) {
    setVendorDrafts((prev) => ({
      ...prev,
      [vendorId]: {
        ...(prev[vendorId] || {}),
        [field]: value,
      },
    }));
  }

  async function saveVendorEdit(vendorId) {
    const draft = vendorDrafts[vendorId];
    if (!draft || !draft.vendorCode || !draft.vendorName) return;
    const record = {
      ...draft,
      deductRule: String(draft.deductRule ?? draft.deductPercent ?? ""),
      deductPercent: String(draft.deductRule ?? draft.deductPercent ?? ""),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, "vendors", vendorId), record, { merge: true });
    setVendors((prev) => prev.map((item) => (item.id === vendorId ? record : item)));
    setExpandedVendorId("");
  }

  async function deleteVendor(vendorId) {
    await deleteDoc(doc(db, "vendors", vendorId));
    setVendors((prev) => prev.filter((item) => item.id !== vendorId));
  }

  const filteredVendors = vendors.filter((v) => v.type === filter);

  return <div className="space-y-5"><div className="grid grid-cols-2 rounded-2xl bg-gray-50 p-1"><button type="button" onClick={() => setFilter("cash")} className={`rounded-xl px-4 py-3 font-black ${filter === "cash" ? "bg-[#06C755] text-white" : "text-[#06C755]"}`}>現結廠商</button><button type="button" onClick={() => setFilter("monthly")} className={`rounded-xl px-4 py-3 font-black ${filter === "monthly" ? "bg-[#06C755] text-white" : "text-[#06C755]"}`}>月結廠商</button></div><div className="space-y-3 rounded-3xl bg-gray-50 p-4"><h3 className="font-black text-gray-950">新增廠商</h3><div className="grid grid-cols-1 gap-3"><Field label="廠編"><Input value={form.vendorCode} onChange={(e) => setForm((p) => ({ ...p, vendorCode: e.target.value }))} /></Field><Field label="扣％ / 輸入規則"><TextArea rows={4} value={form.deductRule} onChange={(e) => setForm((p) => ({ ...p, deductRule: e.target.value, deductPercent: e.target.value }))} placeholder={`例如：
每月貨款扣 3%
滿 50,000 扣 5%
特殊品項不扣`} /></Field></div><Field label="廠商名稱"><Input value={form.vendorName} onChange={(e) => setForm((p) => ({ ...p, vendorName: e.target.value }))} /></Field><Field label="對應部門"><Select value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}>{departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select></Field><Field label="廠商類型"><Select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}><option value="cash">現結廠商</option><option value="monthly">月結廠商</option></Select></Field><PrimaryButton type="button" onClick={save}>新增廠商</PrimaryButton></div><div className="space-y-3">{filteredVendors.length === 0 && <div className="rounded-3xl bg-gray-50 p-4 text-sm font-bold text-gray-400">目前沒有{filter === "cash" ? "現結" : "月結"}廠商。</div>}{filteredVendors.map((v) => { const draft = vendorDrafts[v.id]; const isOpen = expandedVendorId === v.id; return <div key={v.id} className="rounded-3xl border border-gray-100 p-4"><div className="flex justify-between gap-3"><button type="button" onClick={() => startVendorEdit(v)} className="min-w-0 flex-1 text-left"><p className="font-black text-gray-950">{v.vendorCode}｜{v.vendorName}</p><p className="mt-1 text-xs font-bold text-gray-400">{getDepartmentLabel(v.department, departments)}｜扣款規則：{getDeductRule(v) || "未設定"}</p><p className="mt-1 text-xs font-bold text-gray-300">點擊或按編輯可展開修改</p></button><div className="flex shrink-0 flex-col gap-2"><SmallButton type="button" tone="gray" onClick={() => startVendorEdit(v)}>編輯</SmallButton><SmallButton type="button" tone="red" onClick={() => deleteVendor(v.id)}>刪除</SmallButton></div></div>{isOpen && draft && <div className="mt-4 space-y-3 rounded-3xl bg-gray-50 p-4"><div className="grid grid-cols-1 gap-3"><Field label="廠編"><Input value={draft.vendorCode} onChange={(e) => updateVendorDraft(v.id, "vendorCode", e.target.value)} /></Field><Field label="扣％ / 輸入規則"><TextArea rows={4} value={draft.deductRule ?? draft.deductPercent ?? ""} onChange={(e) => { updateVendorDraft(v.id, "deductRule", e.target.value); updateVendorDraft(v.id, "deductPercent", e.target.value); }} placeholder={`例如：
每月貨款扣 3%
滿 50,000 扣 5%
特殊品項不扣`} /></Field></div><Field label="廠商名稱"><Input value={draft.vendorName} onChange={(e) => updateVendorDraft(v.id, "vendorName", e.target.value)} /></Field><Field label="對應部門"><Select value={draft.department} onChange={(e) => updateVendorDraft(v.id, "department", e.target.value)}>{departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select></Field><Field label="廠商類型"><Select value={draft.type} onChange={(e) => updateVendorDraft(v.id, "type", e.target.value)}><option value="cash">現結廠商</option><option value="monthly">月結廠商</option></Select></Field><div className="grid grid-cols-2 gap-2"><PrimaryButton type="button" onClick={() => saveVendorEdit(v.id)}>儲存修改</PrimaryButton><SmallButton type="button" tone="gray" className="rounded-2xl py-3" onClick={() => setExpandedVendorId("")}>收合</SmallButton></div></div>}</div>; })}</div></div>; }
function UserManagement({ departments, users, setUsers, joinRequests, setJoinRequests }) {
  const [expanded, setExpanded] = useState("");
  const [newUser, setNewUser] = useState({ id: "", name: "", role: "staff", department: departments[0]?.value || "bakery" });

  async function saveUser(userRecord) {
    if (!userRecord.id?.trim()) return;
    const record = {
      name: userRecord.name || "未命名員工",
      role: userRecord.role || "staff",
      department: userRecord.role === "admin" ? "all" : userRecord.department,
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, "users", userRecord.id), record, { merge: true });
    setUsers((prev) => [{ id: userRecord.id, ...record }, ...prev.filter((item) => item.id !== userRecord.id)]);
  }

  async function deleteUser(id) {
    await deleteDoc(doc(db, "users", id));
    setUsers((prev) => prev.filter((item) => item.id !== id));
  }

  async function approveRequest(request) {
    const nextUser = { id: request.lineUserId || request.id, name: request.name || "未命名員工", role: "staff", department: request.department || departments[0]?.value || "bakery" };
    await saveUser(nextUser);
    await setDoc(doc(db, "joinRequests", request.id), { status: "approved", approvedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    setJoinRequests((prev) => prev.filter((item) => item.id !== request.id));
  }

  async function rejectRequest(request) {
    await setDoc(doc(db, "joinRequests", request.id), { status: "rejected", updatedAt: serverTimestamp() }, { merge: true });
    setJoinRequests((prev) => prev.filter((item) => item.id !== request.id));
  }

  const pendingRequests = (joinRequests || []).filter((item) => item.status !== "approved" && item.status !== "rejected");
  const displayedUsers = users?.length ? users : initialUsers;

  return <div className="space-y-5"><Card className="space-y-4 bg-gray-50 shadow-none ring-0"><h3 className="font-black text-gray-950">新增員工</h3><Field label="LINE userId"><Input value={newUser.id} onChange={(e) => setNewUser((prev) => ({ ...prev, id: e.target.value }))} placeholder="例如：U66f9f183c8a6df1d673d909b7b60a2de" /></Field><Field label="姓名"><Input value={newUser.name} onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))} placeholder="請輸入員工姓名" /></Field><div className="grid grid-cols-2 gap-2"><Field label="角色"><Select value={newUser.role} onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value, department: e.target.value === "admin" ? "all" : prev.department }))}>{ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</Select></Field><Field label="部門"><Select value={newUser.department} onChange={(e) => setNewUser((prev) => ({ ...prev, department: e.target.value }))} disabled={newUser.role === "admin"}><option value="all">全部部門</option>{departments.map((dept) => <option key={dept.value} value={dept.value}>{dept.label}</option>)}</Select></Field></div><PrimaryButton type="button" onClick={() => { saveUser(newUser); setNewUser({ id: "", name: "", role: "staff", department: departments[0]?.value || "bakery" }); }}>新增員工</PrimaryButton></Card>{pendingRequests.length > 0 && <Card className="space-y-3"><h3 className="font-black text-gray-950">新員工加入申請</h3>{pendingRequests.map((request) => <div key={request.id} className="rounded-3xl border border-gray-100 p-4"><p className="font-black text-gray-950">{request.name || "未命名員工"}</p><p className="mt-1 break-all text-xs font-bold text-gray-400">LINE userId：{request.lineUserId || request.id}</p><p className="mt-1 text-xs font-bold text-gray-400">申請部門：{getDepartmentLabel(request.department, departments)}</p><div className="mt-3 grid grid-cols-2 gap-2"><SmallButton type="button" onClick={() => approveRequest(request)} className="rounded-2xl py-3">核准加入</SmallButton><SmallButton type="button" tone="red" onClick={() => rejectRequest(request)} className="rounded-2xl py-3">拒絕</SmallButton></div></div>)}</Card>}<div className="space-y-3">{displayedUsers.map((u, i) => <Card key={u.id} className="p-0"><button type="button" onClick={() => setExpanded(expanded === u.id ? "" : u.id)} className="flex w-full justify-between p-5 text-left"><div><p className="font-black">{u.name}</p><p className="break-all text-xs font-bold text-gray-400">{u.id}</p><p className="mt-1 text-xs font-bold text-gray-400">{getRoleLabel(u.role)}｜{getDepartmentLabel(u.department, departments)}</p></div><span>{ICONS.chevron}</span></button>{expanded === u.id && <div className="space-y-3 bg-gray-50 p-5"><Field label="LINE userId"><Input value={u.id} readOnly className="bg-gray-100 text-gray-400" /></Field><Field label="姓名"><Input value={u.name} onChange={(e) => setUsers((p) => p.map((x) => x.id === u.id ? { ...x, name: e.target.value } : x))} /></Field><Field label="角色"><Select value={u.role} onChange={(e) => setUsers((p) => p.map((x) => x.id === u.id ? { ...x, role: e.target.value, department: e.target.value === "admin" ? "all" : x.department } : x))}>{ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</Select></Field><Field label="部門"><Select value={u.department} onChange={(e) => setUsers((p) => p.map((x) => x.id === u.id ? { ...x, department: e.target.value } : x))}><option value="all">全部部門</option>{departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select></Field><div className="grid grid-cols-2 gap-2"><PrimaryButton type="button" onClick={() => saveUser(u)}>儲存修改</PrimaryButton><SmallButton type="button" tone="red" className="rounded-2xl py-3" onClick={() => deleteUser(u.id)}>刪除</SmallButton></div></div>}</Card>)}</div></div>;
}
function SettingsPage({ categories, setCategories, departments, setDepartments, setDailyCashData, setFixedData, vendors, setVendors, users, setUsers, joinRequests, setJoinRequests }) { const [open, setOpen] = useState("accounting"); return <div className="space-y-5"><PageHeader title="設定" subtitle="管理記帳、廠商、部門與員工。" icon={ICONS.settings} /><AccordionSection title="記帳設定" subtitle="分類與項目" icon={ICONS.wallet} open={open === "accounting"} onToggle={() => setOpen(open === "accounting" ? "" : "accounting")}><AccountingSettings categories={categories} setCategories={setCategories} departments={departments} /></AccordionSection><AccordionSection title="廠商管理" subtitle="現結與月結廠商" icon={ICONS.vendor} open={open === "vendors"} onToggle={() => setOpen(open === "vendors" ? "" : "vendors")}><VendorManagement vendors={vendors} setVendors={setVendors} departments={departments} /></AccordionSection><AccordionSection title="部門管理" subtitle="新增與修改部門" icon={ICONS.settings} open={open === "departments"} onToggle={() => setOpen(open === "departments" ? "" : "departments")}><DepartmentSettings departments={departments} setDepartments={setDepartments} setDailyCashData={setDailyCashData} setFixedData={setFixedData} /></AccordionSection><AccordionSection title="員工管理" subtitle="員工可輸入 LINE userId，也可審核新員工申請" icon={ICONS.settings} open={open === "users"} onToggle={() => setOpen(open === "users" ? "" : "users")}><UserManagement departments={departments} users={users} setUsers={setUsers} joinRequests={joinRequests} setJoinRequests={setJoinRequests} /></AccordionSection></div>; }

export default function App() {
  const [authState, setAuthState] = useState({ loading: true, error: "", lineUserId: "", profile: null, user: null });
  const [page, setPage] = useState("reports");
  const [categories, setCategories] = useState(DEFAULT_DAILY_CATEGORIES);
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS);
  const [dailyCashData, setDailyCashData] = useState({});
  const [fixedData, setFixedData] = useState({});
  const [fixedRecords, setFixedRecords] = useState([]);
  const [vendorBills, setVendorBills] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [users, setUsers] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [exportFile, setExportFile] = useState(null);
  const currentUser = authState.user;
  const isAdmin = currentUser?.role === "admin";
  const tests = useMemo(() => runSelfTests(categories, departments), [categories, departments]);

  useEffect(() => { const handler = (e) => setExportFile(e.detail); window.addEventListener("finance-export-ready", handler); return () => window.removeEventListener("finance-export-ready", handler); }, []);
  useEffect(() => { let mounted = true; async function boot() { try { const result = await loginWithLine(); if (!mounted || !result) return; setAuthState({ loading: false, error: "", lineUserId: result.lineUserId, profile: result.profile, user: result.appUser }); if (!result.appUser) return; const data = await loadSettingsFromFirestore(); if (!mounted) return; setDepartments(data.departments); setCategories(data.categories); setVendors(data.vendors); setDailyCashData(data.dailyCashData); setFixedData(data.fixedData); setFixedRecords(data.fixedRecords); setVendorBills(data.vendorBills); setUsers(data.users || []); setJoinRequests(data.joinRequests || []); } catch (error) { if (!mounted) return; setAuthState((prev) => ({ ...prev, loading: false, error: error.message || "登入失敗" })); } } boot(); return () => { mounted = false; }; }, []);

  if (authState.loading || authState.error || !currentUser) return <LoginScreen authState={authState} />;
  function setAdminPage(nextPage) { if (!isAdmin && nextPage !== "daily") return; setPage(nextPage); }
  return <div className="min-h-screen bg-[#F6F8FA] pb-24 text-gray-950"><div className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-xl items-center px-4 py-3"><div><p className="text-xs font-black uppercase tracking-widest text-[#06C755]">Enterprise Finance</p><p className="text-sm font-black text-gray-950">企業財務系統</p></div></div></div><main className="mx-auto max-w-xl px-4 py-5"><ExportPanel exportFile={exportFile} onClose={() => setExportFile(null)} />{page === "daily" && <DailyCash currentUser={currentUser} isAdmin={isAdmin} categories={categories} departments={departments} dailyCashData={dailyCashData} setDailyCashData={setDailyCashData} vendors={vendors} />}{page === "reports" && isAdmin && <ReportsPage departments={departments} dailyCashData={dailyCashData} fixedData={fixedData} />}{page === "monthly-fixed" && isAdmin && <MonthlyFixed departments={departments} fixedData={fixedData} setFixedData={setFixedData} fixedRecords={fixedRecords} setFixedRecords={setFixedRecords} />}{page === "vendor-bills" && isAdmin && <VendorBills vendorBills={vendorBills} setVendorBills={setVendorBills} vendors={vendors} departments={departments} />}{page === "settings" && isAdmin && <SettingsPage categories={categories} setCategories={setCategories} departments={departments} setDepartments={setDepartments} setDailyCashData={setDailyCashData} setFixedData={setFixedData} vendors={vendors} setVendors={setVendors} users={users} setUsers={setUsers} joinRequests={joinRequests} setJoinRequests={setJoinRequests} />}</main><NavBar page={page} setPage={setAdminPage} isAdmin={isAdmin} /></div>;
}
