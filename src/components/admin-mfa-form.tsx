"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy, KeyRound, Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function AdminMfaForm({
  mode,
  next,
  verifiedFactorId = null,
}: {
  mode: "enroll" | "verify";
  next: string;
  verifiedFactorId?: string | null;
}) {
  const [factorId, setFactorId] = useState(verifiedFactorId);
  const [code, setCode] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function enroll() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError || factors?.totp.some((factor) => factor.status === "verified")) {
      setError(listError ? "Authenticator settings could not be loaded." : "An authenticator is already enrolled. Sign in with its current code.");
      setBusy(false);
      return;
    }

    for (const factor of factors?.all ?? []) {
      if (factor.factor_type === "totp" && factor.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "1968 Clothing Admin",
    });
    if (enrollError) {
      setError("Authenticator enrollment could not be started. Please try again.");
    } else {
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    }
    setBusy(false);
  }

  async function verify() {
    if (!factorId || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (verifyError) {
      setError("That code could not be verified. Check your authenticator and try again.");
      setBusy(false);
      return;
    }

    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance?.currentLevel !== "aal2") {
      setError("Verification completed, but the secure Admin session was not established. Please try again.");
      setBusy(false);
      return;
    }
    window.location.replace(next);
  }

  function copySecret() {
    if (!secret) return;
    void navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mt-6 space-y-5">
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {mode === "enroll" && !factorId && (
        <Button type="button" onClick={enroll} disabled={busy} className="h-11 w-full gap-2 font-semibold">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Set Up Authenticator
        </Button>
      )}

      {mode === "enroll" && qrCode && (
        <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Scan with your authenticator app
          </p>
          <div className="mx-auto flex size-48 items-center justify-center rounded-lg border border-border bg-white p-2 shadow-xs">
            {/* Supabase returns a local data URI; no third-party QR service receives the secret. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="Authenticator enrollment QR code" className="size-full object-contain" />
          </div>
          {secret && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">Can’t scan? Enter this one-time setup key manually.</p>
              <div className="flex items-center justify-center gap-2">
                <code className="break-all rounded bg-muted px-2.5 py-1 font-mono text-xs font-semibold">{secret}</code>
                <Button type="button" variant="outline" size="sm" onClick={copySecret} className="h-8 shrink-0 px-2">
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  <span className="sr-only">Copy setup key</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {factorId && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Six-digit authenticator code</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="h-12 text-center font-mono text-xl font-bold tracking-[0.3em]"
            />
          </div>
          <Button type="button" onClick={verify} disabled={busy || code.length !== 6} className="h-11 w-full gap-2 font-semibold">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <>Verify &amp; Continue <ArrowRight className="size-4" /></>}
          </Button>
        </div>
      )}
    </div>
  );
}
