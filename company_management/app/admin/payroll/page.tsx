"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Lock,
  LockOpen,
  Pencil,
  Settings2,
} from "lucide-react";
import PageHeader from "../_components/page-header";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Message,
  Modal,
  Select,
  TableSkeleton,
} from "@/app/_components/ui";
import { addMonths, formatMonthLabel, monthKeyVN } from "@/lib/datetime";
import { formatWorkdays } from "@/lib/attendance-rules";
import {
  ALLOWANCE_MODE_LABELS,
  type AllowanceMode,
  CONTRACT_LABELS,
  type ContractType,
  PAY_BASIS_LABELS,
  type PayBasis,
  type PayProfile,
  TAX_MODE_LABELS,
  type TaxMode,
} from "@/lib/payroll";

type PayrollRow = {
  user: { id: string; name: string; employeeCode: string | null; position: string | null };
  hasProfile: boolean;
  contractLabel: string;
  attendance: { workdays: number; leaveDays: number; reviewDays: number; projectedDays: number };
  leave: { eligible: boolean; paidDays: number; unpaidDays: number; balance: number };
  payroll: {
    payBasis: PayBasis;
    baseSalary: number;
    salaryType: "monthly" | "daily";
    standardWorkdays: number;
    workdays: number;
    paidLeaveDays: number;
    earned: number;
    allowanceTotal: number;
    overtimeTotal: number;
    gross: number;
    insurance: { total: number };
    tax: number;
    net: number;
  };
};

type Payload = {
  month: string;
  computedOn: string;
  projected: boolean;
  standardWorkdays: number;
  rows: PayrollRow[];
  closed: { closedAt: string } | null;
  warnings: {
    missingProfiles: string[];
    reviewDays: number;
    pendingOvertime: number;
    projectedDays: number;
  };
};

type ProfileAllowance = {
  id: string;
  name: string;
  amount: number;
  mode: AllowanceMode;
  taxable: boolean;
  isActive: boolean;
  assigned: boolean;
  customAmount: number | null;
};

/// Form hồ sơ lương: số giữ ở dạng chuỗi để ô nhập trống được.
type ProfileForm = Omit<PayProfile, "baseSalary" | "insuranceSalary" | "probationPercent" | "dependents"> & {
  baseSalary: string;
  insuranceSalary: string;
  probationPercent: string;
  dependents: string;
};

const vnd = (value: number) => value.toLocaleString("vi-VN");

export default function PayrollPage() {
  const [month, setMonth] = useState(() => monthKeyVN());
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const [editing, setEditing] = useState<PayrollRow | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [allowances, setAllowances] = useState<ProfileAllowance[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (target: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/payroll?month=${target}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không tải được bảng lương");
      setData(payload);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không tải được bảng lương",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  async function toggleClose() {
    if (!data) return;
    const closing = !data.closed;
    const confirmText = closing
      ? `Chốt lương ${formatMonthLabel(month)}? Sau khi chốt, số liệu được giữ nguyên dù chấm công hay hồ sơ lương có đổi.${
          data.projected ? " Các ngày còn lại trong tháng được tính là đi làm đủ theo lịch." : ""
        }`
      : `Mở chốt lương ${formatMonthLabel(month)}? Bảng lương sẽ tính lại theo dữ liệu hiện tại.`;
    if (!confirm(confirmText)) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        closing ? "/api/admin/payroll/close" : `/api/admin/payroll/close?month=${month}`,
        {
          method: closing ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: closing ? JSON.stringify({ month }) : undefined,
        }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không thực hiện được");
      setMessage({
        type: "success",
        text: closing ? `Đã chốt lương ${formatMonthLabel(month)}` : "Đã mở chốt, bảng lương tính lại theo dữ liệu hiện tại",
      });
      load(month);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không thực hiện được",
      });
    } finally {
      setBusy(false);
    }
  }

  async function openProfile(row: PayrollRow) {
    setEditing(row);
    setForm(null);
    try {
      const response = await fetch(`/api/admin/payroll/profile/${row.user.id}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không tải được hồ sơ lương");
      const profile: PayProfile = payload.profile;
      setForm({
        ...profile,
        baseSalary: profile.baseSalary ? String(profile.baseSalary) : "",
        insuranceSalary: profile.insuranceSalary !== null ? String(profile.insuranceSalary) : "",
        probationPercent: String(profile.probationPercent),
        dependents: String(profile.dependents),
      });
      setAllowances(payload.allowances);
      setStartDate(payload.user.startDate);
    } catch (error) {
      setEditing(null);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không tải được hồ sơ lương",
      });
    }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || !form) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/payroll/profile/${editing.user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          allowances: allowances
            .filter((item) => item.assigned)
            .map((item) => ({ allowanceId: item.id, amount: item.customAmount })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không lưu được");
      setEditing(null);
      setMessage({ type: "success", text: `Đã lưu hồ sơ lương của ${editing.user.name}` });
      load(month);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không lưu được",
      });
    } finally {
      setSaving(false);
    }
  }

  const download = (userId?: string) =>
    window.open(
      `/api/admin/payroll/export?month=${month}${userId ? `&userId=${userId}` : ""}`,
      "_blank"
    );

  const totals = data?.rows.reduce(
    (acc, row) => ({
      gross: acc.gross + row.payroll.gross,
      insurance: acc.insurance + row.payroll.insurance.total,
      tax: acc.tax + row.payroll.tax,
      net: acc.net + row.payroll.net,
    }),
    { gross: 0, insurance: 0, tax: 0, net: 0 }
  );
  const warnings = data?.warnings;
  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  return (
    <>
      <PageHeader
        title="Bảng lương"
        description="Tính từ bảng chấm công, phiếu OT đã duyệt, hồ sơ lương và khoản hỗ trợ của từng người. Admin tự tải file — hệ thống không gửi email."
        actions={
          <>
            <Link href="/admin/payroll/settings">
              <Button variant="secondary">
                <Settings2 size={16} aria-hidden="true" />
                Cài đặt lương
              </Button>
            </Link>
            <Button onClick={() => download()} disabled={!data || data.rows.length === 0}>
              <Download size={16} aria-hidden="true" />
              Tải bảng lương công ty
            </Button>
          </>
        }
      />

      <div className="mb-6 flex items-center justify-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setMonth(addMonths(month, -1))}
          aria-label="Tháng trước"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </Button>
        <span className="min-w-40 text-center text-base font-semibold text-slate-900">
          {formatMonthLabel(month)}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setMonth(addMonths(month, 1))}
          aria-label="Tháng sau"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </Button>
      </div>

      {message && (
        <div className="mb-4">
          <Message type={message.type} onDismiss={() => setMessage(null)}>
            {message.text}
          </Message>
        </div>
      )}

      {data && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm">
            {data.closed ? (
              <>
                <Badge tone="success">Đã chốt</Badge>
                <span className="text-slate-700">
                  lúc {new Date(data.closed.closedAt).toLocaleString("vi-VN")} — số liệu được
                  giữ nguyên, sửa chấm công hay hồ sơ lương không làm đổi bảng này.
                </span>
              </>
            ) : (
              <>
                <Badge tone="warning">Tạm tính</Badge>
                <span className="text-slate-700">
                  {data.projected
                    ? `Từ hôm nay đến hết tháng tính là đi làm đủ theo lịch (${warnings?.projectedDays ?? 0} ngày-người).`
                    : "Chưa chốt — số liệu thay đổi theo chấm công."}
                </span>
              </>
            )}
          </div>
          <Button
            variant={data.closed ? "secondary" : "primary"}
            onClick={toggleClose}
            disabled={busy || data.rows.length === 0}
          >
            {data.closed ? (
              <LockOpen size={16} aria-hidden="true" />
            ) : (
              <Lock size={16} aria-hidden="true" />
            )}
            {data.closed ? "Mở chốt" : "Chốt lương tháng"}
          </Button>
        </Card>
      )}

      {!data?.closed && warnings && (
        <div className="mb-4 space-y-2">
          {warnings.missingProfiles.length > 0 && (
            <Message type="info">
              {warnings.missingProfiles.length} người chưa có hồ sơ lương nên đang 0 đồng:{" "}
              {warnings.missingProfiles.join(", ")}. Bấm “Hồ sơ lương” ở dòng đó để nhập.
            </Message>
          )}
          {warnings.reviewDays > 0 && (
            <Message type="info">
              {warnings.reviewDays} ngày thiếu giờ chưa xem lại — đang tính đủ công. Xem ở
              trang chi tiết nhân viên trước khi chốt.
            </Message>
          )}
          {warnings.pendingOvertime > 0 && (
            <Message type="info">
              {warnings.pendingOvertime} phiếu OT trong tháng đang chờ duyệt, chưa vào lương.{" "}
              <Link href="/admin/overtime" className="font-medium underline">
                Duyệt ngay
              </Link>
            </Message>
          )}
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : data && data.rows.length > 0 ? (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-3 font-semibold text-slate-900">Nhân viên</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-900">Lương CB</th>
                <th className="px-3 py-3 text-center font-semibold text-slate-900">
                  Công / {data.standardWorkdays}
                </th>
                <th className="px-3 py-3 text-right font-semibold text-slate-900">Thành tiền</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-900">Hỗ trợ</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-900">OT</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-900">Tổng</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-900">BH</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-900">Thuế</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-900">Thực nhận</th>
                <th className="w-48 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {data.rows.map((row) => (
                <tr key={row.user.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{row.user.name}</div>
                    <div className="text-xs text-slate-500">
                      {row.hasProfile
                        ? `${row.contractLabel} · ${PAY_BASIS_LABELS[row.payroll.payBasis]}`
                        : "Chưa có hồ sơ lương"}
                      {row.user.employeeCode ? ` · ${row.user.employeeCode}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-slate-700">
                    {vnd(row.payroll.baseSalary)}
                    {row.payroll.salaryType === "daily" && (
                      <div className="text-xs text-slate-500">/ ngày</div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-slate-900">
                    {formatWorkdays(row.payroll.workdays)}
                    {row.payroll.paidLeaveDays > 0 && (
                      <div className="text-xs text-emerald-700">
                        + {formatWorkdays(row.payroll.paidLeaveDays)} phép
                      </div>
                    )}
                    {row.attendance.projectedDays > 0 && !data.closed && (
                      <div className="text-xs text-slate-500">
                        {row.attendance.projectedDays} ngày tạm tính
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-700">{vnd(row.payroll.earned)}</td>
                  <td className="px-3 py-3 text-right text-slate-700">
                    {row.payroll.allowanceTotal ? vnd(row.payroll.allowanceTotal) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-700">
                    {row.payroll.overtimeTotal ? vnd(row.payroll.overtimeTotal) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-slate-900">
                    {vnd(row.payroll.gross)}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-700">
                    {row.payroll.insurance.total ? vnd(row.payroll.insurance.total) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-700">
                    {row.payroll.tax ? vnd(row.payroll.tax) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-emerald-700">
                    {vnd(row.payroll.net)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openProfile(row)}
                        aria-label={`Hồ sơ lương của ${row.user.name}`}
                      >
                        <Pencil size={14} aria-hidden="true" />
                        Hồ sơ lương
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => download(row.user.id)}
                        aria-label={`Tải phiếu lương của ${row.user.name}`}
                        title="Tải phiếu lương"
                      >
                        <Download size={14} aria-hidden="true" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {totals && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold tabular-nums text-slate-900">
                  <td className="px-4 py-3" colSpan={6}>
                    Tổng cộng {data.rows.length} người
                  </td>
                  <td className="px-3 py-3 text-right">{vnd(totals.gross)}</td>
                  <td className="px-3 py-3 text-right">{vnd(totals.insurance)}</td>
                  <td className="px-3 py-3 text-right">{vnd(totals.tax)}</td>
                  <td className="px-3 py-3 text-right text-emerald-700">{vnd(totals.net)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </Card>
      ) : (
        <EmptyState title="Chưa có nhân viên nào đang hoạt động" />
      )}

      <Modal
        open={editing !== null}
        title={`Hồ sơ lương — ${editing?.user.name ?? ""}`}
        onClose={() => setEditing(null)}
      >
        {!form ? (
          <TableSkeleton rows={4} />
        ) : (
          <form onSubmit={saveProfile} className="space-y-4">
            {data?.closed && (
              <Message type="info">
                Tháng này đã chốt: thay đổi hồ sơ chỉ áp từ tháng chưa chốt.
              </Message>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Hình thức lương"
                required
                hint={
                  form.payBasis === "net"
                    ? "Số thoả thuận là số cầm về; công ty chịu thuế và BH, hệ thống quy ngược ra gross."
                    : "Số thoả thuận là trước thuế và BH; người lao động tự chịu khoản trừ."
                }
              >
                <Select
                  value={form.payBasis}
                  onChange={(event) => set("payBasis", event.target.value as PayBasis)}
                >
                  <option value="gross">GROSS — trước thuế, bảo hiểm</option>
                  <option value="net">NET — số cầm về</option>
                </Select>
              </Field>
              <Field label="Kiểu lương" required>
                <Select
                  value={form.salaryType}
                  onChange={(event) => set("salaryType", event.target.value as PayProfile["salaryType"])}
                >
                  <option value="monthly">Lương tháng (chia theo ngày công)</option>
                  <option value="daily">Đơn giá theo ngày công</option>
                </Select>
              </Field>
              <Field
                label={`${form.salaryType === "daily" ? "Đơn giá một ngày công" : "Lương cơ bản / tháng"} (${PAY_BASIS_LABELS[form.payBasis]}, đ)`}
                required
              >
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={form.baseSalary}
                  onChange={(event) => set("baseSalary", event.target.value)}
                  required
                />
              </Field>
              <Field label="Loại hợp đồng" required>
                <Select
                  value={form.contractType}
                  onChange={(event) => set("contractType", event.target.value as ContractType)}
                >
                  {(Object.keys(CONTRACT_LABELS) as ContractType[]).map((key) => (
                    <option key={key} value={key}>
                      {CONTRACT_LABELS[key]}
                    </option>
                  ))}
                </Select>
              </Field>
              {form.contractType === "probation" ? (
                <Field label="Lương thử việc (% lương cơ bản)" hint="Luật: tối thiểu 85%">
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={form.probationPercent}
                    onChange={(event) => set("probationPercent", event.target.value)}
                  />
                </Field>
              ) : (
                <Field label="Giới tính">
                  <Select
                    value={form.gender ?? ""}
                    onChange={(event) =>
                      set("gender", (event.target.value || null) as PayProfile["gender"])
                    }
                  >
                    <option value="">—</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                  </Select>
                </Field>
              )}
              <Field label="Thuế TNCN" required>
                <Select
                  value={form.taxMode}
                  onChange={(event) => set("taxMode", event.target.value as TaxMode)}
                >
                  {(Object.keys(TAX_MODE_LABELS) as TaxMode[]).map((key) => (
                    <option key={key} value={key}>
                      {TAX_MODE_LABELS[key]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Số người phụ thuộc" hint="Chỉ dùng khi tính thuế luỹ tiến">
                <Input
                  type="number"
                  min="0"
                  max="20"
                  value={form.dependents}
                  onChange={(event) => set("dependents", event.target.value)}
                />
              </Field>
              <Field label="Số tài khoản">
                <Input
                  value={form.bankAccount ?? ""}
                  onChange={(event) => set("bankAccount", event.target.value)}
                />
              </Field>
              <Field label="Ngân hàng">
                <Input
                  value={form.bankName ?? ""}
                  onChange={(event) => set("bankName", event.target.value)}
                />
              </Field>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 p-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.hasInsurance}
                  onChange={(event) => set("hasInsurance", event.target.checked)}
                />
                Đóng bảo hiểm (BHXH, BHYT, BHTN)
              </label>
              {form.hasInsurance && (
                <Field
                  label="Lương đóng bảo hiểm (đ)"
                  required={form.payBasis === "net"}
                  hint={
                    form.payBasis === "net"
                      ? "Bắt buộc với lương NET"
                      : "Bỏ trống = theo lương cơ bản"
                  }
                >
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={form.insuranceSalary}
                    onChange={(event) => set("insuranceSalary", event.target.value)}
                  />
                </Field>
              )}
              {form.contractType !== "collaborator" && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.annualLeave}
                    onChange={(event) => set("annualLeave", event.target.checked)}
                  />
                  Hưởng phép năm (mỗi tháng cộng 1 ngày, nghỉ N trừ vào phép)
                </label>
              )}
              {form.annualLeave && form.contractType !== "collaborator" && (
                <Field
                  label="Tính phép từ ngày"
                  hint={`Bỏ trống = ngày vào làm${startDate ? ` (${startDate})` : " (chưa nhập ngày vào làm)"}`}
                >
                  <Input
                    type="date"
                    value={form.leaveStartDate ?? ""}
                    onChange={(event) => set("leaveStartDate", event.target.value || null)}
                  />
                </Field>
              )}
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Khoản hỗ trợ được hưởng
              </span>
              {allowances.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Chưa có khoản hỗ trợ nào. Tạo ở{" "}
                  <Link href="/admin/payroll/settings" className="font-medium text-sky-700 underline">
                    Cài đặt lương
                  </Link>
                  .
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {allowances.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                      <label className="flex min-w-48 flex-1 items-center gap-2 text-sm text-slate-800">
                        <input
                          type="checkbox"
                          checked={item.assigned}
                          disabled={!item.isActive && !item.assigned}
                          onChange={(event) =>
                            setAllowances((current) =>
                              current.map((entry) =>
                                entry.id === item.id ? { ...entry, assigned: event.target.checked } : entry
                              )
                            )
                          }
                        />
                        <span>
                          {item.name}
                          <span className="ml-1 text-xs text-slate-500">
                            · {vnd(item.amount)}đ · {ALLOWANCE_MODE_LABELS[item.mode]}
                            {!item.isActive && " · đã tắt"}
                          </span>
                        </span>
                      </label>
                      {item.assigned && (
                        <Input
                          type="number"
                          min="0"
                          step="1000"
                          className="w-36"
                          placeholder="Mức riêng"
                          aria-label={`Mức riêng cho ${item.name}`}
                          value={item.customAmount ?? ""}
                          onChange={(event) =>
                            setAllowances((current) =>
                              current.map((entry) =>
                                entry.id === item.id
                                  ? {
                                      ...entry,
                                      customAmount:
                                        event.target.value === "" ? null : Number(event.target.value),
                                    }
                                  : entry
                              )
                            )
                          }
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                Huỷ
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu hồ sơ"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
