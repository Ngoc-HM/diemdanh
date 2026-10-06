import { queryOne } from "@/lib/db";
import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import { getOvertimeConfig } from "@/lib/overtime-service";
import { OvertimeConfig, validateOvertimeConfig } from "@/lib/overtime";

/// Hệ số OT (%) theo loại ngày và số giờ chuẩn một ngày (để quy ra lương giờ).
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return { config: await getOvertimeConfig() };
  }, "Overtime config read error");
}

export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const config: OvertimeConfig = {
      weekdayRate: Number(body?.weekdayRate),
      weeklyOffRate: Number(body?.weeklyOffRate),
      holidayRate: Number(body?.holidayRate),
      hoursPerDay: Number(body?.hoursPerDay),
    };
    const error = validateOvertimeConfig(config);
    if (error) badRequest(error);

    await queryOne(
      `INSERT INTO "Settings" ("id", "key", "value")
       VALUES ('cfg_overtime', 'overtime_config', $1)
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"
       RETURNING "key"`,
      [JSON.stringify(config)]
    );
    return { config };
  }, "Overtime config write error");
}
