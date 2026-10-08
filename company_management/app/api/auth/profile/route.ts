import { unlink, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isUniqueViolation, queryOne } from "@/lib/db";
import {
  badRequest,
  conflict,
  handle,
  notFound,
  requireEmployee,
} from "@/lib/auth-guard";
import { setSessionCookie, signSession } from "@/lib/session";
import { isValidEmail } from "@/lib/utils";
import { assertEmailNotAdmin } from "@/lib/auth-login";
import {
  IMAGE_EXTENSIONS,
  IMAGE_MIME_TO_EXT,
  MAX_UPLOAD_BYTES,
  uploadDir,
} from "@/lib/uploads";

type Profile = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  employeeCode: string | null;
};

const PROFILE_COLUMNS = `"id", "name", "email", "avatarUrl", "employeeCode"`;

async function loadProfile(userId: string): Promise<Profile> {
  const profile = await queryOne<Profile>(
    `SELECT ${PROFILE_COLUMNS} FROM "User" WHERE "id" = $1`,
    [userId]
  );
  if (!profile) notFound("Không tìm thấy tài khoản");
  return profile!;
}

/// Phiên đăng nhập mang sẵn tên và email để header hiển thị, nên đổi hồ sơ thì
/// phải ký lại cookie, nếu không tên cũ còn nằm đó tới khi JWT hết hạn.
async function refreshSession(profile: Profile, sv: number | undefined) {
  await setSessionCookie(
    await signSession({
      userId: profile.id,
      role: "employee",
      name: profile.name,
      email: profile.email,
      sv,
    })
  );
}

export async function GET() {
  return handle(async () => {
    const session = await requireEmployee();
    return { profile: await loadProfile(session.userId) };
  }, "Profile read error");
}

/// Nhân viên tự đổi họ tên và email đăng nhập.
export async function PUT(req: Request) {
  return handle(async () => {
    const session = await requireEmployee();
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();

    if (!name) badRequest("Vui lòng nhập họ tên");
    if (name.length > 100) badRequest("Họ tên tối đa 100 ký tự");
    if (!isValidEmail(email)) badRequest("Email không hợp lệ");
    await assertEmailNotAdmin(email);

    let profile: Profile;
    try {
      profile = (await queryOne<Profile>(
        `UPDATE "User" SET "name" = $2, "email" = $3, "updatedAt" = now()
          WHERE "id" = $1 RETURNING ${PROFILE_COLUMNS}`,
        [session.userId, name, email]
      ))!;
    } catch (error) {
      // Email là tên đăng nhập nên phải là duy nhất trong toàn hệ thống.
      if (isUniqueViolation(error)) conflict("Email này đã có người dùng");
      throw error;
    }
    if (!profile) notFound("Không tìm thấy tài khoản");

    await refreshSession(profile, session.sv);
    return { profile };
  }, "Profile update error");
}

/// Upload ảnh đại diện. Ghi đè file cũ của chính nhân viên đó và gắn thêm dấu
/// thời gian vào đường dẫn để trình duyệt không dùng lại ảnh đã cache.
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireEmployee();
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || !(file instanceof File)) badRequest("Vui lòng chọn ảnh");

    const ext = IMAGE_MIME_TO_EXT[file.type];
    if (!ext) badRequest("Chỉ nhận ảnh PNG, JPG hoặc WebP");
    if (file.size > MAX_UPLOAD_BYTES) badRequest("Ảnh tối đa 2MB");

    const directory = uploadDir();
    await mkdir(directory, { recursive: true });
    const fileName = `avatar-${session.userId}${ext}`;
    await writeFile(
      join(directory, fileName),
      Buffer.from(await file.arrayBuffer())
    );

    // Đổi từ .png sang .jpg thì file cũ không còn ai trỏ tới, dọn luôn.
    for (const other of IMAGE_EXTENSIONS.filter((item) => item !== ext)) {
      await unlink(join(directory, `avatar-${session.userId}${other}`)).catch(
        () => undefined
      );
    }

    const avatarUrl = `/uploads/${fileName}?v=${Date.now()}`;
    const profile = await queryOne<Profile>(
      `UPDATE "User" SET "avatarUrl" = $2, "updatedAt" = now()
        WHERE "id" = $1 RETURNING ${PROFILE_COLUMNS}`,
      [session.userId, avatarUrl]
    );
    return { profile };
  }, "Avatar upload error");
}

/// Gỡ ảnh đại diện, quay về chữ cái đầu của tên.
export async function DELETE() {
  return handle(async () => {
    const session = await requireEmployee();
    const directory = uploadDir();
    for (const ext of IMAGE_EXTENSIONS) {
      await unlink(join(directory, `avatar-${session.userId}${ext}`)).catch(
        () => undefined
      );
    }
    const profile = await queryOne<Profile>(
      `UPDATE "User" SET "avatarUrl" = NULL, "updatedAt" = now()
        WHERE "id" = $1 RETURNING ${PROFILE_COLUMNS}`,
      [session.userId]
    );
    return { profile };
  }, "Avatar delete error");
}
