const REQUIRED_PUBLIC_ENV_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_LINE_LIFF_ID",
];

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const present = Object.fromEntries(
    REQUIRED_PUBLIC_ENV_KEYS.map((key) => [key, Boolean(process.env[key])]),
  );

  const missing = REQUIRED_PUBLIC_ENV_KEYS.filter((key) => !process.env[key]);

  return res.status(200).json({
    ok: missing.length === 0,
    present,
    hasFirebaseServiceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
    missing,
  });
}
