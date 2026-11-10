import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function GET() {
  const sql = await readFile(join(process.cwd(), "supabase/schema.sql"), "utf8");
  return new Response(sql, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
