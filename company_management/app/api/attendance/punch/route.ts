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
import {
  getAttendancePolicy,
  PRESENCE_LOCK_MINUTES,
  PRESENCE_MAX_FAILURES,
  rejectsOutsideRadius,
  verifyPresenceCode,
} from "@/lib/presence";
import {
  ipUsedByOthers,
  logPunchAttempt,
  LOW_ACCURACY_METERS,
  PunchFlag,
  recentPresenceFailures,
} from "@/lib/punch-audit";
import { AttendancePunchRow, WorkLocationRow } from "@/lib/types";

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/// Một lần bấm giờ. `type` = "in" | "out".
///
/// Lớp chặn theo chính sách chấm công (trang Bảo mật):
/// - Mã có mặt (nếu bật): phải nhập đúng mã đang hiện trên màn hình ở văn phòng.
/// - GPS: ngoài bán kính thì từ chối, hoặc — khi đã bắt mã có mặt và admin
///   chọn "gắn cờ" — vẫn nhận nhưng đánh dấu để admin xem lại.
/// Mọi lần bấm, nhận hay bị từ chối, đều ghi vào PunchAttempt kèm IP.
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireEmployee();
    const body = await req.json().catch(() => ({}));
    const type = body?.type;
    const latitude = optionalNumber(body?.latitude);
    const longitude = optionalNumber(body?.longitude);
    const accuracy = optionalNumber(body?.accuracy);
    const presenceCode = String(body?.presenceCode ?? "").trim();

    if (type !== "in" && type !== "out") {
      badRequest("Loại chấm công không hợp lệ");
    }

    const flags: PunchFlag[] = [];
    const attempt = {
      userId: session.userId,
      type,
      latitude,
      longitude,
      accuracy,
      distance: null as number | null,
      locationId: null as string | null,
    };
    async function reject(reason: string, message: string): Promise<never> {
      await logPunchAttempt(req, { ...attempt, result: "rejected", reason, flags });
      badRequest(message);
    }

    const policy = await getAttendancePolicy();

    if (policy.presenceCode) {
      if ((await recentPresenceFailures(session.userId)) >= PRESENCE_MAX_FAILURES) {
        await reject(
          "presence_locked",
          `Bạn đã nhập sai mã có mặt quá nhiều lần. Thử lại sau ${PRESENCE_LOCK_MINUTES} phút.`
        );
      }
      if (!presenceCode) {
        badRequest("Vui lòng nhập mã có mặt đang hiện trên màn hình ở văn phòng");
      }
      if (!(await verifyPresenceCode(presenceCode))) {
        await reject(
          "presence_code",
          "Mã có mặt không đúng hoặc đã đổi. Nhìn lại màn hình ở văn phòng và nhập mã đang hiện."
        );
      }
    }

    const strictGps = rejectsOutsideRadius(policy);
    let withinRadius = false;

    if (latitude === null || longitude === null) {
      if (strictGps) await reject("no_location", "Không lấy được vị trí của bạn");
      flags.push("no_location");
    } else {
      const locations = await query<WorkLocationRow>(
        `SELECT "id", "name", "latitude", "longitude", "radius"
           FROM "WorkLocation" WHERE "isActive" = true`
      );

      if (locations.length === 0 && strictGps) {
        await reject(
          "no_work_location",
          "Công ty chưa khai báo vị trí làm việc. Liên hệ quản trị viên trước khi chấm công."
        );
      }

      const nearest = resolveNearestLocation(latitude, longitude, locations);
      attempt.distance = nearest.distance;
      attempt.locationId = nearest.locationId;
      withinRadius = nearest.withinRadius;
      if (!nearest.withinRadius) {
        if (strictGps) {
          await reject(
            "outside_radius",
            nearest.locationName
              ? `Bạn đang cách ${nearest.locationName} khoảng ${formatDistance(nearest.distance)}, vượt quá bán kính cho phép.`
              : "Bạn đang ở ngoài bán kính cho phép."
          );
        }
        flags.push("outside_radius");
      }
      if (accuracy === null) flags.push("no_accuracy");
      else if (accuracy > LOW_ACCURACY_METERS) flags.push("low_accuracy");
    }

    if (await ipUsedByOthers(clientIp(req), session.userId)) flags.push("shared_ip");

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
      await reject(
        "already_checked_in",
        "Hôm nay bạn đã check-in rồi, mỗi ngày chỉ check-in một lần."
      );
    }
    if (type === "out" && !checkIn) {
      await reject("not_checked_in", "Bạn chưa check-in nên không thể check-out.");
    }

    // withinRadius = false khi được nhận kèm cờ ngoài bán kính: ngày công đó
    // tự rơi vào diện "cần xem lại" ở bảng chấm công.
    await queryOne(
      `INSERT INTO "AttendancePunch"
         ("attendanceId", "type", "at", "latitude", "longitude", "distance",
          "locationId", "withinRadius")
       VALUES ($1, $2, now(), $3, $4, $5, $6, $7)
       RETURNING "id"`,
      [
        attendance!.id,
        type,
        latitude,
        longitude,
        attempt.distance,
        attempt.locationId,
        withinRadius,
      ]
    );
    await logPunchAttempt(req, { ...attempt, result: "accepted", flags });

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
