import { join } from "node:path";

/// Logo công ty và ảnh đại diện nhân viên tự upload.
///
/// Không để trong public/: `next start` chỉ quét public/ một lần lúc khởi động,
/// file thêm sau đó trả 404 cho tới khi restart. File nằm ở UPLOAD_DIR (mặc định
/// storage/uploads) và được phục vụ qua app/uploads/[file]/route.ts, đường dẫn
/// ngoài trình duyệt vẫn là /uploads/<tên file> như cũ.
export function uploadDir() {
  return process.env.UPLOAD_DIR || join(process.cwd(), "storage", "uploads");
}

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2MB

/// Chỉ nhận ảnh raster. Không nhận SVG vì file SVG phục vụ từ cùng tên miền có
/// thể mang mã chạy được.
export const IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

export const IMAGE_EXTENSIONS = Object.values(IMAGE_MIME_TO_EXT);

/// Tên file hợp lệ để phục vụ: đúng những tên hai route upload tự đặt ra, nên
/// không thể mò sang file khác bằng "../".
export const UPLOAD_FILE_PATTERN = /^(logo|avatar-[A-Za-z0-9_-]+)\.(png|jpg|webp)$/;
