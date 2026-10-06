import { execute, queryOne } from "@/lib/db";
import { badRequest, conflict, handle, notFound, requireAdmin } from "@/lib/auth-guard";
import { isValidEmail } from "@/lib/utils";
import { isEmploymentType } from "@/lib/schedule";
import { EMPLOYEE_COLUMNS, EmployeeRow, UserRow } from "@/lib/types";
import { assertEmailNotAdmin } from "@/lib/auth-login";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const existing = await queryOne<UserRow>(
      `SELECT "id", "employmentType", "isActive" FROM "User" WHERE "id" = $1`,
      [id]
    );
    if (!existing) notFound("Không tìm thấy nhân viên");

    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const employmentType = String(body?.employmentType || existing!.employmentType);
    const employeeCode = String(body?.employeeCode || "").trim() || null;
    const startDate = body?.startDate ? new Date(String(body.startDate)) : null;

    if (!name) badRequest("Vui lòng nhập họ tên");
    if (!isValidEmail(email)) badRequest("Email không hợp lệ");
    if (!isEmploymentType(employmentType)) badRequest("Loại hợp đồng không hợp lệ");
    if (startDate && Number.isNaN(startDate.getTime())) {
      badRequest("Ngày vào làm không hợp lệ");
    }

    const duplicateEmail = await queryOne<{ id: string }>(
      `SELECT "id" FROM "User" WHERE "email" = $1`,
      [email]
    );
    if (duplicateEmail && duplicateEmail.id !== id) conflict("Email đã được dùng");
    await assertEmailNotAdmin(email);

    if (employeeCode) {
      const duplicateCode = await queryOne<{ id: string }>(
        `SELECT "id" FROM "User" WHERE "employeeCode" = $1`,
        [employeeCode]
      );
      if (duplicateCode && duplicateCode.id !== id) {
        conflict("Mã nhân viên đã tồn tại");
      }
    }

    const user = await queryOne<EmployeeRow>(
      `UPDATE "User" SET
         "name" = $2, "email" = $3, "employeeCode" = $4, "employmentType" = $5,
         "phone" = $6, "department" = $7, "position" = $8, "startDate" = $9,
         "isActive" = $10, "updatedAt" = now()
       WHERE "id" = $1
       RETURNING ${EMPLOYEE_COLUMNS}`,
      [
        id,
        name,
        email,
        employeeCode,
        employmentType,
        String(body?.phone || "").trim() || null,
        String(body?.department || "").trim() || null,
        String(body?.position || "").trim() || null,
        startDate,
        body?.isActive === undefined ? existing!.isActive : Boolean(body.isActive),
      ]
    );

    return { user };
  }, "User update error");
}

/// Ngừng hoạt động thay vì xoá cứng: xoá nhân viên sẽ cascade mất toàn bộ
/// lịch sử chấm công của họ. Muốn xoá hẳn thì dùng `?hard=true` và chỉ được
/// phép khi nhân viên chưa có ngày công nào.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const hard = searchParams.get("hard") === "true";

    const existing = await queryOne<{ id: string }>(
      `SELECT "id" FROM "User" WHERE "id" = $1`,
      [id]
    );
    if (!existing) notFound("Không tìm thấy nhân viên");

    if (hard) {
      const counted = await queryOne<{ n: number }>(
        `SELECT count(*)::int AS n FROM "Attendance" WHERE "userId" = $1`,
        [id]
      );
      if ((counted?.n ?? 0) > 0) {
        conflict(
          `Nhân viên đã có ${counted!.n} ngày công. Chỉ có thể ngừng hoạt động, không xoá được.`
        );
      }
      await execute(`DELETE FROM "User" WHERE "id" = $1`, [id]);
      return { success: true, deleted: true };
    }

    await execute(
      `UPDATE "User" SET "isActive" = false, "updatedAt" = now() WHERE "id" = $1`,
      [id]
    );
    return { success: true, deleted: false };
  }, "User delete error");
}
