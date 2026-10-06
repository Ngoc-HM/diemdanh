"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import PageHeader from "../../_components/page-header";
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
} from "@/app/_components/ui";
import {
  ALLOWANCE_MODE_LABELS,
  type AllowanceMode,
  type PayrollConfig,
} from "@/lib/payroll";

type Allowance = {
  id: string;
  name: string;
  amount: number;
  mode: AllowanceMode;
  taxable: boolean;
  isActive: boolean;
  assignedCount: number;
};

type AllowanceForm = {
  name: string;
  amount: string;
  mode: AllowanceMode;
  taxable: boolean;
  isActive: boolean;
};

const EMPTY_ALLOWANCE: AllowanceForm = {
  name: "",
  amount: "",
  mode: "monthly",
  taxable: true,
  isActive: true,
};

const vnd = (value: number) => value.toLocaleString("vi-VN");

export default function PayrollSettingsPage() {
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [allowances, setAllowances] = useState<Allowance[]>([]);
  const [editing, setEditing] = useState<Allowance | "new" | null>(null);
  const [allowanceForm, setAllowanceForm] = useState<AllowanceForm>(EMPTY_ALLOWANCE);
  const [config, setConfig] = useState<PayrollConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const fail = (error: unknown, fallback: string) =>
    setMessage({ type: "error", text: error instanceof Error ? error.message : fallback });

  const loadAllowances = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/allowances");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setAllowances(payload.allowances);
    } catch (error) {
      fail(error, "Không tải được khoản hỗ trợ");
    }
  }, []);

  useEffect(() => {
    loadAllowances();
    fetch("/api/settings/payroll")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => payload?.config && setConfig(payload.config))
      .catch(() => undefined);
  }, [loadAllowances]);

  function openAllowance(target: Allowance | "new") {
    setEditing(target);
    setAllowanceForm(
      target === "new"
        ? EMPTY_ALLOWANCE
        : {
            name: target.name,
            amount: String(target.amount),
            mode: target.mode,
            taxable: target.taxable,
            isActive: target.isActive,
          }
    );
  }

  async function saveAllowance(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const response = await fetch(
        editing === "new" ? "/api/admin/allowances" : `/api/admin/allowances/${editing.id}`,
        {
          method: editing === "new" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(allowanceForm),
        }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không lưu được");
      setEditing(null);
      setMessage({ type: "success", text: `Đã lưu khoản “${allowanceForm.name}”` });
      loadAllowances();
    } catch (error) {
      fail(error, "Không lưu được");
    } finally {
      setSaving(false);
    }
  }

  async function removeAllowance(item: Allowance) {
    if (
      !confirm(
        `Xoá khoản “${item.name}”?${
          item.assignedCount > 0 ? ` ${item.assignedCount} người đang hưởng sẽ mất khoản này.` : ""
        } Bảng lương đã chốt không bị ảnh hưởng.`
      )
    ) {
      return;
    }
    try {
      const response = await fetch(`/api/admin/allowances/${item.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Không xoá được");
      loadAllowances();
    } catch (error) {
      fail(error, "Không xoá được");
    }
  }

  async function saveConfig(event: React.FormEvent) {
    event.preventDefault();
    if (!config) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/payroll", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không lưu được");
      setConfig(payload.config);
      setMessage({ type: "success", text: "Đã lưu cấu hình lương" });
    } catch (error) {
      fail(error, "Không lưu được");
    } finally {
      setSaving(false);
    }
  }

  const numberField = (
    label: string,
    value: number,
    onChange: (value: number) => void,
    options: { step?: string; suffix?: string; hint?: string } = {}
  ) => (
    <Field label={label} hint={options.hint}>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min="0"
          step={options.step ?? "1"}
          value={Number.isFinite(value) ? value : ""}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {options.suffix && <span className="text-sm text-slate-500">{options.suffix}</span>}
      </div>
    </Field>
  );

  const update = (patch: (current: PayrollConfig) => PayrollConfig) =>
    setConfig((current) => (current ? patch(current) : current));

  return (
    <>
      <PageHeader
        title="Cài đặt lương"
        description="Khoản hỗ trợ, mức bảo hiểm, thuế TNCN và phép năm. Thay đổi áp cho các tháng chưa chốt lương."
        actions={
          <Link href="/admin/payroll">
            <Button variant="secondary">
              <ArrowLeft size={16} aria-hidden="true" />
              Bảng lương
            </Button>
          </Link>
        }
      />

      {message && (
        <div className="mb-4">
          <Message type={message.type} onDismiss={() => setMessage(null)}>
            {message.text}
          </Message>
        </div>
      )}

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Khoản hỗ trợ</h2>
            <p className="text-sm text-slate-600">
              Tạo khoản (Hỗ trợ AI, gửi xe...) rồi gắn cho từng người ở “Hồ sơ lương”.
            </p>
          </div>
          <Button onClick={() => openAllowance("new")}>
            <Plus size={16} aria-hidden="true" />
            Thêm khoản
          </Button>
        </div>
        {allowances.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Chưa có khoản hỗ trợ nào" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-2 font-semibold text-slate-900">Tên</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-900">Mức mặc định</th>
                  <th className="px-4 py-2 font-semibold text-slate-900">Cách tính</th>
                  <th className="px-4 py-2 font-semibold text-slate-900">Thuế</th>
                  <th className="px-4 py-2 font-semibold text-slate-900">Đang hưởng</th>
                  <th className="w-28 px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allowances.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {item.name}
                      {!item.isActive && (
                        <span className="ml-2">
                          <Badge>Đã tắt</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{vnd(item.amount)}đ</td>
                    <td className="px-4 py-2 text-slate-700">{ALLOWANCE_MODE_LABELS[item.mode]}</td>
                    <td className="px-4 py-2 text-slate-700">
                      {item.taxable ? "Chịu thuế" : "Không chịu thuế"}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{item.assignedCount} người</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openAllowance(item)}
                          aria-label={`Sửa ${item.name}`}
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => removeAllowance(item)}
                          aria-label={`Xoá ${item.name}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {config && (
        <form onSubmit={saveConfig}>
          <Card className="mb-6 p-5">
            <h2 className="text-base font-semibold text-slate-900">Bảo hiểm (người lao động đóng)</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              {numberField("BHXH", config.insurance.bhxh, (value) =>
                update((c) => ({ ...c, insurance: { ...c.insurance, bhxh: value } })), { step: "0.1", suffix: "%" })}
              {numberField("BHYT", config.insurance.bhyt, (value) =>
                update((c) => ({ ...c, insurance: { ...c.insurance, bhyt: value } })), { step: "0.1", suffix: "%" })}
              {numberField("BHTN", config.insurance.bhtn, (value) =>
                update((c) => ({ ...c, insurance: { ...c.insurance, bhtn: value } })), { step: "0.1", suffix: "%" })}
            </div>
          </Card>

          <Card className="mb-6 p-5">
            <h2 className="text-base font-semibold text-slate-900">Thuế TNCN</h2>
            <p className="mt-1 text-sm text-slate-600">
              Mức giảm trừ và biểu thuế mặc định cần kế toán đối chiếu với quy định đang áp dụng.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {numberField("Khấu trừ thẳng", config.flatTaxRate, (value) =>
                update((c) => ({ ...c, flatTaxRate: value })), { step: "0.5", suffix: "%" })}
              {numberField("Ngưỡng khấu trừ thẳng", config.flatTaxThreshold, (value) =>
                update((c) => ({ ...c, flatTaxThreshold: value })), {
                  step: "100000",
                  suffix: "đ",
                  hint: "0 = trừ mọi khoản; luật: từ 2.000.000đ",
                })}
              {numberField("Giảm trừ bản thân", config.personalDeduction, (value) =>
                update((c) => ({ ...c, personalDeduction: value })), { step: "100000", suffix: "đ" })}
              {numberField("Giảm trừ mỗi người phụ thuộc", config.dependentDeduction, (value) =>
                update((c) => ({ ...c, dependentDeduction: value })), { step: "100000", suffix: "đ" })}
            </div>

            <h3 className="mt-5 text-sm font-semibold text-slate-900">Biểu thuế luỹ tiến (theo tháng)</h3>
            <div className="mt-2 space-y-2">
              {config.taxBrackets.map((bracket, index) => {
                const last = index === config.taxBrackets.length - 1;
                const lower = index === 0 ? 0 : (config.taxBrackets[index - 1].upTo ?? 0);
                return (
                  <div key={index} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-44 text-slate-600">
                      Bậc {index + 1}: trên {vnd(lower)}đ
                    </span>
                    {last ? (
                      <span className="w-48 text-slate-600">trở lên</span>
                    ) : (
                      <span className="flex w-48 items-center gap-1.5">
                        đến
                        <Input
                          type="number"
                          min="0"
                          step="1000000"
                          value={bracket.upTo ?? ""}
                          aria-label={`Cận trên bậc ${index + 1}`}
                          onChange={(event) =>
                            update((c) => ({
                              ...c,
                              taxBrackets: c.taxBrackets.map((item, position) =>
                                position === index ? { ...item, upTo: Number(event.target.value) } : item
                              ),
                            }))
                          }
                        />
                      </span>
                    )}
                    <span className="flex w-28 items-center gap-1.5">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={bracket.rate}
                        aria-label={`Thuế suất bậc ${index + 1}`}
                        onChange={(event) =>
                          update((c) => ({
                            ...c,
                            taxBrackets: c.taxBrackets.map((item, position) =>
                              position === index ? { ...item, rate: Number(event.target.value) } : item
                            ),
                          }))
                        }
                      />
                      %
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="mb-6 p-5">
            <h2 className="text-base font-semibold text-slate-900">Phép năm</h2>
            <p className="mt-1 text-sm text-slate-600">
              Cộng dần mỗi tháng (số ngày/năm ÷ 12). Nghỉ N trừ vào phép, hết phép là nghỉ không
              lương. Chỉ áp cho người bật “Hưởng phép năm” trong hồ sơ lương.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              {numberField("Số ngày phép một năm", config.annualLeave.daysPerYear, (value) =>
                update((c) => ({ ...c, annualLeave: { ...c.annualLeave, daysPerYear: value } })), { suffix: "ngày" })}
              {numberField("Cộng dồn tối đa", config.annualLeave.maxCarryYears, (value) =>
                update((c) => ({ ...c, annualLeave: { ...c.annualLeave, maxCarryYears: value } })), { suffix: "năm" })}
              {numberField("Thêm 1 ngày phép mỗi", config.annualLeave.bonusEveryYears, (value) =>
                update((c) => ({ ...c, annualLeave: { ...c.annualLeave, bonusEveryYears: value } })), { suffix: "năm làm việc" })}
            </div>
          </Card>

          <div className="mb-8 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu cấu hình lương"}
            </Button>
          </div>
        </form>
      )}

      <Modal
        open={editing !== null}
        title={editing === "new" ? "Thêm khoản hỗ trợ" : "Sửa khoản hỗ trợ"}
        onClose={() => setEditing(null)}
      >
        <form onSubmit={saveAllowance} className="space-y-4">
          <Field label="Tên khoản" required>
            <Input
              value={allowanceForm.name}
              onChange={(event) => setAllowanceForm({ ...allowanceForm, name: event.target.value })}
              placeholder="Vd: Hỗ trợ AI, Gửi xe"
              maxLength={60}
              required
            />
          </Field>
          <Field label="Mức mặc định (đ)" required hint="Từng người có thể có mức riêng">
            <Input
              type="number"
              min="0"
              step="1000"
              value={allowanceForm.amount}
              onChange={(event) => setAllowanceForm({ ...allowanceForm, amount: event.target.value })}
              required
            />
          </Field>
          <Field label="Cách tính" required>
            <Select
              value={allowanceForm.mode}
              onChange={(event) =>
                setAllowanceForm({ ...allowanceForm, mode: event.target.value as AllowanceMode })
              }
            >
              <option value="monthly">Cố định mỗi tháng</option>
              <option value="prorated">Theo tỉ lệ ngày công (mức × công / ngày công tháng)</option>
              <option value="per_day">Theo số ngày công (mức × số công)</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={allowanceForm.taxable}
              onChange={(event) => setAllowanceForm({ ...allowanceForm, taxable: event.target.checked })}
            />
            Chịu thuế TNCN
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={allowanceForm.isActive}
              onChange={(event) => setAllowanceForm({ ...allowanceForm, isActive: event.target.checked })}
            />
            Đang dùng
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
