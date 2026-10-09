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
import { clientIp } from "@/lib/request-meta";
import { findMatchingCidr } from "@/lib/ip-match";
import { getPunchNetwork } from "@/lib/ip-policy";
import {
  ipUsedByOthers,
  logPunchAttempt,
  LOW_ACCURACY_METERS,
  PunchFlag,
} from "@/lib/punch-audit";
import { AttendancePunchRow, WorkLocationRow } from "@/lib/types";

/// Một lần bấm giờ. `type` = "in" | "out".
/// Vị trí bắt buộc nằm trong bán kính của một vị trí làm việc đang bật;
/// sai vị trí thì từ chối, nhân viên phải nhờ admin bổ sung công thủ công.
/// Mọi lần bấm, nhận hay bị từ chối, đều ghi vào PunchAttempt kèm IP và cờ
/// bất thường để admin soi lại ở trang Bảo mật.
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireEmployee();
    const body = await req.json().catch(() => ({}));
    const type = body?.type;
    const latitude = Number(body?.latitude);
    const longitude = Number(body?.longitude);
    const rawAccuracy = Number(body?.accuracy);
    const accuracy =
      body?.accuracy == null || !Number.isFinite(rawAccuracy)
        ? null
        : rawAccuracy;

    if (type !== "in" && type !== "out") {
      badRequest("Loại chấm công không hợp lệ");
    }

    const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);
    const flags: PunchFlag[] = [];
    const attempt = {
      userId: session.userId,
      type,
      latitude: hasLocation ? latitude : null,
      longitude: hasLocation ? longitude : null,
      accuracy,
      distance: null as number | null,
      locationId: null as string | null,
    };
    async function reject(reason: string, message: string): Promise<never> {
      await logPunchAttempt(req, {
        ...attempt,
        result: "rejected",
        reason,
        flags,
      });
      badRequest(message);
    }

    // Chỉ nhận chấm công từ mạng văn phòng (dải IP admin khai ở trang Bảo
    // mật). Không xác định được IP thì cũng từ chối: thà chặn nhầm còn hơn lọt.
    const network = await getPunchNetwork();
    if (network.enabled && !findMatchingCidr(clientIp(req), network.ranges)) {
      await reject(
        "outside_network",
        "Chỉ chấm công được khi máy tính đang dùng mạng của văn phòng."
      );
    }

    if (!hasLocation)
      await reject("no_location", "Không lấy được vị trí của bạn");

    const locations = await query<WorkLocationRow>(
      `SELECT "id", "name", "latitude", "longitude", "radius"
         FROM "WorkLocation" WHERE "isActive" = true`,
    );

    if (locations.length === 0) {
      await reject(
        "no_work_location",
        "Công ty chưa khai báo vị trí làm việc. Liên hệ quản trị viên trước khi chấm công.",
      );
    }

    const nearest = resolveNearestLocation(latitude, longitude, locations);
    attempt.distance = nearest.distance;
    attempt.locationId = nearest.locationId;
    if (accuracy === null) flags.push("no_accuracy");
    else if (accuracy > LOW_ACCURACY_METERS) flags.push("low_accuracy");

    if (!nearest.withinRadius) {
      await reject(
        "outside_radius",
        `Bạn đang cách ${nearest.locationName} khoảng ${formatDistance(nearest.distance)}, vượt quá bán kính cho phép.`,
      );
    }

    if (await ipUsedByOthers(clientIp(req), session.userId))
      flags.push("shared_ip");

    const today = dateKeyVN();

    // Tạo ngày công nếu chưa có; ON CONFLICT ... DO UPDATE để luôn có RETURNING.
    const attendance = await queryOne<{ id: string }>(
      `INSERT INTO "Attendance" ("userId", "date") VALUES ($1, $2)
       ON CONFLICT ("userId", "date") DO UPDATE SET "userId" = EXCLUDED."userId"
       RETURNING "id"`,
      [session.userId, today],
    );

    // Mỗi ngày chỉ được check-in một lần. Check-out thì bấm bao nhiêu lần
    // cũng được, không giới hạn giờ; giờ ra lấy theo lần muộn nhất.
    const checkIn = await queryOne<{ at: Date }>(
      `SELECT "at" FROM "AttendancePunch"
        WHERE "attendanceId" = $1 AND "type" = 'in' ORDER BY "at" ASC LIMIT 1`,
      [attendance!.id],
    );

    if (type === "in" && checkIn) {
      await reject(
        "already_checked_in",
        "Hôm nay bạn đã check-in rồi, mỗi ngày chỉ check-in một lần.",
      );
    }
    if (type === "out" && !checkIn) {
      await reject(
        "not_checked_in",
        "Bạn chưa check-in nên không thể check-out.",
      );
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
        attempt.distance,
        attempt.locationId,
      ],
    );
    await logPunchAttempt(req, { ...attempt, result: "accepted", flags });

    const [punches, rules, user, lunchBreak] = await Promise.all([
      query<AttendancePunchRow>(
        `SELECT "id", "type", "at", "distance", "isManual", "withinRadius"
           FROM "AttendancePunch" WHERE "attendanceId" = $1 ORDER BY "at" ASC`,
        [attendance!.id],
      ),
      getActiveSessionRules(),
      queryOne<{ id: string; employmentType: string }>(
        `SELECT "id", "employmentType" FROM "User" WHERE "id" = $1`,
        [session.userId],
      ),
      getLunchBreak(),
    ]);

    const schedule = await resolveUserMonthSchedule(
      user!,
      today.slice(0, 7),
      rules,
    );
    const holiday = await queryOne<{ name: string }>(
      `SELECT "name" FROM "Holiday"
        WHERE "startDate" <= $1 AND "endDate" >= $1 LIMIT 1`,
      [today],
    );

    // Ngày admin đã đánh dấu nghỉ/ốm hoặc đổi ca phải được áp ở đây luôn, nếu
    // không kết quả trả về ngay sau khi bấm giờ sẽ lệch với bảng công.
    const mark = (await getDayMarks([session.userId], today, today)).get(
      `${session.userId}|${today}`,
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
