import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/youtube-auth";

export async function GET(req: NextRequest) {
  const persona = req.nextUrl.searchParams.get("persona") ?? undefined;
  const url = getAuthUrl(persona);
  return NextResponse.redirect(url);
}
