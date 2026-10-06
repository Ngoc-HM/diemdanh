import { query, queryOne } from "@/lib/db";
import { badRequest, conflict, handle, requireAdmin } from "@/lib/auth-guard";
import { hashPassword, isValidEmail } from "@/lib/utils";
import { EMPLOYMENT_TYPES, isEmploymentType } from "@/lib/schedule";
import { EMPLOYEE_COLUMNS, EmployeeRow } from "@/lib/types";
import { assertEmailNotAdmin } from "@/lib/auth-login";

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const users = await query<EmployeeRow>(
      `SELECT ${EMPLOYEE_COLUMNS} FROM "User"
        WHERE "role" = 'employee' ${includeInactive ? "" : `AND "isActive" = true`}
        ORDER BY "isActive" DESC, "name" ASC`
    );

    return { users, employmentTypes: EMPLOYMENT_TYPES };
  }, "User list error");
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));

    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const employmentType = String(body?.employmentType || "full_time");
    const employeeCode = String(body?.employeeCode || "").trim() || null;
    const startDate = body?.startDate ? new Date(String(body.startDate)) : null;

    if (!name) badRequest("Vui lòng nhập họ tên");
    if (!isValidEmail(email)) badRequest("Email không hợp lệ");
    if (password.length < 6) badRequest("Mật khẩu phải có ít nhất 6 ký tự");
    if (!isEmploymentType(employmentType)) badRequest("Loại hợp đồng không hợp lệ");
    if (startDate && Number.isNaN(startDate.getTime())) {
      badRequest("Ngày vào làm không hợp lệ");
    }

    const existingEmail = await queryOne(
      `SELECT 1 FROM "User" WHERE "email" = $1`,
      [email]
    );
    if (existingEmail) conflict("Email đã được dùng");
    await assertEmailNotAdmin(email);

    if (employeeCode) {
      const existingCode = await queryOne(
        `SELECT 1 FROM "User" WHERE "employeeCode" = $1`,
        [employeeCode]
      );
      if (existingCode) conflict("Mã nhân viên đã tồn tại");
    }

    const user = await queryOne<EmployeeRow>(
      `INSERT INTO "User"
         ("name", "email", "password", "role", "employeeCode", "employmentType",
          "phone", "department", "position", "startDate")
       VALUES ($1, $2, $3, 'employee', $4, $5, $6, $7, $8, $9)
       RETURNING ${EMPLOYEE_COLUMNS}`,
      [
        name,
        email,
        await hashPassword(password),
        employeeCode,
        employmentType,
        String(body?.phone || "").trim() || null,
        String(body?.department || "").trim() || null,
        String(body?.position || "").trim() || null,
        startDate,
      ]
    );

    return { user };
  }, "User create error");
}
