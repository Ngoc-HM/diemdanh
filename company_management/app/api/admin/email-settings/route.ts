import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import {
  EmailConfig,
  getEmailConfig,
  saveEmailConfig,
} from "@/lib/mailer";
import { getLastReminderMonth } from "@/lib/reminder";

/// Không bao giờ trả mật khẩu SMTP về client, chỉ báo là đã có hay chưa.
function publicView(config: EmailConfig | null) {
  return {
    host: config?.host ?? "",
    port: config?.port ?? 587,
    secure: config?.secure ?? false,
    user: config?.user ?? "",
    hasPassword: Boolean(config?.password),
    from: config?.from ?? "",
    appUrl: config?.appUrl ?? "",
    reminderEnabled: config?.reminderEnabled ?? true,
    notifyEnabled: config?.notifyEnabled ?? true,
  };
}

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const [config, lastReminderMonth] = await Promise.all([
      getEmailConfig(),
      getLastReminderMonth(),
    ]);
    return { config: publicView(config), lastReminderMonth };
  }, "Email settings read error");
}

/// Lưu cấu hình SMTP. Mật khẩu để trống nghĩa là giữ mật khẩu đã lưu.
export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const existing = await getEmailConfig();

    const host = String(body?.host || "").trim();
    const port = Number(body?.port);
    const from = String(body?.from || "").trim();
    const appUrl = String(body?.appUrl || "").trim().replace(/\/+$/, "");
    const password = String(body?.password || "");

    if (!host) badRequest("Vui lòng nhập máy chủ SMTP");
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      badRequest("Cổng SMTP phải là số từ 1 đến 65535");
    }
    if (!from) badRequest("Vui lòng nhập địa chỉ người gửi");
    if (appUrl && !/^https?:\/\/[^\s/]+/.test(appUrl)) {
      badRequest("Địa chỉ web phải bắt đầu bằng http:// hoặc https://");
    }

    const config: EmailConfig = {
      host,
      port,
      secure: Boolean(body?.secure),
      user: String(body?.user || "").trim(),
      password: password || existing?.password || "",
      from,
      appUrl,
      reminderEnabled:
        body?.reminderEnabled === undefined
          ? (existing?.reminderEnabled ?? true)
          : Boolean(body.reminderEnabled),
      notifyEnabled:
        body?.notifyEnabled === undefined
          ? (existing?.notifyEnabled ?? true)
          : Boolean(body.notifyEnabled),
    };

    await saveEmailConfig(config);
    return { config: publicView(config) };
  }, "Email settings write error");
}
