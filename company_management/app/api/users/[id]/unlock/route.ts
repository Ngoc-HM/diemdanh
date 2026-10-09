import { handle, notFound, requireAdmin } from "@/lib/auth-guard";
import { unlockEmployee } from "@/lib/ip-policy";

/// Admin mở khoá tài khoản nhân viên (bị khoá vì truy cập từ IP bị chặn).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    if (!(await unlockEmployee(req, id, admin.email))) {
      notFound("Tài khoản không tồn tại hoặc không bị khoá");
    }
    return { success: true };
  }, "Unlock employee error");
}
