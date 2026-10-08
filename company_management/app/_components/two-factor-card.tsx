"use client";

import { useEffect, useState } from "react";
import {
  Copy,
  Download,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Message,
} from "@/app/_components/ui";

type Status = {
  enabled: boolean;
  enabledAt: string | null;
  backupCodesRemaining: number;
};

type Step =
  | { kind: "idle" }
  | { kind: "password" }
  | { kind: "scan"; qrSvg: string; secret: string }
  | { kind: "backup"; codes: string[] }
  | { kind: "disable" }
  | { kind: "regenerate" };

type Feedback = { type: "success" | "error"; text: string };

async function post(body: Record<string, string>) {
  const response = await fetch("/api/auth/2fa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Không thực hiện được");
  return payload;
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

/// Khoá base32 chia nhóm 4 ký tự cho dễ gõ tay khi không quét được QR.
function groupSecret(secret: string) {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

/// Thẻ bật / tắt xác thực 2 lớp bằng app (Google Authenticator, Microsoft
/// Authenticator...). Dùng chung cho trang tài khoản admin và cài đặt nhân viên.
export default function TwoFactorCard({
  className = "",
}: {
  className?: string;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    fetch("/api/auth/2fa")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => payload && setStatus(payload))
      .catch(() =>
        setFeedback({ type: "error", text: "Không tải được trạng thái 2 lớp" }),
      );
  }, []);

  function goto(next: Step) {
    setStep(next);
    setPassword("");
    setCode("");
    setFeedback(null);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setFeedback(null);
    try {
      await action();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Không thực hiện được",
      });
    } finally {
      setBusy(false);
    }
  }

  const startSetup = (event: React.FormEvent) => {
    event.preventDefault();
    run(async () => {
      const payload = await post({ action: "setup", password });
      goto({ kind: "scan", qrSvg: payload.qrSvg, secret: payload.secret });
    });
  };

  const confirmSetup = (event: React.FormEvent) => {
    event.preventDefault();
    run(async () => {
      const payload = await post({ action: "confirm", code });
      setStatus(payload.status);
      goto({ kind: "backup", codes: payload.backupCodes });
    });
  };

  const disable = (event: React.FormEvent) => {
    event.preventDefault();
    run(async () => {
      const payload = await post({ action: "disable", password, code });
      setStatus(payload.status);
      goto({ kind: "idle" });
      setFeedback({ type: "success", text: "Đã tắt xác thực 2 lớp" });
    });
  };

  const regenerate = (event: React.FormEvent) => {
    event.preventDefault();
    run(async () => {
      const payload = await post({ action: "regenerate", code });
      setStatus(payload.status);
      goto({ kind: "backup", codes: payload.backupCodes });
    });
  };

  function copyCodes(codes: string[]) {
    navigator.clipboard?.writeText(codes.join("\n")).then(
      () => setFeedback({ type: "success", text: "Đã sao chép mã dự phòng" }),
      () =>
        setFeedback({
          type: "error",
          text: "Không sao chép được, hãy chép tay",
        }),
    );
  }

  function downloadCodes(codes: string[]) {
    const blob = new Blob(
      [`Mã dự phòng đăng nhập (mỗi mã dùng một lần)\n\n${codes.join("\n")}\n`],
      { type: "text/plain;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ma-du-phong-2-lop.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  const codeInput = (
    <Field label="Mã 6 số trong app" required>
      <Input
        value={code}
        onChange={(event) => setCode(event.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        maxLength={9}
        required
      />
    </Field>
  );

  const passwordInput = (
    <Field label="Mật khẩu hiện tại" required>
      <Input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        required
      />
    </Field>
  );

  const cancel = (
    <Button
      type="button"
      variant="ghost"
      onClick={() => goto({ kind: "idle" })}
      disabled={busy}
    >
      Huỷ
    </Button>
  );

  return (
    <Card className={className}>
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">
            Xác thực 2 lớp
          </h2>
          {status &&
            (status.enabled ? (
              <Badge tone="success">
                Đang bật từ {formatDate(status.enabledAt)}
              </Badge>
            ) : (
              <Badge tone="warning">Chưa bật</Badge>
            ))}
        </div>

        <p className="text-sm text-slate-600">
          Đăng nhập cần thêm mã 6 số trong app Google Authenticator (hoặc
          Microsoft Authenticator) trên điện thoại. Lộ mật khẩu cũng không ai
          vào được tài khoản.
        </p>

        {feedback && (
          <Message type={feedback.type} onDismiss={() => setFeedback(null)}>
            {feedback.text}
          </Message>
        )}

        {step.kind === "idle" && status && !status.enabled && (
          <div className="flex justify-end">
            <Button onClick={() => goto({ kind: "password" })}>
              <ShieldCheck size={16} aria-hidden="true" />
              Bật xác thực 2 lớp
            </Button>
          </div>
        )}

        {step.kind === "idle" && status?.enabled && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-slate-500">
              Còn {status.backupCodesRemaining} mã dự phòng
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => goto({ kind: "regenerate" })}
              >
                <RefreshCw size={16} aria-hidden="true" />
                Tạo mã dự phòng mới
              </Button>
              <Button
                variant="danger"
                onClick={() => goto({ kind: "disable" })}
              >
                <ShieldOff size={16} aria-hidden="true" />
                Tắt
              </Button>
            </div>
          </div>
        )}

        {step.kind === "password" && (
          <form onSubmit={startSetup} className="space-y-4">
            {passwordInput}
            <div className="flex justify-end gap-2">
              {cancel}
              <Button type="submit" disabled={busy}>
                {busy ? "Đang tạo..." : "Tiếp tục"}
              </Button>
            </div>
          </form>
        )}

        {step.kind === "scan" && (
          <form onSubmit={confirmSetup} className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
              <li>
                Mở app Google Authenticator, bấm dấu + rồi chọn quét mã QR.
              </li>
              <li>Quét mã bên dưới, app sẽ hiện mã 6 số đổi mỗi 30 giây.</li>
              <li>Nhập mã đang hiện để hoàn tất.</li>
            </ol>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <div
                className="h-44 w-44 shrink-0 rounded-lg border border-slate-200 bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
                aria-label="Mã QR xác thực 2 lớp"
                role="img"
                // SVG do server tạo từ thư viện qrcode, không chứa dữ liệu người dùng nhập.
                dangerouslySetInnerHTML={{ __html: step.qrSvg }}
              />
              <div className="min-w-0 space-y-2 text-sm">
                <p className="text-slate-600">
                  Không quét được? Nhập khoá này vào app:
                </p>
                <code className="block break-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-slate-900">
                  {groupSecret(step.secret)}
                </code>
              </div>
            </div>
            {codeInput}
            <div className="flex justify-end gap-2">
              {cancel}
              <Button type="submit" disabled={busy}>
                <ShieldCheck size={16} aria-hidden="true" />
                {busy ? "Đang kiểm tra..." : "Bật"}
              </Button>
            </div>
          </form>
        )}

        {step.kind === "backup" && (
          <div className="space-y-4">
            <Message type="info">
              Lưu 10 mã dự phòng này ở nơi an toàn. Mất điện thoại thì dùng một
              mã để đăng nhập — mỗi mã chỉ dùng được một lần, và sẽ không hiện
              lại.
            </Message>
            <ul className="grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-5">
              {step.codes.map((item) => (
                <li
                  key={item}
                  className="rounded-lg bg-slate-100 px-2 py-1.5 text-center text-slate-900"
                >
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => copyCodes(step.codes)}>
                <Copy size={16} aria-hidden="true" />
                Sao chép
              </Button>
              <Button
                variant="secondary"
                onClick={() => downloadCodes(step.codes)}
              >
                <Download size={16} aria-hidden="true" />
                Tải về
              </Button>
              <Button onClick={() => goto({ kind: "idle" })}>
                Đã lưu, xong
              </Button>
            </div>
          </div>
        )}

        {step.kind === "disable" && (
          <form onSubmit={disable} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {passwordInput}
              {codeInput}
            </div>
            <div className="flex justify-end gap-2">
              {cancel}
              <Button type="submit" variant="danger" disabled={busy}>
                <ShieldOff size={16} aria-hidden="true" />
                {busy ? "Đang tắt..." : "Tắt xác thực 2 lớp"}
              </Button>
            </div>
          </form>
        )}

        {step.kind === "regenerate" && (
          <form onSubmit={regenerate} className="space-y-4">
            <p className="text-sm text-slate-600">
              Bộ mã dự phòng cũ sẽ hết hiệu lực.
            </p>
            {codeInput}
            <div className="flex justify-end gap-2">
              {cancel}
              <Button type="submit" disabled={busy}>
                <RefreshCw size={16} aria-hidden="true" />
                {busy ? "Đang tạo..." : "Tạo mã mới"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
