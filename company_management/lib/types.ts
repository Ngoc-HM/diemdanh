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
  startDate: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/// Hồ sơ nhân viên không kèm mật khẩu — dùng cho mọi response.
export type EmployeeRow = Omit<UserRow, "password" | "role" | "updatedAt">;

export const EMPLOYEE_COLUMNS = `
  "id", "employeeCode", "name", "email", "employmentType", "phone",
  "department", "position", "startDate", "isActive", "createdAt"
`;

export type WorkSessionRow = {
  id: string;
  code: string;
  name: string;
  checkInStart: string;
  checkInEnd: string;
  workStart: string;
  workEnd: string;
  minHours: number;
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
  date: string;
  name: string;
  createdAt: Date;
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
