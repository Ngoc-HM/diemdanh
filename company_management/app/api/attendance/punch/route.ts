import { query, queryOne } from "@/lib/db";
import { badRequest, handle, requireEmployee } from "@/lib/auth-guard";
import { resolveNearestLocation, formatDistance } from "@/lib/utils";
import { dateKeyVN } from "@/lib/datetime";
import { evaluateDay } from "@/lib/attendance-rules";
import {
  applyDayMark,
  getActiveSessionRules,
  getDayMarks,
  getLunchBreak,
  resolveUserMonthSchedule,
} from "@/lib/attendance-service";
import { AttendancePunchRow, WorkLocationRow } from "@/lib/types";

/// Một lần bấm giờ. `type` = "in" | "out".
/// Vị trí bắt buộc nằm trong bán kính của một vị trí làm việc đang bật;
/// sai vị trí thì từ chối, nhân viên phải nhờ admin bổ sung công thủ công.
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireEmployee();
    const body = await req.json().catch(() => ({}));
    const type = body?.type;
    const latitude = Number(body?.latitude);
    const longitude = Number(body?.longitude);

    if (type !== "in" && type !== "out") {
      badRequest("Loại chấm công không hợp lệ");
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      badRequest("Không lấy được vị trí của bạn");
    }

    const locations = await query<WorkLocationRow>(
      `SELECT "id", "name", "latitude", "longitude", "radius"
         FROM "WorkLocation" WHERE "isActive" = true`
    );

    if (locations.length === 0) {
      badRequest(
        "Công ty chưa khai báo vị trí làm việc. Liên hệ quản trị viên trước khi chấm công."
      );
    }

    const nearest = resolveNearestLocation(latitude, longitude, locations);
    if (!nearest.withinRadius) {
      badRequest(
        `Bạn đang cách ${nearest.locationName} khoảng ${formatDistance(nearest.distance)}, vượt quá bán kính cho phép.`
      );
    }

    const today = dateKeyVN();

    // Tạo ngày công nếu chưa có; ON CONFLICT ... DO UPDATE để luôn có RETURNING.
    const attendance = await queryOne<{ id: string }>(
      `INSERT INTO "Attendance" ("userId", "date") VALUES ($1, $2)
       ON CONFLICT ("userId", "date") DO UPDATE SET "userId" = EXCLUDED."userId"
       RETURNING "id"`,
      [session.userId, today]
    );

    // Mỗi ngày chỉ được check-in một lần. Check-out thì bấm bao nhiêu lần
    // cũng được, không giới hạn giờ; giờ ra lấy theo lần muộn nhất.
    const checkIn = await queryOne<{ at: Date }>(
      `SELECT "at" FROM "AttendancePunch"
        WHERE "attendanceId" = $1 AND "type" = 'in' ORDER BY "at" ASC LIMIT 1`,
      [attendance!.id]
    );

    if (type === "in" && checkIn) {
      badRequest("Hôm nay bạn đã check-in rồi, mỗi ngày chỉ check-in một lần.");
    }
    if (type === "out" && !checkIn) {
      badRequest("Bạn chưa check-in nên không thể check-out.");
    }

    await queryOne(
      `INSERT INTO "AttendancePunch"
         ("attendanceId", "type", "at", "latitude", "longitude", "distance",
          "locationId", "withinRadius")
       VALUES ($1, $2, now(), $3, $4, $5, $6, true)
       RETURNING "id"`,
      [
        attendance!.id,
        type,
        latitude,
        longitude,
        nearest.distance,
        nearest.locationId,
      ]
    );

    const [punches, rules, user, lunchBreak] = await Promise.all([
      query<AttendancePunchRow>(
        `SELECT "id", "type", "at", "distance", "isManual", "withinRadius"
           FROM "AttendancePunch" WHERE "attendanceId" = $1 ORDER BY "at" ASC`,
        [attendance!.id]
      ),
      getActiveSessionRules(),
      queryOne<{ id: string; employmentType: string }>(
        `SELECT "id", "employmentType" FROM "User" WHERE "id" = $1`,
        [session.userId]
      ),
      getLunchBreak(),
    ]);

    const schedule = await resolveUserMonthSchedule(
      user!,
      today.slice(0, 7),
      rules
    );
    const holiday = await queryOne<{ name: string }>(
      `SELECT "name" FROM "Holiday"
        WHERE "startDate" <= $1 AND "endDate" >= $1 LIMIT 1`,
      [today]
    );

    // Ngày admin đã đánh dấu nghỉ/ốm hoặc đổi ca phải được áp ở đây luôn, nếu
    // không kết quả trả về ngay sau khi bấm giờ sẽ lệch với bảng công.
    const mark = (await getDayMarks([session.userId], today, today)).get(
      `${session.userId}|${today}`
    );
    const ruleById = new Map(rules.map((rule) => [rule.id, rule]));

    const evaluation = evaluateDay({
      scheduled: applyDayMark(schedule.get(today) ?? [], mark, ruleById),
      punches,
      isHoliday: Boolean(holiday),
      leaveCode: mark?.leaveCode ?? null,
      lunchBreak,
    });

    return {
      attendance: {
        date: today,
        punches: punches.map((punch) => ({
          id: punch.id,
          type: punch.type,
          at: punch.at.toISOString(),
          distance: punch.distance,
          isManual: punch.isManual,
        })),
      },
      evaluation: {
        status: evaluation.status,
        codes: evaluation.codes,
        workedMinutes: evaluation.workedMinutes,
        requiredMinutes: evaluation.requiredMinutes,
      },
    };
  }, "Punch error");
}
