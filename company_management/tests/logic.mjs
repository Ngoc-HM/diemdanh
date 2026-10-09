import {
  openRegistrationMonth,
  isRegistrationOpen,
  registrationWindow,
  fullTimeWorkingDates,
  isSelfScheduled,
  standardWorkdays,
  isRestDayFor,
  DEFAULT_REGISTRATION_WINDOW,
  parseRegistrationWindow,
  validateRegistrationWindow,
} from "../lib/schedule.ts";
import { evaluateDay, pairPunches, parseLunchBreak } from "../lib/attendance-rules.ts";
import { accountingCellLabel } from "../lib/attendance-export.ts";
import {
  computeOvertimeMinutes,
  overtimeDayType,
  overtimeRate,
  parseOvertimeConfig,
  validateOvertimeConfig,
  validatePlannedTimes,
  DEFAULT_OVERTIME_CONFIG,
} from "../lib/overtime.ts";
import {
  annualLeaveForMonth,
  computePayroll,
  DEFAULT_PAY_PROFILE,
  parsePayrollConfig,
  progressiveTax,
  validatePayrollConfig,
} from "../lib/payroll.ts";
import { vnDateTimeToUtc, weekdayLabel, daysInMonth, addMonths, parseTimeToMinutes } from "../lib/datetime.ts";
import {
  formatDuration,
  parseEntryTime,
  validateBoundary,
  validateContent,
} from "../lib/work-reports.ts";

import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  otpauthUrl,
  totp,
  verifyTotp,
} from "../lib/totp.ts";
import { summarizeUserAgent } from "../lib/security-labels.ts";
import {
  attendanceEditNotice,
  composeNoticeEmail,
  dayMarkNotice,
  dayReviewNotice,
  describePunches,
  formatDateWithWeekday,
  overtimeNotice,
  shiftRequestNotice,
} from "../lib/employee-notice.ts";

let pass = 0, fail = 0;
const bad = [];
function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; bad.push(`${name} ${detail}`); console.log(`  FAIL ${name} ${detail}`); }
}

// Mốc thời gian giả, tính theo giờ VN (UTC+7).
const at = (dateKey, time = "12:00") => vnDateTimeToUtc(dateKey, time);

console.log("\n== cửa sổ đăng ký lịch (mặc định 20 → hết tháng) ==");
const std = DEFAULT_REGISTRATION_WINDOW;
check("ngày 19/08 chưa mở", openRegistrationMonth(std, at("2026-08-19")) === null);
check("ngày 20/08 mở cho tháng 9", openRegistrationMonth(std, at("2026-08-20")) === "2026-09");
check("ngày 31/08 vẫn mở cho tháng 9", openRegistrationMonth(std, at("2026-08-31", "23:59")) === "2026-09");
check("ngày 01/09 đóng lại", openRegistrationMonth(std, at("2026-09-01")) === null);
check("ngày 20/12 mở cho tháng 1 năm sau", openRegistrationMonth(std, at("2026-12-20")) === "2027-01");
check("đúng tháng thì mở", isRegistrationOpen("2026-09", std, at("2026-08-25")) === true);
check("sai tháng thì đóng", isRegistrationOpen("2026-10", std, at("2026-08-25")) === false);
check("không đăng ký lùi tháng cũ", isRegistrationOpen("2026-08", std, at("2026-08-25")) === false);

const w = registrationWindow("2026-03", std);
check("cửa sổ tháng 3 = 20/02–28/02", w.opensOn === "2026-02-20" && w.closesOn === "2026-02-28", JSON.stringify(w));
const wLeap = registrationWindow("2024-03", std);
check("năm nhuận: 20/02–29/02", wLeap.closesOn === "2024-02-29", JSON.stringify(wLeap));

console.log("\n== cửa sổ đăng ký do admin đặt ==");
const shortWin = { openDay: 5, closeDay: 10 };
check("04/08 chưa tới ngày mở", openRegistrationMonth(shortWin, at("2026-08-04")) === null);
check("05/08 mở", openRegistrationMonth(shortWin, at("2026-08-05")) === "2026-09");
check("10/08 vẫn còn hạn", openRegistrationMonth(shortWin, at("2026-08-10", "23:59")) === "2026-09");
check("11/08 đã đóng dù còn trong tháng", openRegistrationMonth(shortWin, at("2026-08-11")) === null);
const shortWindow = registrationWindow("2026-09", shortWin);
check("cửa sổ 05/08–10/08", shortWindow.opensOn === "2026-08-05" && shortWindow.closesOn === "2026-08-10", JSON.stringify(shortWindow));

const lastDay = { openDay: 31, closeDay: 31 };
check("đặt ngày 31 thì tháng 2 lùi về 28", openRegistrationMonth(lastDay, at("2026-02-28")) === "2026-03");
check("tháng 2 ngày 27 chưa mở", openRegistrationMonth(lastDay, at("2026-02-27")) === null);
const febWindow = registrationWindow("2026-03", lastDay);
check("cửa sổ hiện đúng 28/02", febWindow.opensOn === "2026-02-28" && febWindow.closesOn === "2026-02-28", JSON.stringify(febWindow));
const oneDay = { openDay: 15, closeDay: 15 };
check("mở đúng một ngày", openRegistrationMonth(oneDay, at("2026-08-15")) === "2026-09" && openRegistrationMonth(oneDay, at("2026-08-16")) === null);

check('đọc "20-25" từ Settings', JSON.stringify(parseRegistrationWindow("20-25")) === JSON.stringify({ openDay: 20, closeDay: 25 }));
check("giá trị rỗng dùng mặc định", JSON.stringify(parseRegistrationWindow("")) === JSON.stringify(std));
check("giá trị hỏng dùng mặc định", JSON.stringify(parseRegistrationWindow("hai mươi")) === JSON.stringify(std));
check("ngày đóng trước ngày mở thì bỏ, dùng mặc định", JSON.stringify(parseRegistrationWindow("25-20")) === JSON.stringify(std));

check("ngày 0 không hợp lệ", validateRegistrationWindow({ openDay: 0, closeDay: 10 }) !== null);
check("ngày 32 không hợp lệ", validateRegistrationWindow({ openDay: 1, closeDay: 32 }) !== null);
check("số lẻ không hợp lệ", validateRegistrationWindow({ openDay: 1.5, closeDay: 10 }) !== null);
check("đóng trước mở bị chặn", (validateRegistrationWindow({ openDay: 10, closeDay: 5 }) ?? "").includes("Ngày đóng"));
check("1 → 31 hợp lệ", validateRegistrationWindow({ openDay: 1, closeDay: 31 }) === null);

console.log("\n== loại hợp đồng ==");
check("part_time tự đăng ký", isSelfScheduled("part_time"));
check("intern tự đăng ký", isSelfScheduled("intern"));
check("full_time không tự đăng ký", !isSelfScheduled("full_time"));

console.log("\n== lịch cố định full-time ==");
const sep = fullTimeWorkingDates("2026-09");
check("tháng 9/2026 có 22 ngày T2–T6", sep.length === 22, `(${sep.length})`);
check("không có thứ 7", !sep.some((d) => weekdayLabel(d) === "T7"));
check("không có chủ nhật", !sep.some((d) => weekdayLabel(d) === "CN"));
check("tháng 2/2024 nhuận có 29 ngày", daysInMonth("2024-02") === 29);
check("qua năm: 2026-12 + 1 = 2027-01", addMonths("2026-12", 1) === "2027-01");
check("lùi năm: 2026-01 - 1 = 2025-12", addMonths("2026-01", -1) === "2025-12");

console.log("\n== giờ vào/ra: 1 lần vào, nhiều lần ra ==");
const twoOuts = pairPunches([
  { type: "in", at: at("2026-09-01", "08:00"), withinRadius: true },
  { type: "out", at: at("2026-09-01", "12:00"), withinRadius: true },
  { type: "out", at: at("2026-09-01", "17:00"), withinRadius: true },
]);
check("ra 2 lần: tính theo lần muộn nhất = 9h", twoOuts.workedMinutes === 540, `(${twoOuts.workedMinutes}p)`);
check("giờ ra là lần bấm muộn nhất", twoOuts.lastOut.getTime() === at("2026-09-01", "17:00").getTime());
check("không đặt giờ nghỉ trưa thì không trừ gì", twoOuts.workedMinutes === 540 && twoOuts.lunchMinutes === 0);
const manyOuts = pairPunches([
  { type: "in", at: at("2026-09-01", "08:00"), withinRadius: true },
  { type: "out", at: at("2026-09-01", "11:00"), withinRadius: true },
  { type: "out", at: at("2026-09-01", "14:00"), withinRadius: true },
  { type: "out", at: at("2026-09-01", "18:30"), withinRadius: true },
]);
check("ra 3 lần vẫn lấy lần cuối = 10.5h", manyOuts.workedMinutes === 630, `(${manyOuts.workedMinutes}p)`);
const openShift = pairPunches([{ type: "in", at: at("2026-09-01", "08:00"), withinRadius: true }]);
check("chỉ có vào, chưa ra -> ca đang mở", openShift.openSince !== null && openShift.workedMinutes === 0);
const dupIn = pairPunches([
  { type: "in", at: at("2026-09-01", "08:00"), withinRadius: true },
  { type: "in", at: at("2026-09-01", "09:00"), withinRadius: true },
  { type: "out", at: at("2026-09-01", "17:00"), withinRadius: true },
]);
check("vào 2 lần (admin nhập tay): giữ lần sớm nhất = 9h", dupIn.workedMinutes === 540, `(${dupIn.workedMinutes}p)`);
const orphanOut = pairPunches([{ type: "out", at: at("2026-09-01", "17:00"), withinRadius: true }]);
check("chỉ có ra, không có vào = 0h", orphanOut.workedMinutes === 0);
const outBeforeIn = pairPunches([
  { type: "out", at: at("2026-09-01", "07:00"), withinRadius: true },
  { type: "in", at: at("2026-09-01", "08:00"), withinRadius: true },
]);
check("lần ra trước giờ vào không hợp lệ -> vẫn là ca mở", outBeforeIn.openSince !== null && outBeforeIn.workedMinutes === 0);
const unsorted = pairPunches([
  { type: "out", at: at("2026-09-01", "17:00"), withinRadius: true },
  { type: "in", at: at("2026-09-01", "08:00"), withinRadius: true },
]);
check("tự sắp xếp theo thời gian = 9h", unsorted.workedMinutes === 540, `(${unsorted.workedMinutes}p)`);

console.log("\n== xếp loại ngày công ==");
const ca = { id: "s1", code: "HC", name: "Hành chính", workStart: "08:00",
  workEnd: "17:00", minHours: 8, workdayValue: 1, sortOrder: 1, isDefaultFull: true };
const day = (punches, extra = {}) =>
  evaluateDay({ scheduled: [ca], punches, ...extra });

check("đủ giờ, đúng giờ = passed",
  day([{ type: "in", at: at("2026-09-01", "08:00"), withinRadius: true },
       { type: "out", at: at("2026-09-01", "17:00"), withinRadius: true }]).status === "passed");
check("muộn 4 phút vẫn passed (châm chước 5p)",
  day([{ type: "in", at: at("2026-09-01", "08:04"), withinRadius: true },
       { type: "out", at: at("2026-09-01", "17:04"), withinRadius: true }]).status === "passed");
const late = day([{ type: "in", at: at("2026-09-01", "08:30"), withinRadius: true },
                  { type: "out", at: at("2026-09-01", "17:30"), withinRadius: true }]);
check("muộn 30 phút = late", late.status === "late", `(${late.status})`);
check("tính đúng 25 phút muộn (30 - 5 châm chước)", late.lateMinutes === 25, `(${late.lateMinutes})`);
const short = day([{ type: "in", at: at("2026-09-01", "08:00"), withinRadius: true },
                   { type: "out", at: at("2026-09-01", "15:00"), withinRadius: true }]);
check("thiếu giờ = insufficient", short.status === "insufficient", `(${short.status})`);
check("thiếu đúng 60 phút", short.missingMinutes === 60, `(${short.missingMinutes})`);
check("có lịch, không chấm = absent", day([]).status === "absent");
check("hôm nay đã vào, chưa ra = open",
  day([{ type: "in", at: at("2026-09-01", "08:00"), withinRadius: true }]).status === "open");
check("ngày đã qua mà không có giờ ra = missed_out",
  day([{ type: "in", at: at("2026-09-01", "08:00"), withinRadius: true }], { isPast: true }).status === "missed_out");
const missed = day([{ type: "in", at: at("2026-09-01", "08:00"), withinRadius: true }], { isPast: true });
check("quên checkout không tính giờ công", missed.workedMinutes === 0, `(${missed.workedMinutes}p)`);
check("quên checkout bị tính thiếu đủ ca", missed.missingMinutes === 480, `(${missed.missingMinutes})`);
check("quên checkout không phải ngày công hợp lệ",
  !["passed", "late"].includes(missed.status));
check("đăng ký nghỉ N = leave", day([], { leaveCode: "N" }).status === "leave");
check("admin chấm ốm O = sick", day([], { leaveCode: "O" }).status === "sick");
check("ngày nghỉ không đòi giờ công", day([], { leaveCode: "N" }).missingMinutes === 0);
check("ngày nghỉ không yêu cầu ca", day([], { leaveCode: "N" }).requiredMinutes === 0);
check("ngày ốm không phải ngày công hợp lệ",
  !["passed", "late"].includes(day([], { leaveCode: "O" }).status));
check("nghỉ đè lên cả trạng thái vắng",
  day([], { leaveCode: "N", isPast: true }).status === "leave");
check("ngày lễ không chấm = holiday", day([], { isHoliday: true }).status === "holiday");
check("ngày lễ không bị tính thiếu công", day([], { isHoliday: true }).missingMinutes === 0);
check("không lịch, không chấm = off",
  evaluateDay({ scheduled: [], punches: [] }).status === "off");
const unscheduled = evaluateDay({ scheduled: [], punches: [
    { type: "in", at: at("2026-09-01", "08:00"), withinRadius: true },
    { type: "out", at: at("2026-09-01", "17:00"), withinRadius: true }] });
check("không lịch mà có chấm = unscheduled", unscheduled.status === "unscheduled");
check("quên đăng ký nhưng vào ra đủ vẫn tính ngày công", unscheduled.countsAsWorkDay === true && unscheduled.workedMinutes === 540);
check("ngoài lịch mà chỉ có giờ vào thì chưa tính công",
  evaluateDay({ scheduled: [], punches: [
    { type: "in", at: at("2026-09-01", "08:00"), withinRadius: true }] }).countsAsWorkDay === false);
check("ngoài lịch mà chỉ có giờ ra mồ côi thì không tính công",
  evaluateDay({ scheduled: [], punches: [
    { type: "out", at: at("2026-09-01", "17:00"), withinRadius: true }] }).countsAsWorkDay === false);
check("đủ công là ngày công", day([{ type: "in", at: at("2026-09-01", "08:00"), withinRadius: true },
       { type: "out", at: at("2026-09-01", "17:00"), withinRadius: true }]).countsAsWorkDay === true);
check("đi muộn vẫn là ngày công", late.countsAsWorkDay === true);
check("thiếu giờ vẫn tính đủ công khi admin chưa xem", short.workdayValue === 1 && short.countsAsWorkDay === true, `(${short.workdayValue})`);
check("thiếu giờ được đánh dấu chờ xem lại", short.needsReview === true);
check("vắng không phải ngày công", day([]).countsAsWorkDay === false);
check("nghỉ N không phải ngày công", day([], { leaveCode: "N" }).countsAsWorkDay === false);
check("phát hiện bấm giờ ngoài bán kính",
  day([{ type: "in", at: at("2026-09-01", "08:00"), withinRadius: false },
       { type: "out", at: at("2026-09-01", "17:00"), withinRadius: true }]).outsideRadius === true);

const sang = { ...ca, id: "s2", code: "S", workStart: "08:00", workEnd: "12:00", minHours: 4, workdayValue: 0.5, sortOrder: 1 };
const chieu = { ...ca, id: "s3", code: "C", workStart: "13:00", workEnd: "17:00", minHours: 4, workdayValue: 0.5, sortOrder: 2 };
const both = evaluateDay({ scheduled: [sang, chieu], punches: [
  { type: "in", at: at("2026-09-01", "08:00"), withinRadius: true },
  { type: "out", at: at("2026-09-01", "12:00"), withinRadius: true },
  { type: "out", at: at("2026-09-01", "17:00"), withinRadius: true }] });
check("part-time 2 ca: vào 08:00 ra muộn nhất 17:00 = passed", both.status === "passed", `(${both.status})`);
check("part-time 2 ca hiện mã S+C", both.codes.join("+") === "S+C", `(${both.codes})`);
const onlyMorning = evaluateDay({ scheduled: [sang, chieu], punches: [
  { type: "in", at: at("2026-09-01", "08:00"), withinRadius: true },
  { type: "out", at: at("2026-09-01", "12:00"), withinRadius: true }] });
check("đăng ký 2 ca chỉ làm 1 = thiếu giờ", onlyMorning.status === "insufficient", `(${onlyMorning.status})`);

console.log("\n== số công (x / x/2) ==");
const punchDay = (from, to, date = "2026-09-01") => [
  { type: "in", at: at(date, from), withinRadius: true },
  { type: "out", at: at(date, to), withinRadius: true }];
check("ca CN đủ giờ = 1 công", day(punchDay("08:00", "17:00")).workdayValue === 1);
check("S + C đủ giờ = 0,5 + 0,5 = 1 công", both.workdayValue === 1, `(${both.workdayValue})`);
const morningOnly = evaluateDay({ scheduled: [sang], punches: punchDay("08:00", "12:00") });
check("chỉ ca S đủ giờ = 0,5 công (x/2)", morningOnly.workdayValue === 0.5, `(${morningOnly.workdayValue})`);
const tangCa = { ...ca, id: "s5", code: "T", workStart: "18:00", workEnd: "21:00", minHours: 2.5, workdayValue: 0 };
check("ca tăng ca (số công 0) không cộng ngày công",
  evaluateDay({ scheduled: [tangCa], punches: punchDay("18:00", "21:00") }).workdayValue === 0);
check("đi muộn vẫn đủ số công của ca", late.workdayValue === 1);
const shortCounted = day(punchDay("08:00", "15:00"), { reviewDecision: "count" });
check("admin duyệt tính công: 1 công, hết chờ xem", shortCounted.workdayValue === 1 && shortCounted.needsReview === false);
const shortExcluded = day(punchDay("08:00", "15:00"), { reviewDecision: "exclude" });
check("admin chọn không tính: 0 công", shortExcluded.workdayValue === 0 && shortExcluded.countsAsWorkDay === false && shortExcluded.needsReview === false);
check("quyết định xem lại không áp cho ngày đủ giờ",
  day(punchDay("08:00", "17:00"), { reviewDecision: "exclude" }).workdayValue === 1);
check("vắng = 0 công", day([]).workdayValue === 0);
check("nghỉ N = 0 công (phép năm tính riêng ở bảng lương)", day([], { leaveCode: "N" }).workdayValue === 0);
check("ốm O = 0 công", day([], { leaveCode: "O" }).workdayValue === 0);
check("nghỉ lễ có lịch vẫn được tính công", day([], { isHoliday: true }).workdayValue === 1);
check("nghỉ lễ không có lịch thì không có công",
  evaluateDay({ scheduled: [], punches: [], isHoliday: true }).workdayValue === 0);
check("quên checkout = 0 công", missed.workdayValue === 0);
const unscheduledFull = evaluateDay({ scheduled: [], punches: punchDay("08:00", "17:00"), fullDayMinutes: 420 });
check("ngoài lịch đủ ngưỡng cả ngày = 1 công", unscheduledFull.workdayValue === 1, `(${unscheduledFull.workdayValue})`);
const unscheduledHalf = evaluateDay({ scheduled: [], punches: punchDay("08:00", "12:00"), fullDayMinutes: 420 });
check("ngoài lịch nửa buổi = 0,5 công", unscheduledHalf.workdayValue === 0.5, `(${unscheduledHalf.workdayValue})`);
check("full-time đi làm ngày nghỉ không có lịch = 0 công (phải làm phiếu OT)",
  evaluateDay({ scheduled: [], punches: punchDay("08:00", "17:00"), isRestDay: true }).workdayValue === 0);

console.log("\n== ngày công tháng ==");
check("tháng 9/2026 nghỉ T7+CN = 22 ngày công tháng", standardWorkdays("2026-09", [0, 6]) === 22, `(${standardWorkdays("2026-09", [0, 6])})`);
check("tháng 2/2026 nghỉ T7+CN = 20", standardWorkdays("2026-02", [0, 6]) === 20, `(${standardWorkdays("2026-02", [0, 6])})`);
check("chỉ nghỉ CN thì tháng 9/2026 = 26", standardWorkdays("2026-09", [0]) === 26, `(${standardWorkdays("2026-09", [0])})`);
check("full-time: thứ 7 là ngày nghỉ", isRestDayFor("full_time", "2026-09-05", [0, 6], false) === true);
check("full-time: ngày lễ là ngày nghỉ", isRestDayFor("full_time", "2026-09-02", [0, 6], true) === true);
check("full-time: thứ 3 thường là ngày làm", isRestDayFor("full_time", "2026-09-01", [0, 6], false) === false);
check("part-time tự đăng ký nên thứ 7 không phải ngày nghỉ", isRestDayFor("part_time", "2026-09-05", [0, 6], false) === false);

console.log("\n== làm thêm giờ (OT) ==");
check("thứ 3 thường = T (weekday)", overtimeDayType(2, [0, 6], false) === "weekday");
check("thứ 7 = T1 (ngày nghỉ tuần)", overtimeDayType(6, [0, 6], false) === "weekly_off");
check("lễ rơi vào CN vẫn là T2", overtimeDayType(0, [0, 6], true) === "holiday");
check("hệ số mặc định 150 / 200 / 300",
  overtimeRate(DEFAULT_OVERTIME_CONFIG, "weekday") === 150 &&
  overtimeRate(DEFAULT_OVERTIME_CONFIG, "weekly_off") === 200 &&
  overtimeRate(DEFAULT_OVERTIME_CONFIG, "holiday") === 300);
check("cấu hình hỏng thì về mặc định", parseOvertimeConfig("{bừa").weekdayRate === 150);
check("cấu hình đọc được giá trị admin đặt", parseOvertimeConfig('{"weekdayRate":175,"weeklyOffRate":200,"holidayRate":300,"hoursPerDay":8}').weekdayRate === 175);
check("chặn hệ số dưới 100%", validateOvertimeConfig({ ...DEFAULT_OVERTIME_CONFIG, weekdayRate: 90 }) !== null);
check("chặn giờ chuẩn 0", validateOvertimeConfig({ ...DEFAULT_OVERTIME_CONFIG, hoursPerDay: 0 }) !== null);
check("giờ dự kiến hợp lệ", validatePlannedTimes("18:00", "21:00") === null);
check("chặn giờ kết thúc trước bắt đầu", validatePlannedTimes("21:00", "18:00") !== null);
check("chặn giờ sai dạng", validatePlannedTimes("6h", "21:00") !== null);
const caCN = { ...ca, code: "CN", workStart: "08:30", workEnd: "17:30", minHours: 7, workdayValue: 1 };
const otLunch = parseLunchBreak("12:00-13:30");
const ot = (dayType, scheduled, punches, extra = {}) => computeOvertimeMinutes({
  dayType, scheduled, punches, lunchBreak: otLunch, plannedStart: "18:00", plannedEnd: "21:00", ...extra });
const otAfter = ot("weekday", [caCN], punchDay("08:30", "20:30"));
check("ngày thường: OT là phần sau giờ hết ca 17:30 → 20:30 = 3h", otAfter.minutes === 180 && otAfter.source === "punches", `(${otAfter.minutes}p ${otAfter.source})`);
check("ngày thường ra đúng giờ hết ca thì 0 phút OT", ot("weekday", [caCN], punchDay("08:30", "17:30")).minutes === 0);
const otWeekend = ot("weekly_off", [], punchDay("08:30", "17:30", "2026-09-05"));
check("thứ 7 không có ca: OT cả ngày, trừ nghỉ trưa = 7,5h", otWeekend.minutes === 450, `(${otWeekend.minutes}p)`);
const otHoliday = ot("holiday", [caCN], punchDay("08:30", "12:00", "2026-09-02"));
check("ngày lễ: OT toàn bộ giờ làm dù có lịch = 3,5h", otHoliday.minutes === 210, `(${otHoliday.minutes}p)`);
const otTrip = ot("weekday", [caCN], []);
check("đi công tác không chấm công: lấy giờ dự kiến 18–21 = 3h", otTrip.minutes === 180 && otTrip.source === "planned");
const otOpen = ot("weekday", [caCN], [{ type: "in", at: at("2026-09-01", "08:30"), withinRadius: true }]);
check("quên checkout: lấy giờ dự kiến", otOpen.source === "planned");
check("ca tăng ca (số công 0) không phải ca chính: OT cả giờ làm",
  ot("weekday", [tangCa], punchDay("18:00", "21:00")).minutes === 180);

console.log("\n== bảng lương (đối chiếu file kế toán T9/2026) ==");
const otConf = DEFAULT_OVERTIME_CONFIG;
const payConf = parsePayrollConfig("{}");
const noOt = { T: 0, T1: 0, T2: 0 };
const aiSupport = { allowanceId: "ai", name: "Hỗ trợ AI", mode: "monthly", taxable: true, amount: 300000 };
const pay = (profile, extra) => computePayroll({
  profile: { ...DEFAULT_PAY_PROFILE, ...profile }, config: payConf, overtimeConfig: otConf,
  standardWorkdays: 22, workdays: 0, paidLeaveDays: 0, overtimeMinutes: noOt, allowances: [], ...extra });
// Dòng 1 file kế toán: CTV, đơn giá 40.000đ/công, 14 công, hỗ trợ AI 300.000, khấu trừ 10%.
const ctvDaily = pay({ salaryType: "daily", baseSalary: 40000, contractType: "collaborator" },
  { workdays: 14, allowances: [aiSupport] });
check("CTV theo ngày: thành tiền 40.000 × 14 = 560.000", ctvDaily.earned === 560000, `(${ctvDaily.earned})`);
check("CTV theo ngày: tổng 860.000", ctvDaily.gross === 860000, `(${ctvDaily.gross})`);
check("CTV theo ngày: thuế 10% = 86.000", ctvDaily.tax === 86000, `(${ctvDaily.tax})`);
check("CTV theo ngày: thực nhận 774.000 (khớp file)", ctvDaily.net === 774000, `(${ctvDaily.net})`);
// Dòng 6: thử việc, lương 8.300.000, 85% = 7.055.000, 21/22 công.
const probation = pay({ baseSalary: 8300000, contractType: "probation", probationPercent: 85 }, { workdays: 21 });
check("thử việc: lương áp dụng 85% = 7.055.000", probation.appliedSalary === 7055000, `(${probation.appliedSalary})`);
check("thử việc: 7.055.000 × 21/22 = 6.734.318 (khớp file)", probation.earned === 6734318, `(${probation.earned})`);
// Dòng 7: CTV lương tháng 7.000.000, 14,5/22 công (có nửa ngày x/2).
const ctvMonthly = pay({ baseSalary: 7000000, contractType: "collaborator" }, { workdays: 14.5 });
check("CTV lương tháng: 7.000.000 × 14,5/22 = 4.613.636 (khớp file)", ctvMonthly.earned === 4613636, `(${ctvMonthly.earned})`);
check("CTV lương tháng: thực nhận = 90% (khớp 4.152.272)", ctvMonthly.net === 4152272, `(${ctvMonthly.net})`);
// Dòng 8: thử việc 12.000.000 → 10.200.000, 19,5/22.
const probation2 = pay({ baseSalary: 12000000, contractType: "probation" }, { workdays: 19.5 });
check("thử việc 12tr: 10.200.000 × 19,5/22 = 9.040.909 (khớp file)", probation2.earned === 9040909, `(${probation2.earned})`);

const withOt = pay({ baseSalary: 8800000 }, { workdays: 22, overtimeMinutes: { T: 180, T1: 480, T2: 60 } });
// lương ngày 400.000, lương giờ 50.000.
check("lương giờ = lương ngày ÷ 8 = 50.000", withOt.hourlyRate === 50000, `(${withOt.hourlyRate})`);
check("OT T 3h × 150% = 225.000", withOt.overtime.find((o) => o.code === "T")?.amount === 225000);
check("OT T1 8h × 200% = 800.000", withOt.overtime.find((o) => o.code === "T1")?.amount === 800000);
check("OT T2 1h × 300% = 150.000", withOt.overtime.find((o) => o.code === "T2")?.amount === 150000);
check("tổng = 8.800.000 + 1.175.000", withOt.gross === 9975000, `(${withOt.gross})`);
const july = pay({ baseSalary: 8800000 }, { standardWorkdays: 23, workdays: 23, overtimeMinutes: { T: 180, T1: 0, T2: 0 } });
check("tháng 23 công: làm đủ vẫn nhận đủ 8.800.000", july.earned === 8800000, `(${july.earned})`);
check("tháng 23 công: OT 3h tính trên lương ngày ÷ 23", july.overtime[0]?.amount === Math.round(8800000 / 23 / 8 * 3 * 1.5), `(${july.overtime[0]?.amount})`);

const leave = pay({ baseSalary: 8800000 }, { workdays: 20, paidLeaveDays: 2 });
check("2 ngày phép có lương: được trả như 22 công", leave.earned === 8800000 && leave.paidWorkdays === 22);
const prorated = pay({ baseSalary: 8800000 }, { workdays: 11, allowances: [
  { allowanceId: "a", name: "Gửi xe", mode: "prorated", taxable: false, amount: 200000 },
  { allowanceId: "b", name: "Ăn trưa", mode: "per_day", taxable: false, amount: 30000 }] });
check("hỗ trợ theo tỉ lệ: 200.000 × 11/22 = 100.000", prorated.allowances[0].amount === 100000);
check("hỗ trợ theo ngày: 30.000 × 11 = 330.000", prorated.allowances[1].amount === 330000);
check("khoản không chịu thuế không vào thu nhập tính thuế 10%", prorated.taxableIncome === prorated.earned, `(${prorated.taxableIncome})`);
check("không có công thì 0 đồng", pay({ baseSalary: 8800000 }, {}).net === 0);

const official = pay({ baseSalary: 30000000, taxMode: "progressive", hasInsurance: true, dependents: 1 }, { workdays: 22 });
check("BH 10,5% trên 30tr = 3.150.000", official.insurance.total === 3150000, `(${official.insurance.total})`);
// 30.000.000 - 3.150.000 - 15.500.000 - 6.200.000 = 5.150.000 → bậc 1 5% = 257.500
check("thu nhập tính thuế sau giảm trừ = 5.150.000", official.taxableIncome === 5150000, `(${official.taxableIncome})`);
check("thuế luỹ tiến bậc 1 = 257.500", official.tax === 257500, `(${official.tax})`);
check("thực nhận = 30tr - BH - thuế", official.net === 30000000 - 3150000 - 257500);
check("luỹ tiến qua nhiều bậc: 40tr = 500k + 2tr + 2tr = 4.500.000",
  progressiveTax(40000000, payConf.taxBrackets) === 4500000, `(${progressiveTax(40000000, payConf.taxBrackets)})`);
const otExempt = pay({ baseSalary: 30000000, taxMode: "progressive" }, { workdays: 22, overtimeMinutes: { T: 0, T1: 480, T2: 0 } });
check("luỹ tiến: phần OT vượt lương thường không chịu thuế",
  otExempt.taxableIncome === Math.max(0, 30000000 + Math.round(30000000 / 22) - 15500000), `(${otExempt.taxableIncome})`);
check("không khấu trừ thì thuế 0", pay({ baseSalary: 5000000, taxMode: "none" }, { workdays: 22 }).tax === 0);
check("ngưỡng khấu trừ 2tr: dưới ngưỡng không trừ",
  computePayroll({ profile: { ...DEFAULT_PAY_PROFILE, salaryType: "daily", baseSalary: 40000 }, config: { ...payConf, flatTaxThreshold: 2000000 },
    overtimeConfig: otConf, standardWorkdays: 22, workdays: 14, paidLeaveDays: 0, overtimeMinutes: noOt, allowances: [] }).tax === 0);
check("cấu hình lương hỏng thì về mặc định", parsePayrollConfig("{bừa").insurance.bhxh === 8);
check("chặn bậc thuế không tăng dần", validatePayrollConfig({ ...payConf, taxBrackets: [{ upTo: 30, rate: 5 }, { upTo: 10, rate: 10 }, { upTo: null, rate: 20 }] }) !== null);

console.log("\n== lương GROSS / NET ==");
const gross15 = pay({ baseSalary: 15000000, taxMode: "progressive", hasInsurance: true, insuranceSalary: 7100000 }, { workdays: 22 });
check("GROSS 15tr, BH trên 7,1tr: BH = 745.500", gross15.insurance.total === 745500, `(${gross15.insurance.total})`);
check("GROSS 15tr: dưới mức giảm trừ nên thuế 0, thực nhận 14.254.500", gross15.tax === 0 && gross15.net === 14254500, `(${gross15.net})`);
check("GROSS thì không có khoản bù", gross15.netGrossUp === 0 && gross15.targetNet === null);
const net15 = pay({ payBasis: "net", baseSalary: 15000000, taxMode: "progressive", hasInsurance: true, insuranceSalary: 7100000 }, { workdays: 22 });
check("NET 15tr: cầm về đúng 15.000.000", net15.net === 15000000, `(${net15.net})`);
check("NET 15tr: gross = 15.745.500 (công ty bù đúng phần BH)", net15.gross === 15745500 && net15.netGrossUp === 745500, `(${net15.gross})`);
const net30 = pay({ payBasis: "net", baseSalary: 30000000, taxMode: "progressive", hasInsurance: true, insuranceSalary: 7100000 }, { workdays: 22 });
// G - 745.500 - thuế = 30tr; thuế = 950.000 / 0,9 = 1.055.556 → G ≈ 31.801.056
check("NET 30tr có thuế luỹ tiến: cầm về đúng 30.000.000", net30.net === 30000000, `(${net30.net})`);
check("NET 30tr: gross ≈ 31.801.056 (bù BH + thuế)", Math.abs(net30.gross - 31801056) <= 2, `(${net30.gross})`);
const net30half = pay({ payBasis: "net", baseSalary: 30000000, taxMode: "progressive", hasInsurance: true, insuranceSalary: 7100000 }, { workdays: 11 });
check("NET nghỉ nửa tháng: cầm về 15tr (theo tỉ lệ công)", net30half.net === 15000000, `(${net30half.net})`);
const netCtv = pay({ payBasis: "net", baseSalary: 9000000, contractType: "collaborator", taxMode: "flat10" }, { workdays: 22 });
check("NET CTV khấu trừ 10%: gross = 10.000.000 để cầm về 9tr", netCtv.net === 9000000 && netCtv.gross === 10000000, `(${netCtv.gross} ${netCtv.net})`);
const netAllow = pay({ payBasis: "net", baseSalary: 9000000, contractType: "collaborator", taxMode: "flat10" }, { workdays: 22, allowances: [aiSupport] });
check("NET có hỗ trợ: hỗ trợ cũng là tiền cầm về (9,3tr)", netAllow.net === 9300000 && netAllow.targetNet === 9300000, `(${netAllow.net})`);

console.log("\n== phép năm ==");
const leaveConf = payConf.annualLeave;
const lv = (startDate, month, leaveDates) => annualLeaveForMonth({ startDate, month, leaveDates, config: leaveConf });
check("mỗi tháng cộng 1 ngày: vào làm tháng 9, nghỉ 1 ngày tháng 9 = có lương", lv("2026-09-01", "2026-09", ["2026-09-10"]).paidDays === 1);
check("nghỉ 2 ngày trong tháng đầu: 1 có lương, 1 không lương",
  lv("2026-09-01", "2026-09", ["2026-09-10", "2026-09-11"]).paidDays === 1 && lv("2026-09-01", "2026-09", ["2026-09-10", "2026-09-11"]).unpaidDays === 1);
const saved = lv("2026-01-01", "2026-06", ["2026-06-01", "2026-06-02", "2026-06-03"]);
check("không dùng thì cộng dồn: 6 tháng tích 6 ngày, nghỉ 3 còn 3", saved.paidDays === 3 && saved.balance === 3, `(${saved.paidDays}, ${saved.balance})`);
check("phép cộng dồn tối đa 3 năm (36 ngày + năm hiện tại)", lv("2020-01-01", "2026-12", []).balance <= 36 + 13, `(${lv("2020-01-01", "2026-12", []).balance})`);
const senior = lv("2020-01-01", "2025-12", []);
check("đủ 5 năm được thêm ngày phép (tích luỹ năm thứ 6 = 13 ngày)", senior.accrued > 72, `(${senior.accrued})`);
check("tháng trước ngày vào làm thì chưa có phép", lv("2026-09-15", "2026-08", []).balance === 0);

console.log("\n== ký hiệu bảng chấm công cho kế toán ==");
const cell = (status, codes, value, label = "") => ({ status, codes, workdayValue: value, label });
check("full-time một công = x", accountingCellLabel(cell("passed", ["CN"], 1), "full_time") === "x");
check("full-time nửa công = x/2", accountingCellLabel(cell("passed", ["S"], 0.5), "full_time") === "x/2");
check("part-time ghi mã ca", accountingCellLabel(cell("passed", ["S"], 0.5), "part_time") === "S");
check("part-time hai ca ghi S+C", accountingCellLabel(cell("passed", ["S", "C"], 1), "intern") === "S+C");
check("ngày lễ = L", accountingCellLabel(cell("holiday", ["CN"], 1, "L"), "full_time") === "L");
check("vắng giữ ký hiệu V", accountingCellLabel(cell("absent", ["CN"], 0, "V"), "full_time") === "V");
check("thiếu giờ admin không tính giữ ký hiệu lưới", accountingCellLabel(cell("insufficient", ["CN"], 0, "CN!"), "full_time") === "CN!");
check("full-time có OT ngày thường = x+T",
  accountingCellLabel({ ...cell("passed", ["CN"], 1), overtime: { code: "T", minutes: 120 } }, "full_time") === "x+T");
check("full-time chỉ làm OT thứ 7 = T1",
  accountingCellLabel({ ...cell("unscheduled", [], 0, "NL"), overtime: { code: "T1", minutes: 450 } }, "full_time") === "T1");
check("ngày lễ có OT = L+T2",
  accountingCellLabel({ ...cell("holiday", ["CN"], 1, "L"), overtime: { code: "T2", minutes: 60 } }, "full_time") === "L+T2");

console.log("\n== giờ nghỉ trưa ==");
const lunch = parseLunchBreak("12:00-13:30");
check("đọc chuỗi 12:00-13:30", lunch?.start === 720 && lunch?.end === 810, JSON.stringify(lunch));
check("chuỗi rỗng = không có nghỉ trưa", parseLunchBreak("") === null && parseLunchBreak(null) === null);
check("kết thúc trước bắt đầu = không hợp lệ", parseLunchBreak("13:00-12:00") === null);
check("sai dạng = không hợp lệ", parseLunchBreak("12h-13h") === null && parseLunchBreak("12:00") === null);
const withLunch = (inTime, outTime) => pairPunches([
  { type: "in", at: at("2026-09-01", inTime), withinRadius: true },
  { type: "out", at: at("2026-09-01", outTime), withinRadius: true }], lunch);
check("cả ngày 08:30–17:30 trừ 1,5h = 7,5h", withLunch("08:30", "17:30").workedMinutes === 450, `(${withLunch("08:30", "17:30").workedMinutes}p)`);
check("ghi nhận đã trừ 90 phút", withLunch("08:30", "17:30").lunchMinutes === 90);
check("ca sáng ra đúng 12:00 không bị trừ = 3,5h", withLunch("08:30", "12:00").workedMinutes === 210);
check("ra 12:45 chỉ trừ 45 phút", withLunch("08:30", "12:45").workedMinutes === 210, `(${withLunch("08:30", "12:45").workedMinutes}p)`);
check("vào 13:00 giữa giờ trưa chỉ trừ 30 phút", withLunch("13:00", "17:30").workedMinutes === 240, `(${withLunch("13:00", "17:30").workedMinutes}p)`);
check("ca chiều vào 13:30 không bị trừ = 4h", withLunch("13:30", "17:30").workedMinutes === 240);
check("tăng ca buổi tối không dính nghỉ trưa", withLunch("18:00", "21:00").workedMinutes === 180);

const caNgay = { ...ca, id: "s4", code: "CN", workStart: "08:30", workEnd: "17:30", minHours: 7 };
const fullDay = evaluateDay({ scheduled: [caNgay], lunchBreak: lunch, punches: [
  { type: "in", at: at("2026-09-01", "08:30"), withinRadius: true },
  { type: "out", at: at("2026-09-01", "17:30"), withinRadius: true }] });
check("cả ngày 7,5h so với ngưỡng 7h = passed", fullDay.status === "passed" && fullDay.workedMinutes === 450, `(${fullDay.status}, ${fullDay.workedMinutes}p)`);
const shortDay = evaluateDay({ scheduled: [caNgay], lunchBreak: lunch, punches: [
  { type: "in", at: at("2026-09-01", "09:00"), withinRadius: true },
  { type: "out", at: at("2026-09-01", "16:00"), withinRadius: true }] });
check("09:00–16:00 trừ trưa còn 5,5h = insufficient", shortDay.status === "insufficient" && shortDay.workedMinutes === 330, `(${shortDay.status}, ${shortDay.workedMinutes}p)`);
const sangMoi = { ...sang, workStart: "08:30", minHours: 3 };
const chieuMoi = { ...chieu, workStart: "13:30", workEnd: "17:30", minHours: 3.5 };
const twoShifts = evaluateDay({ scheduled: [sangMoi, chieuMoi], lunchBreak: lunch, punches: [
  { type: "in", at: at("2026-09-01", "08:30"), withinRadius: true },
  { type: "out", at: at("2026-09-01", "17:00"), withinRadius: true }] });
check("S+C vào 08:30 ra 17:00: 8,5h - 1,5h = 7h >= 6,5h = passed", twoShifts.status === "passed" && twoShifts.workedMinutes === 420, `(${twoShifts.status}, ${twoShifts.workedMinutes}p)`);
const noLunchDay = evaluateDay({ scheduled: [caNgay], punches: [
  { type: "in", at: at("2026-09-01", "08:30"), withinRadius: true },
  { type: "out", at: at("2026-09-01", "17:30"), withinRadius: true }] });
check("không truyền nghỉ trưa thì tính trọn 9h", noLunchDay.workedMinutes === 540 && noLunchDay.lunchMinutes === 0);


console.log("\n== nội dung công việc hằng ngày ==");
const m = (time) => parseTimeToMinutes(time);
// start/end/nextEnd/now đều là giờ VN; nextEnd = null nghĩa là khoảng cuối ngày.
const boundary = (start, end, nextEnd = null, now = "18:00") =>
  validateBoundary({
    startMinutes: m(start),
    endMinutes: m(end),
    nextEndMinutes: nextEnd === null ? null : m(nextEnd),
    nowMinutes: m(now),
  });

check("khoảng hợp lệ 08:25–09:30", boundary("08:25", "09:30") === null, `(${boundary("08:25", "09:30")})`);
check("kết thúc bằng giờ bắt đầu bị chặn", boundary("08:25", "08:25") !== null);
check("kết thúc trước giờ bắt đầu bị chặn", boundary("09:30", "08:25") !== null);
check("không khai được giờ tương lai", boundary("08:25", "09:30", null, "09:00") !== null);
check("lệch đồng hồ 1 phút vẫn cho qua", boundary("08:25", "09:01", null, "09:00") === null);
check("sửa cv1 nuốt trọn cv2 thì báo lỗi", (boundary("08:25", "11:00", "10:30") ?? "").includes("khoảng kế tiếp"), `(${boundary("08:25", "11:00", "10:30")})`);
check("kết thúc đúng bằng cuối cv2 cũng bị chặn", boundary("08:25", "10:30", "10:30") !== null);
check("sửa cv1 co lại vẫn hợp lệ", boundary("08:25", "09:00", "10:30") === null);
check("nới cv1 sát cuối cv2 vẫn hợp lệ", boundary("08:25", "10:29", "10:30") === null);

check("nội dung quá ngắn bị chặn", validateContent("ok") !== null);
check("nội dung quá dài bị chặn", validateContent("x".repeat(1001)) !== null);
check("nội dung bình thường được nhận", validateContent("Viết báo cáo tuần") === null);

check('parse "08:25" = 505 phút', parseEntryTime("08:25") === 505);
check('parse "8:25" không hợp lệ', parseEntryTime("8:25") === null);
check('parse "24:00" không hợp lệ', parseEntryTime("24:00") === null);

check("65 phút hiện 1h05", formatDuration(65) === "1h05", `(${formatDuration(65)})`);
check("120 phút hiện 2h", formatDuration(120) === "2h", `(${formatDuration(120)})`);
check("45 phút hiện 45 phút", formatDuration(45) === "45 phút", `(${formatDuration(45)})`);

console.log("\n== TOTP / xác thực 2 lớp ==");
// Vector chuẩn RFC 6238 (SHA1, khoá ASCII "12345678901234567890").
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));
check("base32 khoá RFC", RFC_SECRET === "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", `(${RFC_SECRET})`);
check("base32 giải mã ngược", base32Decode(RFC_SECRET).toString() === "12345678901234567890");
check("TOTP t=59 = 287082", totp(RFC_SECRET, 59_000) === "287082", `(${totp(RFC_SECRET, 59_000)})`);
check("TOTP t=1111111109 = 081804", totp(RFC_SECRET, 1_111_111_109_000) === "081804");
check("TOTP t=1234567890 = 005924", totp(RFC_SECRET, 1_234_567_890_000) === "005924");
check("HOTP 8 số t=59 = 94287082", hotp(RFC_SECRET, 1, 8) === "94287082");

const t0 = 1_700_000_000_000;
const s0 = Math.floor(t0 / 30000);
const secret = generateTotpSecret();
check("khoá mới 32 ký tự base32 (160 bit)", /^[A-Z2-7]{32}$/.test(secret), `(${secret})`);
check("mã hiện tại hợp lệ, trả về bước", verifyTotp(secret, totp(secret, t0), { now: t0 }) === s0);
check("mã lệch -30 giây vẫn nhận", verifyTotp(secret, totp(secret, t0 - 30000), { now: t0 }) === s0 - 1);
check("mã lệch +30 giây vẫn nhận", verifyTotp(secret, totp(secret, t0 + 30000), { now: t0 }) === s0 + 1);
check("mã lệch 90 giây bị từ chối", verifyTotp(secret, totp(secret, t0 - 90000), { now: t0 }) === null);
check("mã đã dùng (bước <= minStep) bị từ chối", verifyTotp(secret, totp(secret, t0), { now: t0, minStep: s0 }) === null);
check("mã bước sau minStep vẫn nhận", verifyTotp(secret, totp(secret, t0 + 30000), { now: t0, minStep: s0 }) === s0 + 1);
check("mã có khoảng trắng vẫn nhận", verifyTotp(secret, totp(secret, t0).replace(/(\d{3})/, "$1 "), { now: t0 }) === s0);
check("mã không phải 6 số bị từ chối", verifyTotp(secret, "12345", { now: t0 }) === null && verifyTotp(secret, "abcdef", { now: t0 }) === null);
const url = otpauthUrl("Công ty A", "admin@x.vn", secret);
check("otpauth URL đúng định dạng", url.startsWith("otpauth://totp/") && url.includes(`secret=${secret}`) && url.includes("period=30"), `(${url})`);

console.log("\n== nhật ký bảo mật ==");
check("UA Chrome Windows", summarizeUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36") === "Chrome · Windows");
check("UA Cốc Cốc", summarizeUserAgent("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) coc_coc_browser/130.0 Chrome/130.0 CocCoc Safari/537.36").startsWith("Cốc Cốc"));
check("UA curl là công cụ", summarizeUserAgent("curl/8.7.1") === "Công cụ / script");

console.log("\n== email thông báo nhân viên ==");
check("ngày kèm thứ", formatDateWithWeekday("2026-10-08") === "08/10/2026 (T5)", `(${formatDateWithWeekday("2026-10-08")})`);
check("giờ vào ra xếp theo giờ", describePunches([{ type: "out", time: "17:30" }, { type: "in", time: "08:00" }]) === "Vào 08:00 · Ra 17:30");
check("không có giờ chấm công", describePunches([]) === "không có giờ chấm công");
const editNotice = attendanceEditNotice({ date: "2026-10-07", before: [{ type: "in", time: "08:05" }], after: [{ type: "in", time: "08:05" }, { type: "out", time: "17:30" }], note: "Quên checkout" });
check("sửa giờ: tiêu đề có ngày", editNotice.subject === "Giờ chấm công ngày 07/10 đã được điều chỉnh", `(${editNotice.subject})`);
check("sửa giờ: có trước / sau", editNotice.lines.includes("Trước: Vào 08:05") && editNotice.lines.includes("Sau: Vào 08:05 · Ra 17:30"));
check("sửa giờ: có ghi chú admin", editNotice.lines.includes("Ghi chú của quản trị viên: Quên checkout"));
check("sửa giờ: không ghi chú thì không có dòng ghi chú", !attendanceEditNotice({ date: "2026-10-07", before: [], after: [], note: null }).lines.some((line) => line.startsWith("Ghi chú")));
check("chấm ô: ốm", dayMarkNotice({ date: "2026-10-07", leaveCode: "O", sessions: [] }).lines.at(-1).includes("Ốm (O)"));
check("chấm ô: đổi ca", dayMarkNotice({ date: "2026-10-07", leaveCode: null, sessions: [{ code: "S", name: "Ca sáng" }, { code: "C", name: "Ca chiều" }] }).lines.at(-1).includes("Ca sáng (S) + Ca chiều (C)"));
check("chấm ô: xoá đánh dấu", dayMarkNotice({ date: "2026-10-07", leaveCode: null, sessions: [] }).lines.at(-1).startsWith("Đã bỏ đánh dấu"));
check("ngày thiếu giờ: không tính công", dayReviewNotice({ date: "2026-10-07", decision: "exclude" }).lines[0].endsWith("không tính công."));
const leaveNotice = shiftRequestNotice({ date: "2026-10-07", approved: false, requestedCodes: ["N"], adminNote: "Thiếu người" });
check("xin nghỉ bị từ chối: tiêu đề", leaveNotice.subject === "Yêu cầu xin nghỉ ngày 07/10 bị từ chối", `(${leaveNotice.subject})`);
check("đổi ca được duyệt: nêu ca mới", shiftRequestNotice({ date: "2026-10-07", approved: true, requestedCodes: ["S", "C"], adminNote: null }).lines[0].includes("sang S + C"));
const otNotice = overtimeNotice({ date: "2026-10-04", action: "approve", plannedStart: "08:00", plannedEnd: "12:00", hours: "3,5", code: "T1", rate: 200, adminNote: null });
check("OT duyệt: số giờ + hệ số", otNotice.subject === "Phiếu OT ngày 04/10 đã được duyệt" && otNotice.lines.includes("Số giờ tính lương: 3,5 giờ, loại T1 hệ số 200%."));
check("OT sửa giờ: tiêu đề riêng", overtimeNotice({ date: "2026-10-04", action: "update", plannedStart: "08:00", plannedEnd: "12:00", hours: "4", code: "T1", rate: 200, adminNote: null }).subject === "Số giờ OT ngày 04/10 đã được điều chỉnh");
const composed = composeNoticeEmail(editNotice, { name: "An", companyName: "Sao Mộc" });
check("email: tiền tố + lời chào + chỉ chỗ xem lại", composed.subject.startsWith("[Chấm công] ") && composed.text.startsWith("Chào An,") && composed.text.includes('mục "Lịch sử chấm công"'));
check("email: không có đường link nào", !/https?:|www\.|\/dashboard/i.test(composed.text), composed.text);

console.log(`\n===== ${pass} đạt / ${fail} hỏng =====`);
if (bad.length) bad.forEach((f) => console.log(" -", f));
process.exit(fail === 0 ? 0 : 1);
