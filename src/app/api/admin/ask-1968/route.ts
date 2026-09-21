import { NextRequest, NextResponse } from "next/server";
import { answerAdminInquiry } from "@/lib/ai/admin-ask";
import { requireAdminAal2 } from "@/lib/admin/auth";

export async function POST(req: NextRequest) {
  try {
    await requireAdminAal2("/admin");

    const body = await req.json();
    const question = String(body.question || "").trim();

    if (!question) {
      return NextResponse.json({ error: "Question cannot be empty" }, { status: 400 });
    }

    const answer = await answerAdminInquiry(question);
    return NextResponse.json({ answer });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate briefing";
    if (message === "GEMINI_NOT_CONFIGURED") {
      return NextResponse.json({
        error: "Gemini API key is not configured. Please set GEMINI_API_KEY in your server environment.",
      }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
