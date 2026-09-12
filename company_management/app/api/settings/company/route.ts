import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { queryOne } from "@/lib/db";
import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";

const DEFAULT_COMPANY_NAME = "Công ty của bạn";

/// Công khai: trang đăng nhập nhân viên cần tên công ty + logo trước khi có phiên.
export async function GET() {
  return handle(async () => {
    const rows = await queryOne<{ value: string }>(
      `SELECT "value" FROM "Settings" WHERE "key" = 'company_name'`
    );
    const logo = await queryOne<{ value: string }>(
      `SELECT "value" FROM "Settings" WHERE "key" = 'company_logo'`
    );
    return {
      value: rows?.value ?? DEFAULT_COMPANY_NAME,
      logo: logo?.value ?? null,
    };
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

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB
const LOGO_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

/// Upload logo công ty (multipart/form-data, field "file").
/// Lưu file vào public/uploads/logo.<ext> và ghi đường dẫn vào Settings.
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || !(file instanceof File)) badRequest("Vui lòng chọn file logo");

    const ext = LOGO_MIME[file.type];
    if (!ext) badRequest("Chỉ nhận file PNG, JPG, WebP hoặc SVG");
    if (file.size > MAX_LOGO_BYTES) badRequest("Logo tối đa 2MB");

    const buffer = Buffer.from(await file.arrayBuffer());
    const dir = join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const path = `/uploads/logo${ext}`;
    await writeFile(join(dir, `logo${ext}`), buffer);

    await queryOne(
      `INSERT INTO "Settings" ("id", "key", "value") VALUES ('cfg_company_logo', 'company_logo', $1)
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"
       RETURNING "value"`,
      [path]
    );

    return { logo: path };
  }, "Company logo upload error");
}

/// Gỡ logo, quay về icon mặc định.
export async function DELETE() {
  return handle(async () => {
    await requireAdmin();
    await queryOne(`DELETE FROM "Settings" WHERE "key" = 'company_logo' RETURNING "key"`);
    return { logo: null };
  }, "Company logo delete error");
}
