import AccessWarning from "@/app/_components/access-warning";

/// Mọi đường dẫn không tồn tại đều rơi vào đây.
export default function NotFound() {
  return <AccessWarning kind="not_found" />;
}
