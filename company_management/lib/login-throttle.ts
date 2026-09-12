/// Chặn dò mật khẩu ở hai trang đăng nhập. Đếm theo tài khoản (không theo IP:
/// hệ thống chạy sau reverse proxy nên IP nhìn thấy thường là của proxy).
import { queryOne } from "@/lib/db";
import { HttpError } from "@/lib/auth-guard";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
/// Sai rải rác cả ngày thì không tính dồn: quá khoảng này là đếm lại từ đầu.
export const FAILURE_WINDOW_MINUTES = 15;

/// Khoá đếm cho một lần đăng nhập. Email chuẩn hoá sẵn để "A@B.C" và "a@b.c"
/// không thành hai dòng khác nhau.
export function employeeKey(email: string): string {
  return email.trim().toLowerCase();
}

export function adminKey(username: string): string {
  return `admin:${username.trim().toLowerCase()}`;
}

/// Gợi ý cách tự mở khoá, tuỳ nơi gọi: nhân viên thì đổi mật khẩu là mở được,
/// admin không có luồng quên mật khẩu nên chỉ còn cách chờ.
export const EMPLOYEE_UNLOCK_HINT =
  'Đổi mật khẩu ở "Quên mật khẩu?" để mở khoá ngay.';

/// Ném HttpError 429 nếu tài khoản đang bị khoá tạm.
export async function assertLoginAllowed(
  identifier: string,
  unlockHint?: string
): Promise<void> {
  const row = await queryOne<{ minutesLeft: number }>(
    `SELECT ceil(extract(epoch FROM ("lockedUntil" - now())) / 60)::int AS "minutesLeft"
       FROM "LoginAttempt"
      WHERE "identifier" = $1 AND "lockedUntil" > now()`,
    [identifier]
  );
  if (row) {
    const minutes = Math.max(1, row.minutesLeft);
    throw new HttpError(
      429,
      `Tài khoản của bạn đã bị khoá trong ${minutes} phút do đăng nhập sai quá nhiều lần.` +
        (unlockHint ? ` ${unlockHint}` : "")
    );
  }
}

/// Ghi nhận một lần đăng nhập sai; đủ ngưỡng thì khoá tạm.
export async function recordLoginFailure(identifier: string): Promise<void> {
  const row = await queryOne<{ failedCount: number }>(
    `INSERT INTO "LoginAttempt" ("identifier", "failedCount")
     VALUES ($1, 1)
     ON CONFLICT ("identifier") DO UPDATE SET
       "failedCount" = CASE
         WHEN "LoginAttempt"."firstFailedAt" < now() - ($2 || ' minutes')::interval
           THEN 1
         ELSE "LoginAttempt"."failedCount" + 1
       END,
       "firstFailedAt" = CASE
         WHEN "LoginAttempt"."firstFailedAt" < now() - ($2 || ' minutes')::interval
           THEN now()
         ELSE "LoginAttempt"."firstFailedAt"
       END,
       "updatedAt" = now()
     RETURNING "failedCount"`,
    [identifier, String(FAILURE_WINDOW_MINUTES)]
  );

  if ((row?.failedCount ?? 0) >= MAX_FAILED_LOGINS) {
    await queryOne(
      `UPDATE "LoginAttempt"
          SET "lockedUntil" = now() + ($2 || ' minutes')::interval, "updatedAt" = now()
        WHERE "identifier" = $1
        RETURNING "identifier"`,
      [identifier, String(LOCK_MINUTES)]
    );
  }
}

/// Đăng nhập được thì xoá sạch bộ đếm.
export async function clearLoginFailures(identifier: string): Promise<void> {
  await queryOne(
    `DELETE FROM "LoginAttempt" WHERE "identifier" = $1 RETURNING "identifier"`,
    [identifier]
  );
}
