import { execute, queryOne } from "@/lib/db";
import { badRequest, handle, notFound, requireAdmin } from "@/lib/auth-guard";
import { normalizeLocation, validateLocation } from "@/lib/validation";
import { WorkLocationRow } from "@/lib/types";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const location = normalizeLocation(body);
    const validationError = validateLocation(location);
    if (validationError) badRequest(validationError);

    const updated = await queryOne<WorkLocationRow>(
      `UPDATE "WorkLocation" SET
         "name" = $2, "latitude" = $3, "longitude" = $4, "radius" = $5,
         "isActive" = $6, "updatedAt" = now()
       WHERE "id" = $1 RETURNING *`,
      [
        id,
        location.name,
        location.latitude,
        location.longitude,
        location.radius,
        location.isActive,
      ]
    );
    if (!updated) notFound("Không tìm thấy vị trí");

    return { location: updated };
  }, "Location update error");
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;

    // Punch cũ trỏ tới vị trí này sẽ được set null nhờ ON DELETE SET NULL,
    // khoảng cách đã ghi vẫn giữ nguyên nên lịch sử không bị sai lệch.
    const removed = await execute(`DELETE FROM "WorkLocation" WHERE "id" = $1`, [id]);
    if (removed === 0) notFound("Không tìm thấy vị trí");

    return { success: true };
  }, "Location delete error");
}
