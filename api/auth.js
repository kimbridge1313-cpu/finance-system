import admin from "firebase-admin";

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT");
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
  }
}

function initAdmin() {
  if (admin.apps.length > 0) return admin.app();

  const serviceAccount = parseServiceAccount();

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default async function handler(req, res) {
  // 讓你可以直接用瀏覽器打開 /api/auth 檢查 API 狀態
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "auth api is alive",
      hasServiceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { lineUserId } = req.body || {};

    if (!lineUserId) {
      return res.status(400).json({
        error: "Missing lineUserId",
      });
    }

    initAdmin();

    const token = await admin.auth().createCustomToken(lineUserId, {
      provider: "line",
    });

    return res.status(200).json({
      token,
      uid: lineUserId,
    });
  } catch (error) {
    console.error("api/auth error:", error);

    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
}
