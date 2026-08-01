import { getAdmin } from "../lib/firebaseAdmin.js";

function getLineChannelId() {
  const explicitChannelId = String(process.env.LINE_CHANNEL_ID || "").trim();
  if (explicitChannelId) return explicitChannelId;

  const liffId = String(process.env.VITE_LINE_LIFF_ID || "").trim();
  return liffId.includes("-") ? liffId.split("-")[0] : "";
}

async function verifyLineIdToken(idToken) {
  const clientId = getLineChannelId();
  if (!clientId) {
    throw new Error("Missing LINE_CHANNEL_ID or VITE_LINE_LIFF_ID");
  }

  const body = new URLSearchParams({
    id_token: idToken,
    client_id: clientId,
  });

  const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.sub) {
    const message = payload.error_description || payload.error || "LINE ID token verification failed";
    const error = new Error(message);
    error.statusCode = 401;
    throw error;
  }

  if (String(payload.aud) !== clientId) {
    const error = new Error("LINE ID token audience mismatch");
    error.statusCode = 401;
    throw error;
  }

  return payload;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "auth api is alive",
      hasServiceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
      hasLineChannelId: Boolean(getLineChannelId()),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { idToken } = req.body || {};

    if (!idToken) {
      return res.status(400).json({ error: "Missing LINE ID token" });
    }

    const verified = await verifyLineIdToken(idToken);
    const admin = getAdmin();
    const displayName = String(verified.name || "").slice(0, 100);

    const token = await admin.auth().createCustomToken(verified.sub, {
      provider: "line",
      lineDisplayName: displayName,
    });

    return res.status(200).json({
      token,
      uid: verified.sub,
      profile: {
        displayName,
        pictureUrl: verified.picture || "",
      },
    });
  } catch (error) {
    console.error("api/auth error:", error);

    return res.status(error.statusCode || 500).json({
      error: error.message || "Internal server error",
    });
  }
}
