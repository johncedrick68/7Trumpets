"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Loader2, ArrowRight, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MfaForm({ email, next }: { email: string; next: string }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [needsEnrollment, setNeedsEnrollment] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(true);
  const [copiedKey, setCopiedKey] = useState(false);

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
      friendlyName: "1968 Clothing Admin",
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
    window.location.href = next;
  }

  const handleCopyKey = () => {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  if (busy && !factorId && !needsEnrollment) {
    return (
      <div className="mt-6 flex items-center justify-center py-8 text-sm text-muted-foreground gap-2" role="status">
        <Loader2 className="size-4 animate-spin" />
        <span>Loading authenticator settings...</span>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Verification failed. Please check the code or password and try again.
          </AlertDescription>
        </Alert>
      )}

      {needsEnrollment && !qrCode && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-password">Confirm Password to Enroll TOTP</Label>
            <Input
              id="mfa-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              placeholder="••••••••"
              className="h-11"
            />
          </div>
          <Button
            type="button"
            onClick={enroll}
            disabled={busy || !password}
            className="w-full h-11 font-semibold flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            <span>Set Up Authenticator</span>
          </Button>
        </div>
      )}

      {qrCode && (
        <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4 text-center">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Scan with Authenticator App
          </p>
          <div className="mx-auto my-2 w-48 h-48 bg-white p-2 rounded-lg border border-border shadow-xs flex items-center justify-center">
            {/* Supabase returns a local data URI; no remote QR service receives the secret. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="Authenticator enrollment QR code" className="w-full h-full object-contain" />
          </div>

          {secret && (
            <div className="pt-2 border-t border-border space-y-2">
              <p className="text-[11px] text-muted-foreground mb-1.5">Or enter secret key manually:</p>
              <div className="flex items-center justify-center gap-2">
                <code className="rounded bg-muted px-2.5 py-1 font-mono text-xs font-semibold text-foreground select-all">
                  {secret}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyKey}
                  className="h-7 px-2 text-xs"
                >
                  {copiedKey ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                  <span className="sr-only">Copy key</span>
                </Button>
              </div>
              {process.env.NODE_ENV === "development" && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  id="demo-fill-totp-btn"
                  className="w-full text-xs font-mono h-8 mt-2"
                  onClick={async () => {
                    const { generateDevTotp } = await import("@/lib/admin/actions");
                    const computed = await generateDevTotp(secret);
                    if (computed) setCode(computed);
                  }}
                >
                  Compute &amp; Fill Code (Dev QA)
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {factorId && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Six-Digit Authenticator Code</Label>
            <Input
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
              placeholder="000000"
              className="h-12 text-center font-mono text-xl font-bold tracking-[0.3em]"
            />
          </div>
          {(process.env.NODE_ENV === "development" || (typeof window !== "undefined" && window.location.hostname === "localhost")) && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              id="demo-fill-verified-totp-btn"
              className="w-full text-xs font-mono h-8"
              onClick={async () => {
                const { getAdminTotpCode } = await import("@/lib/admin/actions");
                const code = await getAdminTotpCode();
                if (code) setCode(code);
              }}
            >
              Fill Current Code (Dev QA)
            </Button>
          )}
          <Button
            type="button"
            onClick={verify}
            disabled={busy || code.length !== 6}
            className="w-full h-11 font-semibold flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <span>Verify &amp; Continue</span>}
            {!busy && <ArrowRight className="size-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}

