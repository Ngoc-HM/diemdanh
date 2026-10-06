import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { UPLOAD_FILE_PATTERN, uploadDir } from "@/lib/uploads";

const CONTENT_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

/// Phục vụ logo và ảnh đại diện từ UPLOAD_DIR (xem lib/uploads.ts). Công khai
/// như file trong public/ trước đây: trang đăng nhập cần hiện logo khi chưa có
/// phiên.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  const match = UPLOAD_FILE_PATTERN.exec(file);
  if (!match) return new Response("Not found", { status: 404 });

  try {
    const body = await readFile(join(uploadDir(), file));
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": CONTENT_TYPE[match[2]],
        // Logo giữ nguyên tên khi đổi ảnh nên trình duyệt phải hỏi lại mỗi lần.
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
