import { query, queryOne } from "@/lib/db";
import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import { normalizeLocation, validateLocation } from "@/lib/validation";
import { WorkLocationRow } from "@/lib/types";

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const locations = await query<WorkLocationRow>(
      `SELECT * FROM "WorkLocation" ORDER BY "createdAt" DESC`
    );
    return { locations };
  }, "Location list error");
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const location = normalizeLocation(body);
    const validationError = validateLocation(location);
    if (validationError) badRequest(validationError);

    const created = await queryOne<WorkLocationRow>(
      `INSERT INTO "WorkLocation" ("name", "latitude", "longitude", "radius", "isActive")
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        location.name,
        location.latitude,
        location.longitude,
        location.radius,
        location.isActive,
      ]
    );
    return { location: created };
  }, "Location create error");
}
