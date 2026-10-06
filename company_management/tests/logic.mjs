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
import { vnDateTimeToUtc, weekdayLabel, daysInMonth, addMonths, parseTimeToMinutes } from "../lib/datetime.ts";
import {
  formatDuration,
  parseEntryTime,
  validateBoundary,
  validateContent,
} from "../lib/work-reports.ts";

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

console.log(`\n===== ${pass} đạt / ${fail} hỏng =====`);
if (bad.length) bad.forEach((f) => console.log(" -", f));
process.exit(fail === 0 ? 0 : 1);
