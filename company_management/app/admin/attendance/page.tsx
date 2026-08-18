import { redirect } from "next/navigation";

export default function AdminAttendanceIndex() {
  redirect("/admin/attendance/monthly");
}
