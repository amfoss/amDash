import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_BASE = "https://api.anthropic.com";
const API_KEY = process.env.ANTHROPIC_API_KEY;
const PROXY_SECRET = process.env.PROXY_SECRET;

function err(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

async function handler(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  if (!API_KEY) return err("ANTHROPIC_API_KEY not configured", 500);

  if (PROXY_SECRET && req.headers.get("x-proxy-secret") !== PROXY_SECRET) {
    return err("Forbidden", 403);
  }

  const { path } = await params;
  const tail = path ? path.join("/") : "";
  const search = req.nextUrl.search;
  const url = `${ANTHROPIC_BASE}/${tail}${search}`;

  const headers = new Headers();
  for (const [k, v] of req.headers.entries()) {
    if (["host", "x-proxy-secret"].includes(k.toLowerCase())) continue;
    headers.set(k, v);
  }
  headers.set("x-api-key", API_KEY);

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : req.body;

  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body,
    // @ts-expect-error — Node fetch needs this for streaming request bodies
    duplex: "half",
  });

  const responseHeaders = new Headers();
  for (const [k, v] of upstream.headers.entries()) {
    responseHeaders.set(k, v);
  }
  // Remove encoding headers so Next.js doesn't double-encode
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("transfer-encoding");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
