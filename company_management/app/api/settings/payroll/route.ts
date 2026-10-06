import { queryOne } from "@/lib/db";
import { badRequest, handle, requireAdmin } from "@/lib/auth-guard";
import { getPayrollConfig } from "@/lib/payroll-service";
import { PayrollConfig, TaxBracket, validatePayrollConfig } from "@/lib/payroll";

/// Mức bảo hiểm, thuế, giảm trừ gia cảnh, biểu thuế và quy tắc phép năm.
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return { config: await getPayrollConfig() };
  }, "Payroll config read error");
}

export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const num = (value: unknown) => Number(value);
    const config: PayrollConfig = {
      insurance: {
        bhxh: num(body?.insurance?.bhxh),
        bhyt: num(body?.insurance?.bhyt),
        bhtn: num(body?.insurance?.bhtn),
      },
      flatTaxRate: num(body?.flatTaxRate),
      flatTaxThreshold: num(body?.flatTaxThreshold),
      personalDeduction: num(body?.personalDeduction),
      dependentDeduction: num(body?.dependentDeduction),
      taxBrackets: Array.isArray(body?.taxBrackets)
        ? body.taxBrackets.map((bracket: TaxBracket) => ({
            upTo: bracket?.upTo === null || bracket?.upTo === undefined || String(bracket.upTo) === ""
              ? null
              : num(bracket.upTo),
            rate: num(bracket?.rate),
          }))
        : [],
      annualLeave: {
        daysPerYear: num(body?.annualLeave?.daysPerYear),
        maxCarryYears: num(body?.annualLeave?.maxCarryYears),
        bonusEveryYears: num(body?.annualLeave?.bonusEveryYears),
      },
    };
    const error = validatePayrollConfig(config);
    if (error) badRequest(error);

    await queryOne(
      `INSERT INTO "Settings" ("id", "key", "value")
       VALUES ('cfg_payroll', 'payroll_config', $1)
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"
       RETURNING "key"`,
      [JSON.stringify(config)]
    );
    return { config };
  }, "Payroll config write error");
}
