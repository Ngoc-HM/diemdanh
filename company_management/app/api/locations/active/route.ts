import { query } from "@/lib/db";
import { handle, requireUser } from "@/lib/auth-guard";
import { WorkLocationRow } from "@/lib/types";

/// Toạ độ văn phòng là thông tin nội bộ — chỉ trả cho người đã đăng nhập.
export async function GET() {
  return handle(async () => {
    await requireUser();
    const locations = await query<WorkLocationRow>(
      `SELECT "id", "name", "latitude", "longitude", "radius"
         FROM "WorkLocation" WHERE "isActive" = true ORDER BY "createdAt" ASC`
    );
    return { locations };
  }, "Active location list error");
}
