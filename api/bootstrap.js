import { getAdmin } from "../lib/firebaseAdmin.js";

const LEGACY_DEPARTMENTS = [
  { value: "bakery", label: "烘焙部", revenueMode: "cash", commissionRate: 0 },
  { value: "supermarket", label: "超市部", revenueMode: "cash", commissionRate: 0 },
  { value: "lottery", label: "台彩部", revenueMode: "mixed_lottery", commissionRate: 6 },
];

const DEFAULT_CATEGORIES = {
  expense: {
    label: "支出",
    options: [
      { id: "cash_purchase", label: "現結貨款", department: "", items: [] },
      { id: "operating_expense", label: "營運支出", department: "", items: ["水電瓦斯", "設備維修", "清潔用品", "廣告行銷"] },
      { id: "staff_expense", label: "人事支出", department: "", items: ["薪資", "獎金", "員工餐費", "加班費"] },
      { id: "other_expense", label: "其他支出", department: "", items: [] },
    ],
  },
  income: {
    label: "收入",
    options: [
      { id: "cash_revenue", label: "現金收入", department: "", items: ["門市現金", "外送現金", "其他現金收入"] },
      { id: "transfer_revenue", label: "轉帳收入", department: "", items: ["銀行轉帳", "LINE Pay", "信用卡"] },
      { id: "other_revenue", label: "其他收入", department: "", items: [] },
    ],
  },
};

function normalizeDepartmentCode(label, index, usedCodes) {
  const ascii = String(label || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^_+|_+$/g, "");

  const base = ascii || `department_${index + 1}`;
  let code = base;
  let suffix = 2;

  while (usedCodes.has(code)) {
    code = `${base}_${suffix}`;
    suffix += 1;
  }

  usedCodes.add(code);
  return code;
}

async function requireFirebaseUser(req, admin) {
  const authorization = String(req.headers.authorization || "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    const error = new Error("Missing Firebase ID token");
    error.statusCode = 401;
    throw error;
  }

  try {
    return await admin.auth().verifyIdToken(match[1]);
  } catch (error) {
    const authError = new Error("Invalid Firebase ID token");
    authError.statusCode = 401;
    throw authError;
  }
}

function mapDepartmentDocument(document) {
  const data = document.data();
  const value = data.value || document.id;
  return {
    value,
    label: data.label || value,
    revenueMode: data.revenueMode || "cash",
    commissionRate: Number(data.commissionRate || 0),
  };
}

async function readBootstrapStatus(admin, uid) {
  const db = admin.firestore();
  const [appSnapshot, departmentSnapshot, currentUserSnapshot, anyUserSnapshot] = await Promise.all([
    db.doc("settings/app").get(),
    db.collection("departments").get(),
    db.doc(`users/${uid}`).get(),
    db.collection("users").limit(1).get(),
  ]);

  const appSettings = appSnapshot.exists ? appSnapshot.data() : {};
  const hasConfiguredApp = Boolean(appSettings.setupCompleted);
  const hasDepartments = !departmentSnapshot.empty;
  const hasAnyUsers = !anyUserSnapshot.empty;
  const setupRequired = !hasConfiguredApp && !hasDepartments && !hasAnyUsers;
  const departments = hasDepartments
    ? departmentSnapshot.docs.map(mapDepartmentDocument)
    : setupRequired
      ? []
      : LEGACY_DEPARTMENTS;

  return {
    setupRequired,
    appSettings: {
      systemName: appSettings.systemName || "企業財務系統",
      setupCompleted: hasConfiguredApp || hasDepartments || hasAnyUsers,
      schemaVersion: Number(appSettings.schemaVersion || 1),
    },
    departments,
    appUser: currentUserSnapshot.exists
      ? { id: currentUserSnapshot.id, ...currentUserSnapshot.data() }
      : null,
  };
}

async function initializeDeployment(admin, decodedUser, payload) {
  const db = admin.firestore();
  const before = await readBootstrapStatus(admin, decodedUser.uid);

  if (!before.setupRequired) {
    const error = new Error("This deployment has already been initialized");
    error.statusCode = 409;
    throw error;
  }

  const systemName = String(payload.systemName || "企業財務系統").trim().slice(0, 80) || "企業財務系統";
  const adminName = String(payload.adminName || decodedUser.lineDisplayName || "管理者").trim().slice(0, 80) || "管理者";
  const labels = Array.from(new Set((payload.departments || [])
    .map((item) => String(item || "").trim().slice(0, 40))
    .filter(Boolean)));

  if (!labels.length) {
    const error = new Error("At least one department is required");
    error.statusCode = 400;
    throw error;
  }

  const usedCodes = new Set();
  const departments = labels.map((label, index) => ({
    value: normalizeDepartmentCode(label, index, usedCodes),
    label,
    revenueMode: "cash",
    commissionRate: 0,
  }));

  const appRef = db.doc("settings/app");
  const categoriesRef = db.doc("settings/categories");
  const adminRef = db.doc(`users/${decodedUser.uid}`);
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (transaction) => {
    const appSnapshot = await transaction.get(appRef);

    if (appSnapshot.exists && appSnapshot.data()?.setupCompleted) {
      const error = new Error("This deployment has already been initialized");
      error.statusCode = 409;
      throw error;
    }

    transaction.set(appRef, {
      systemName,
      setupCompleted: true,
      schemaVersion: 1,
      createdBy: decodedUser.uid,
      createdAt: timestamp,
      updatedAt: timestamp,
    }, { merge: true });

    transaction.set(categoriesRef, {
      categories: DEFAULT_CATEGORIES,
      updatedAt: timestamp,
    }, { merge: true });

    departments.forEach((department, index) => {
      transaction.set(db.doc(`departments/${department.value}`), {
        ...department,
        sortOrder: index,
        createdAt: timestamp,
        updatedAt: timestamp,
      }, { merge: true });
    });

    transaction.set(adminRef, {
      name: adminName,
      role: "admin",
      department: "all",
      provider: "line",
      createdAt: timestamp,
      updatedAt: timestamp,
    }, { merge: true });
  });

  return readBootstrapStatus(admin, decodedUser.uid);
}

async function submitJoinRequest(admin, decodedUser, payload) {
  const status = await readBootstrapStatus(admin, decodedUser.uid);

  if (status.setupRequired) {
    const error = new Error("This deployment has not been initialized");
    error.statusCode = 409;
    throw error;
  }

  if (status.appUser) return status;

  const validDepartmentIds = new Set(status.departments.map((department) => department.value));
  const requestedDepartment = String(payload.department || "");
  const department = validDepartmentIds.has(requestedDepartment)
    ? requestedDepartment
    : status.departments[0]?.value || "";
  const name = String(payload.name || decodedUser.lineDisplayName || "未命名員工").trim().slice(0, 80) || "未命名員工";
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  await admin.firestore().doc(`joinRequests/${decodedUser.uid}`).set({
    lineUserId: decodedUser.uid,
    name,
    department,
    role: "staff",
    status: "pending",
    source: "line_id_token",
    createdAt: timestamp,
    updatedAt: timestamp,
  }, { merge: true });

  return {
    ...status,
    joinRequestSubmitted: true,
  };
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "bootstrap api is alive",
      hasServiceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const admin = getAdmin();
    const decodedUser = await requireFirebaseUser(req, admin);
    const { action = "status", ...payload } = req.body || {};

    let result;
    if (action === "status") result = await readBootstrapStatus(admin, decodedUser.uid);
    else if (action === "initialize") result = await initializeDeployment(admin, decodedUser, payload);
    else if (action === "join") result = await submitJoinRequest(admin, decodedUser, payload);
    else return res.status(400).json({ error: "Unsupported bootstrap action" });

    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("api/bootstrap error:", error);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Internal server error",
    });
  }
}
