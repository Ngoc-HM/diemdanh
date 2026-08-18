import { queryOne } from "@/lib/db";
import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";

const DEFAULT_COMPANY_NAME = "Công ty của bạn";

/// Công khai: trang đăng nhập nhân viên cần tên công ty trước khi có phiên.
export async function GET() {
  return handle(async () => {
    const setting = await queryOne<{ value: string }>(
      `SELECT "value" FROM "Settings" WHERE "key" = 'company_name'`
    );
    return { value: setting?.value ?? DEFAULT_COMPANY_NAME };
  }, "Company settings read error");
}

export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const value = String(body?.value || "").trim();

    if (!value) badRequest("Tên công ty không được để trống");
    if (value.length > 120) badRequest("Tên công ty tối đa 120 ký tự");

    const setting = await queryOne<{ value: string }>(
      `INSERT INTO "Settings" ("key", "value") VALUES ('company_name', $1)
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"
       RETURNING "value"`,
      [value]
    );

    return { value: setting!.value };
  }, "Company settings write error");
}
