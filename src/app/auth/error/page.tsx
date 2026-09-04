import Link from "next/link";
import { CircleAlert } from "lucide-react";

import { AuthFrame } from "@/components/auth-frame";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function AuthErrorPage() {
  return <AuthFrame><div className="w-full max-w-md"><p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Account link</p><h1 className="mt-3 text-4xl font-extrabold tracking-tight text-balance">This link can’t be used</h1><p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Confirmation and password-reset links expire to keep your account protected.</p><Alert variant="destructive" className="mt-8"><CircleAlert aria-hidden="true" /><AlertTitle>Expired or invalid link</AlertTitle><AlertDescription>Request a new link, then open the newest email from 1968 Clothing.</AlertDescription></Alert><div className="mt-6 grid gap-3 sm:grid-cols-2"><Button asChild className="h-12"><Link href="/login">Return to sign in</Link></Button><Button asChild variant="outline" className="h-12"><Link href="/signup">Create account</Link></Button></div></div></AuthFrame>;
}
