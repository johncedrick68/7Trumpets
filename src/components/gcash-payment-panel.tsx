"use client";

import * as React from "react";
import Image from "next/image";
import { Check, Clock, Copy, Download, FileCheck2, Image as ImageIcon, Loader2, Upload, X } from "lucide-react";
import { submitGcashProof } from "@/lib/payments/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SubmissionHistoryItem {
  id: string;
  claimed_amount_minor: number;
  reference_number: string | null;
  receipt_storage_path: string;
  created_at: string;
}

interface GcashPaymentPanelProps {
  orderId: string;
  orderNumber: string;
  amountMinor: number;
  formattedAmount: string;
  paymentStatus: string;
  reservationExpiresAt?: string | null;
  canSubmitProof: boolean;
  submissions: SubmissionHistoryItem[];
  latestSignedUrl?: string | null;
}

export function GcashPaymentPanel({
  orderId,
  orderNumber,
  formattedAmount,
  paymentStatus,
  reservationExpiresAt,
  canSubmitProof,
  submissions,
  latestSignedUrl,
}: GcashPaymentPanelProps) {
  const [copiedNumber, setCopiedNumber] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [referenceNumber, setReferenceNumber] = React.useState("");
  const [timeLeft, setTimeLeft] = React.useState<string | null>(null);
  const [isExpired, setIsExpired] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const GCASH_NUMBER = "0917 196 8000";
  const GCASH_ACCOUNT_NAME = "1968 CLOTHING PH";

  // Countdown timer
  React.useEffect(() => {
    if (!reservationExpiresAt || paymentStatus === "PAID") return;

    const calculateRemaining = () => {
      const now = Date.now();
      const target = new Date(reservationExpiresAt).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft("00:00");
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setTimeLeft(
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [reservationExpiresAt, paymentStatus]);

  // Handle file preview and validation
  const handleFileChange = (file: File | null) => {
    setFileError(null);
    if (!file) {
      setSelectedFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }

    const validMimes = ["image/jpeg", "image/png", "image/webp"];
    if (!validMimes.includes(file.type)) {
      setFileError("Invalid image type. Only JPG, PNG, and WebP are supported.");
      return;
    }

    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE) {
      setFileError("File size exceeds 2MB limit. Please compress the screenshot.");
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(GCASH_NUMBER.replace(/\s+/g, ""));
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2500);
  };

  const handleDownloadQr = () => {
    const link = document.createElement("a");
    link.href = "/images/gcash-merchant-qr.svg";
    link.download = `1968-Clothing-GCash-QR-${orderNumber}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="border-border shadow-sm overflow-hidden">
      {/* Header Banner */}
      <CardHeader className="bg-muted/40 border-b border-border py-4 px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] tracking-wider uppercase border-primary/30 text-primary">
              Manual GCash Transfer
            </Badge>
            {timeLeft && !isExpired && paymentStatus !== "PAID" && (
              <Badge variant="secondary" className="font-mono text-[10px] flex items-center gap-1.5">
                <Clock className="size-3 text-muted-foreground animate-pulse" />
                <span>Expires in {timeLeft}</span>
              </Badge>
            )}
            {isExpired && paymentStatus !== "PAID" && (
              <Badge variant="destructive" className="font-mono text-[10px]">
                Window Expired
              </Badge>
            )}
          </div>
          <CardTitle className="text-xl font-bold mt-1">Payment for Order #{orderNumber}</CardTitle>
        </div>
        <div className="text-right sm:text-right">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Amount to Pay</p>
          <p className="text-2xl sm:text-3xl font-mono font-black text-foreground">{formattedAmount}</p>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-8">
        {/* Status Alert Banners */}
        {paymentStatus === "SUBMITTED" && (
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-300 flex items-start gap-3">
            <Clock className="size-5 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <div className="text-sm">
              <strong className="block font-bold mb-0.5">Payment Submitted for Verification</strong>
              <p className="leading-relaxed text-xs sm:text-sm text-blue-950/80 dark:text-blue-200/80">
                Your receipt has been received and is queued for staff verification. Your items remain reserved. Verification normally completes within 1–2 hours.
              </p>
            </div>
          </div>
        )}

        {paymentStatus === "PAID" && (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-300 flex items-start gap-3">
            <Check className="size-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <div className="text-sm">
              <strong className="block font-bold mb-0.5">Payment Verified & Confirmed</strong>
              <p className="leading-relaxed text-xs sm:text-sm text-emerald-950/80 dark:text-emerald-200/80">
                Your GCash payment has been verified by our operations team. Your order is now being prepared for fulfillment.
              </p>
            </div>
          </div>
        )}

        {paymentStatus === "REJECTED" && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-3">
            <X className="size-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong className="block font-bold mb-0.5">Receipt Requires Resubmission</strong>
              <p className="leading-relaxed text-xs sm:text-sm opacity-90">
                The previously submitted receipt could not be verified. Please review the rejection reason and upload a corrected GCash receipt screenshot below.
              </p>
            </div>
          </div>
        )}

        {/* Payment Details & QR Code Workspace */}
        {(paymentStatus === "UNPAID" || paymentStatus === "REJECTED") && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: QR Code & Mobile Fast-Actions (5 cols) */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="relative w-full max-w-[280px] sm:max-w-[320px] rounded-2xl border-2 border-border p-3 bg-white shadow-md transition-transform hover:scale-[1.01]">
                <Image
                  src="/images/gcash-merchant-qr.svg"
                  alt="1968 Clothing Official GCash QR Code"
                  width={320}
                  height={400}
                  priority
                  className="w-full h-auto rounded-xl object-contain"
                />
              </div>

              {/* Mobile / Quick Action Buttons */}
              <div className="mt-4 w-full max-w-[320px] flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadQr}
                  className="flex-1 h-11 text-xs gap-2"
                >
                  <Download className="size-4" />
                  <span>Save QR</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyNumber}
                  className="flex-1 h-11 text-xs gap-2"
                >
                  {copiedNumber ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                  <span>{copiedNumber ? "Copied!" : "Copy No."}</span>
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground text-center mt-3 max-w-[300px]">
                Viewing on mobile? Save the QR to your photos, open GCash, tap <strong>QR</strong> → <strong>Upload from Gallery</strong>.
              </p>
            </div>

            {/* Right Column: Step-by-Step Instructions & Upload Form (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-3">
                <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-bold">
                  How to Pay via GCash
                </h3>
                <div className="grid gap-3 text-sm">
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-xs font-bold">1</span>
                    <div>
                      <p className="font-semibold text-foreground">Open your GCash app</p>
                      <p className="text-xs text-muted-foreground">Ensure you have sufficient balance for the exact amount.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-xs font-bold">2</span>
                    <div>
                      <p className="font-semibold text-foreground">Scan QR or Send Money</p>
                      <p className="text-xs text-muted-foreground">
                        Scan the merchant QR code, or send to <strong className="font-mono text-foreground">{GCASH_NUMBER}</strong> ({GCASH_ACCOUNT_NAME}).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-xs font-bold">3</span>
                    <div>
                      <p className="font-semibold text-foreground">Pay exactly {formattedAmount}</p>
                      <p className="text-xs text-muted-foreground">
                        Include <strong className="font-mono text-foreground">#{orderNumber}</strong> in the GCash message/note field.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-xs font-bold">4</span>
                    <div>
                      <p className="font-semibold text-foreground">Save the confirmation screenshot</p>
                      <p className="text-xs text-muted-foreground">Capture the GCash transaction receipt showing Ref No. and amount.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Proof Form */}
              {canSubmitProof && !isExpired && (
                <form
                  action={async (formData: FormData) => {
                    setIsSubmitting(true);
                    try {
                      await submitGcashProof(formData);
                    } catch {
                      setIsSubmitting(false);
                    }
                  }}
                  className="space-y-4 pt-4 border-t border-border"
                >
                  <input type="hidden" name="order_id" value={orderId} />

                  <div className="space-y-2">
                    <Label htmlFor="reference_number" className="font-semibold text-sm">
                      GCash Reference No. <span className="font-normal text-muted-foreground">(optional but recommended)</span>
                    </Label>
                    <Input
                      id="reference_number"
                      name="reference_number"
                      type="text"
                      placeholder="e.g. 1002 9382 1928"
                      maxLength={100}
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      className="h-11 font-mono text-sm"
                    />
                  </div>

                  {/* File Upload Zone */}
                  <div className="space-y-2">
                    <Label htmlFor="receipt_file" className="font-semibold text-sm">
                      Payment Screenshot / Receipt *
                    </Label>
                    <input
                      ref={fileInputRef}
                      id="receipt_file"
                      name="receipt_file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      required
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        handleFileChange(file);
                      }}
                    />

                    {!previewUrl ? (
                      <div className="space-y-2">
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files?.[0] || null;
                            if (file) {
                              handleFileChange(file);
                              if (fileInputRef.current) {
                                const dt = new DataTransfer();
                                dt.items.add(file);
                                fileInputRef.current.files = dt.files;
                              }
                            }
                          }}
                          className="border-2 border-dashed border-border hover:border-foreground/40 rounded-xl p-6 text-center cursor-pointer transition-colors bg-muted/20 hover:bg-muted/30 flex flex-col items-center justify-center gap-2"
                        >
                          <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                            <Upload className="size-6" />
                          </div>
                          <p className="text-sm font-semibold text-foreground">Click to upload or drag receipt screenshot</p>
                          <p className="text-xs text-muted-foreground">JPG, PNG, or WebP · Up to 2MB</p>
                        </div>
                        {process.env.NODE_ENV === "development" && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            id="demo-attach-receipt-btn"
                            className="w-full text-xs font-mono h-9"
                            onClick={async () => {
                              try {
                                const res = await fetch("/images/size-chart-1968-clothing.png");
                                const blob = await res.blob();
                                const file = new File([blob], "gcash-receipt-demo.png", { type: "image/png" });
                                handleFileChange(file);
                                if (fileInputRef.current) {
                                  const dt = new DataTransfer();
                                  dt.items.add(file);
                                  fileInputRef.current.files = dt.files;
                                }
                              } catch (err) {
                                console.error("Failed to load demo receipt", err);
                              }
                            }}
                          >
                            Attach Sample GCash Receipt (Dev QA)
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="relative rounded-xl border border-border p-3 bg-muted/30 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative size-16 shrink-0 rounded-lg overflow-hidden border border-border bg-black/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={previewUrl}
                              alt="Receipt Preview"
                              className="size-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate text-foreground">{selectedFile?.name}</p>
                            <p className="text-xs font-mono text-muted-foreground">
                              {selectedFile ? (selectedFile.size / 1024).toFixed(0) : 0} KB
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-9 text-xs"
                          >
                            Change
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFileChange(null)}
                            className="h-9 text-xs text-destructive hover:text-destructive"
                            aria-label="Remove uploaded receipt"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {fileError && (
                      <p className="text-xs text-destructive font-medium mt-1">{fileError}</p>
                    )}
                  </div>

                  {/* Primary CTA */}
                  <Button
                    type="submit"
                    size="lg"
                    disabled={!selectedFile || isSubmitting || !!fileError}
                    className="w-full h-12 text-sm font-bold tracking-wide uppercase gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Submitting Verification...</span>
                      </>
                    ) : (
                      <>
                        <FileCheck2 className="size-4" />
                        <span>Submit Payment Proof</span>
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Submission History Section */}
        {submissions.length > 0 && (
          <div className="pt-6 border-t border-border">
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Receipt History ({submissions.length})
            </h4>
            <div className="space-y-3">
              {submissions.map((sub, idx) => (
                <div
                  key={sub.id}
                  className="p-4 bg-muted/40 border border-border rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="font-semibold">Submission #{submissions.length - idx}</strong>
                      <span className="text-xs font-mono text-muted-foreground">
                        {new Date(sub.created_at).toLocaleString("en-PH", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {sub.reference_number && (
                      <p className="text-xs font-mono text-muted-foreground mt-1">
                        Ref: {sub.reference_number}
                      </p>
                    )}
                  </div>

                  {idx === 0 && latestSignedUrl && (
                    <Button variant="outline" size="sm" asChild className="h-9 text-xs">
                      <a href={latestSignedUrl} target="_blank" rel="noopener noreferrer">
                        <ImageIcon className="size-3.5 mr-1.5" />
                        View Uploaded Receipt ↗
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
