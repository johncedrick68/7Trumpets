"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function MfaForm({ email, next }: { email: string; next: string }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [needsEnrollment, setNeedsEnrollment] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error: listError } = await createClient().auth.mfa.listFactors();
      if (!active) return;
      if (listError) setError(true);
      const verified = data?.totp.find((factor) => factor.status === "verified");
      setFactorId(verified?.id ?? null);
      setNeedsEnrollment(!verified);
      setBusy(false);
    })();
    return () => { active = false; };
  }, []);

  async function enroll() {
    setBusy(true);
    setError(false);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(true);
      setBusy(false);
      return;
    }

    const { data: factors } = await supabase.auth.mfa.listFactors();
    await Promise.all(
      (factors?.all ?? [])
        .filter((factor) => factor.factor_type === "totp" && factor.status === "unverified")
        .map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id })),
    );
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "7Trumpets Admin",
    });
    if (enrollError) {
      setError(true);
    } else {
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setPassword("");
    }
    setBusy(false);
  }

  async function verify() {
    if (!factorId || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    setError(false);
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (verifyError) {
      setError(true);
      setBusy(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  if (busy && !factorId) return <p role="status">Loading authenticator settings...</p>;

  return (
    <div style={{ marginTop: "1rem" }}>
      {error && <p className="error" role="alert">Authenticator verification failed. Please try again.</p>}
      {needsEnrollment && !qrCode && (
        <div>
          <div className="form-group">
            <label htmlFor="mfa-password">Confirm your password to enroll TOTP</label>
            <input
              id="mfa-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <button type="button" onClick={enroll} disabled={busy || !password} className="btn btn-primary btn-full" style={{ justifyContent: "center" }}>
            Set up authenticator &rarr;
          </button>
        </div>
      )}
      {qrCode && (
        <div className="mfa-enrollment">
          {/* Supabase returns a local data URI; no remote QR service receives the secret. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCode} alt="Authenticator enrollment QR code" className="mfa-qr" />
          <p style={{ fontSize: "12px", fontFamily: "var(--font-mono)", wordBreak: "break-all", textAlign: "center" }}>
            Manual setup key: <code>{secret}</code>
          </p>
        </div>
      )}
      {factorId && (
        <div>
          <div className="form-group">
            <label htmlFor="mfa-code">Six-digit authenticator code</label>
            <input
              id="mfa-code"
              name="mfa_code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              required
              placeholder="123456"
              style={{ textAlign: "center", letterSpacing: "0.25em", fontSize: "1.25rem", fontWeight: 700 }}
            />
          </div>
          <button type="button" onClick={verify} disabled={busy || code.length !== 6} className="btn btn-primary btn-full" style={{ justifyContent: "center" }}>
            Verify and continue &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
