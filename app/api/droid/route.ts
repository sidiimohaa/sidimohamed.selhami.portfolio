import { NextResponse } from "next/server";
import { askModel, createRateLimiter, LIMITS, parseChatRequest } from "../../../components/droid/serverPolicy";

// R-X7's link to the language model. The key lives here, on the server, and never reaches the page.
// Every refusal is a plain status: the chat then answers from its local archives and says so.
// Messages are not logged, and are not stored by the provider (store: false).

export const dynamic = "force-dynamic";

const allowed = createRateLimiter();
const refuse = (status: number) => NextResponse.json({ error: status === 429 ? "busy" : status === 400 ? "invalid" : "unavailable" }, { status });

export async function POST(request: Request) {
  // Only this site's own pages may use the endpoint.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return refuse(403);
  if (Number(request.headers.get("content-length") ?? 0) > LIMITS.bodyBytes) return refuse(400);

  const key = process.env.OPENAI_API_KEY;
  if (!key) return refuse(503);

  const visitor = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (!allowed(visitor)) return refuse(429);

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > LIMITS.bodyBytes) return refuse(400);
    body = JSON.parse(text);
  } catch {
    return refuse(400);
  }
  const chat = parseChatRequest(body);
  if (!chat) return refuse(400);

  try {
    const result = await askModel(chat, { key, model: process.env.OPENAI_MODEL || "gpt-5.4-mini", call: fetch });
    if (!result.reply) {
      console.error(`Droid: the model service answered ${result.failed}`);
      return refuse(503);
    }
    return NextResponse.json({ ...result.reply, source: "ai" });
  } catch (error) {
    console.error(`Droid: the model service failed (${error instanceof Error ? error.name : "unknown"})`);
    return refuse(503);
  }
}
