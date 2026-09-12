import AccessWarning from "@/app/_components/access-warning";

/// `middleware.ts` đẩy sang đây khi đã đăng nhập nhưng vào nhầm khu vực
/// (nhân viên mở trang quản trị hoặc ngược lại), kèm đường dẫn đã thử vào.
export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const { path } = await searchParams;
  // Chỉ nhận đường dẫn nội bộ: không để ai nhét link ra ngoài vào trang này.
  const safePath = path && /^\/[\w\-/[\]]*$/.test(path) ? path : undefined;
  return <AccessWarning kind="forbidden" path={safePath} />;
}
