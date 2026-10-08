/// Kiểu của từng dòng trả về từ Postgres. Tên cột trong DDL được đặt trong dấu
/// nháy kép nên giữ nguyên camelCase khi driver `pg` trả về.

export type UserRow = {
  id: string;
  employeeCode: string | null;
  name: string;
  email: string;
  password: string;
  role: string;
  employmentType: string;
  phone: string | null;
  department: string | null;
  position: string | null;
  /// Ảnh đại diện nhân viên tự upload, dạng "/uploads/avatar-<id>.png".
  avatarUrl: string | null;
  startDate: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/// Hồ sơ nhân viên không kèm mật khẩu — dùng cho mọi response.
export type EmployeeRow = Omit<UserRow, "password" | "role" | "updatedAt"> & {
  /// Đã bật xác thực 2 lớp hay chưa (không bao giờ trả khoá ra ngoài).
  twoFactorEnabled: boolean;
};

export const EMPLOYEE_COLUMNS = `
  "id", "employeeCode", "name", "email", "employmentType", "phone",
  "department", "position", "avatarUrl", "startDate", "isActive", "createdAt",
  "totpSecret" IS NOT NULL AS "twoFactorEnabled"
`;

export type WorkSessionRow = {
  id: string;
  code: string;
  name: string;
  workStart: string;
  workEnd: string;
  minHours: number;
  /// Số công: 1 = một ngày, 0,5 = nửa ngày, 0 = không tính công (vd. tăng ca).
  workdayValue: number;
  isDefaultFull: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AttendanceRow = {
  id: string;
  userId: string;
  date: string;
  note: string | null;
  editedBy: string | null;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AttendancePunchRow = {
  id: string;
  attendanceId: string;
  type: string;
  at: Date;
  latitude: number | null;
  longitude: number | null;
  distance: number | null;
  locationId: string | null;
  withinRadius: boolean;
  isManual: boolean;
  createdAt: Date;
};

/// Punch kèm tên vị trí, lấy qua LEFT JOIN WorkLocation.
export type AttendancePunchWithLocation = AttendancePunchRow & {
  locationName: string | null;
};

export type WorkLocationRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ScheduleDayRow = {
  id: string;
  registrationId: string;
  date: string;
  sessionId: string;
  createdAt: Date;
};

export type HolidayRow = {
  id: string;
  /// Ngày đại diện (= startDate), giữ để tương thích dữ liệu cũ.
  date: string;
  startDate: string;
  endDate: string;
  name: string;
  createdAt: Date;
};


export type ShiftChangeRequestStatus = "pending" | "approved" | "rejected";

/// Yêu cầu đổi ca / xin nghỉ một ngày của nhân viên, admin duyệt hoặc từ chối.
export type ShiftChangeRequestRow = {
  id: string;
  userId: string;
  date: string;
  /// 'N' = xin nghỉ; null = đổi sang các ca trong sessionIds.
  leaveCode: "N" | null;
  sessionIds: string[] | null;
  reason: string;
  status: ShiftChangeRequestStatus;
  adminNote: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/// Một khoảng thời gian trong báo cáo "Nội dung công việc hằng ngày".
/// Các khoảng của cùng một ngày nối tiếp nhau: `endAt` của khoảng trước là
/// `startAt` của khoảng sau.
export type WorkReportEntryRow = {
  id: string;
  userId: string;
  /// "YYYY-MM-DD" theo lịch Việt Nam.
  date: string;
  startAt: Date;
  endAt: Date;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminRow = {
  id: string;
  username: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SettingsRow = {
  id: string;
  key: string;
  value: string;
};
