import { query, queryOne, transaction } from "@/lib/db";
import { badRequest, handle, notFound, requireAdmin } from "@/lib/auth-guard";
import { dateKeyVN, isValidDateKey } from "@/lib/datetime";
import { getPayProfiles } from "@/lib/payroll-service";
import { DEFAULT_PAY_PROFILE, PayProfile } from "@/lib/payroll";

const PAY_BASES = ["gross", "net"];
const SALARY_TYPES = ["monthly", "daily"];
const CONTRACT_TYPES = ["collaborator", "probation", "official"];
const TAX_MODES = ["flat10", "progressive", "none"];
const MAX_MONEY = 10_000_000_000;

/// Hồ sơ lương của một nhân viên + danh sách khoản hỗ trợ (đang hưởng hay không).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  return handle(async () => {
    await requireAdmin();
    const { userId } = await params;
    const user = await queryOne<{ id: string; name: string; startDate: Date | null }>(
      `SELECT "id", "name", "startDate" FROM "User" WHERE "id" = $1 AND "role" = 'employee'`,
      [userId]
    );
    if (!user) notFound("Không tìm thấy nhân viên");

    const [profiles, allowances] = await Promise.all([
      getPayProfiles([userId]),
      query<{
        id: string;
        name: string;
        amount: number;
        mode: string;
        taxable: boolean;
        isActive: boolean;
        assigned: boolean;
        customAmount: number | null;
      }>(
        `SELECT a."id", a."name", a."amount"::float8 AS "amount", a."mode", a."taxable",
                a."isActive", (ea."userId" IS NOT NULL) AS "assigned",
                ea."amount"::float8 AS "customAmount"
           FROM "Allowance" a
           LEFT JOIN "EmployeeAllowance" ea
             ON ea."allowanceId" = a."id" AND ea."userId" = $1
          ORDER BY a."sortOrder" ASC, a."name" ASC`,
        [userId]
      ),
    ]);

    return {
      user: {
        id: user!.id,
        name: user!.name,
        startDate: user!.startDate ? dateKeyVN(user!.startDate) : null,
      },
      hasProfile: profiles.has(userId),
      profile: profiles.get(userId) ?? DEFAULT_PAY_PROFILE,
      allowances,
    };
  }, "Pay profile read error");
}

function money(value: unknown, field: string, nullable = false): number | null {
  if (nullable && (value === null || value === undefined || value === "")) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_MONEY) {
    badRequest(`${field} không hợp lệ`);
  }
  return Math.round(amount);
}

/// Lưu hồ sơ lương và khoản hỗ trợ được hưởng. `allowances` là danh sách
/// { allowanceId, amount } — amount null/rỗng = theo mức mặc định của khoản.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  return handle(async () => {
    await requireAdmin();
    const { userId } = await params;
    const body = await req.json().catch(() => ({}));

    const user = await queryOne<{ id: string }>(
      `SELECT "id" FROM "User" WHERE "id" = $1 AND "role" = 'employee'`,
      [userId]
    );
    if (!user) notFound("Không tìm thấy nhân viên");

    const profile: PayProfile = {
      ...DEFAULT_PAY_PROFILE,
      payBasis: body?.payBasis ?? "gross",
      salaryType: body?.salaryType,
      baseSalary: money(body?.baseSalary, "Lương cơ bản")!,
      contractType: body?.contractType,
      probationPercent: Number(body?.probationPercent ?? 85),
      gender: body?.gender === "male" || body?.gender === "female" ? body.gender : null,
      dependents: Number(body?.dependents ?? 0),
      taxMode: body?.taxMode,
      hasInsurance: Boolean(body?.hasInsurance),
      insuranceSalary: money(body?.insuranceSalary, "Lương đóng bảo hiểm", true),
      annualLeave: Boolean(body?.annualLeave),
      leaveStartDate: String(body?.leaveStartDate ?? "").trim() || null,
      bankAccount: String(body?.bankAccount ?? "").trim().slice(0, 50) || null,
      bankName: String(body?.bankName ?? "").trim().slice(0, 100) || null,
    };
    if (!PAY_BASES.includes(profile.payBasis)) badRequest("Hình thức lương phải là GROSS hoặc NET");
    if (!SALARY_TYPES.includes(profile.salaryType)) badRequest("Kiểu lương không hợp lệ");
    // NET mà đóng BH thì phải có mức đóng cụ thể: BH tính trên gross, gross lại
    // suy ra từ BH, nên không lấy "theo lương cơ bản" (là số NET) được.
    if (profile.payBasis === "net" && profile.hasInsurance && profile.insuranceSalary === null) {
      badRequest("Lương NET có đóng bảo hiểm thì phải nhập lương đóng bảo hiểm");
    }
    if (!CONTRACT_TYPES.includes(profile.contractType)) badRequest("Loại hợp đồng không hợp lệ");
    if (!TAX_MODES.includes(profile.taxMode)) badRequest("Cách tính thuế không hợp lệ");
    if (
      !Number.isFinite(profile.probationPercent) ||
      profile.probationPercent <= 0 ||
      profile.probationPercent > 100
    ) {
      badRequest("Tỉ lệ lương thử việc phải trong khoảng 1 – 100%");
    }
    if (!Number.isInteger(profile.dependents) || profile.dependents < 0 || profile.dependents > 20) {
      badRequest("Số người phụ thuộc không hợp lệ");
    }
    if (profile.leaveStartDate && !isValidDateKey(profile.leaveStartDate)) {
      badRequest("Ngày bắt đầu tính phép không hợp lệ");
    }
    // Phép năm chỉ áp cho người có hợp đồng lao động, không áp cho CTV.
    if (profile.contractType === "collaborator") profile.annualLeave = false;

    const rawAllowances: unknown[] = Array.isArray(body?.allowances) ? body.allowances : [];
    const assigned = rawAllowances.map((item) => {
      const entry = item as { allowanceId?: unknown; amount?: unknown };
      return {
        allowanceId: String(entry.allowanceId ?? ""),
        amount: money(entry.amount, "Mức hỗ trợ", true),
      };
    });
    if (assigned.length > 0) {
      const known = await query<{ id: string }>(
        `SELECT "id" FROM "Allowance" WHERE "id" = ANY($1::text[])`,
        [assigned.map((item) => item.allowanceId)]
      );
      if (known.length !== new Set(assigned.map((item) => item.allowanceId)).size) {
        badRequest("Khoản hỗ trợ không tồn tại");
      }
    }

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO "PayProfile"
           ("userId", "salaryType", "baseSalary", "contractType", "probationPercent",
            "gender", "dependents", "taxMode", "hasInsurance", "insuranceSalary",
            "annualLeave", "leaveStartDate", "bankAccount", "bankName", "payBasis", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())
         ON CONFLICT ("userId") DO UPDATE SET
           "payBasis" = EXCLUDED."payBasis",
           "salaryType" = EXCLUDED."salaryType", "baseSalary" = EXCLUDED."baseSalary",
           "contractType" = EXCLUDED."contractType",
           "probationPercent" = EXCLUDED."probationPercent", "gender" = EXCLUDED."gender",
           "dependents" = EXCLUDED."dependents", "taxMode" = EXCLUDED."taxMode",
           "hasInsurance" = EXCLUDED."hasInsurance",
           "insuranceSalary" = EXCLUDED."insuranceSalary",
           "annualLeave" = EXCLUDED."annualLeave",
           "leaveStartDate" = EXCLUDED."leaveStartDate",
           "bankAccount" = EXCLUDED."bankAccount", "bankName" = EXCLUDED."bankName",
           "updatedAt" = now()`,
        [
          userId,
          profile.salaryType,
          profile.baseSalary,
          profile.contractType,
          profile.probationPercent,
          profile.gender,
          profile.dependents,
          profile.taxMode,
          profile.hasInsurance,
          profile.insuranceSalary,
          profile.annualLeave,
          profile.leaveStartDate,
          profile.bankAccount,
          profile.bankName,
          profile.payBasis,
        ]
      );
      await client.query(`DELETE FROM "EmployeeAllowance" WHERE "userId" = $1`, [userId]);
      for (const item of assigned) {
        await client.query(
          `INSERT INTO "EmployeeAllowance" ("userId", "allowanceId", "amount")
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [userId, item.allowanceId, item.amount]
        );
      }
    });

    return { profile, allowances: assigned };
  }, "Pay profile write error");
}
