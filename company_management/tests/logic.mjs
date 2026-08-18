import {
  openRegistrationMonth,
  isRegistrationOpen,
  registrationWindow,
  fullTimeWorkingDates,
  isSelfScheduled,
} from "../lib/schedule.ts";
import { evaluateDay, pairPunches } from "../lib/attendance-rules.ts";
import { vnDateTimeToUtc, weekdayLabel, daysInMonth, addMonths } from "../lib/datetime.ts";

let pass = 0, fail = 0;
const bad = [];
function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; bad.push(`${name} ${detail}`); console.log(`  FAIL ${name} ${detail}`); }
}

// Mốc thời gian giả, tính theo giờ VN (UTC+7).
const at = (dateKey, time = "12:00") => vnDateTimeToUtc(dateKey, time);

console.log("\n== cửa sổ đăng ký lịch ==");
check("ngày 19/08 chưa mở", openRegistrationMonth(at("2026-08-19")) === null);
check("ngày 20/08 mở cho tháng 9", openRegistrationMonth(at("2026-08-20")) === "2026-09");
check("ngày 31/08 vẫn mở cho tháng 9", openRegistrationMonth(at("2026-08-31", "23:59")) === "2026-09");
check("ngày 01/09 đóng lại", openRegistrationMonth(at("2026-09-01")) === null);
check("ngày 20/12 mở cho tháng 1 năm sau", openRegistrationMonth(at("2026-12-20")) === "2027-01");
check("đúng tháng thì mở", isRegistrationOpen("2026-09", at("2026-08-25")) === true);
check("sai tháng thì đóng", isRegistrationOpen("2026-10", at("2026-08-25")) === false);
check("không đăng ký lùi tháng cũ", isRegistrationOpen("2026-08", at("2026-08-25")) === false);

const w = registrationWindow("2026-03");
check("cửa sổ tháng 3 = 20/02–28/02", w.opensOn === "2026-02-20" && w.closesOn === "2026-02-28", JSON.stringify(w));
const wLeap = registrationWindow("2024-03");
check("năm nhuận: 20/02–29/02", wLeap.closesOn === "2024-02-29", JSON.stringify(wLeap));

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

console.log("\n== ghép cặp giờ vào/ra ==");
const twoShifts = pairPunches([
  { type: "in", at: at("2026-09-01", "08:00"), withinRadius: true },
  { type: "out", at: at("2026-09-01", "12:00"), withinRadius: true },
  { type: "in", at: at("2026-09-01", "13:00"), withinRadius: true },
  { type: "out", at: at("2026-09-01", "17:00"), withinRadius: true },
]);
check("2 ca rời nhau = 8h (bỏ giờ nghỉ trưa)", twoShifts.workedMinutes === 480, `(${twoShifts.workedMinutes}p)`);
const openShift = pairPunches([{ type: "in", at: at("2026-09-01", "08:00"), withinRadius: true }]);
check("chỉ có vào, chưa ra -> ca đang mở", openShift.openSince !== null && openShift.workedMinutes === 0);
const dupIn = pairPunches([
  { type: "in", at: at("2026-09-01", "08:00"), withinRadius: true },
  { type: "in", at: at("2026-09-01", "09:00"), withinRadius: true },
  { type: "out", at: at("2026-09-01", "17:00"), withinRadius: true },
]);
check("vào 2 lần liên tiếp: giữ lần đầu = 9h", dupIn.workedMinutes === 540, `(${dupIn.workedMinutes}p)`);
const orphanOut = pairPunches([{ type: "out", at: at("2026-09-01", "17:00"), withinRadius: true }]);
check("chỉ có ra, không có vào = 0h", orphanOut.workedMinutes === 0);
const unsorted = pairPunches([
  { type: "out", at: at("2026-09-01", "17:00"), withinRadius: true },
  { type: "in", at: at("2026-09-01", "08:00"), withinRadius: true },
]);
check("tự sắp xếp theo thời gian = 9h", unsorted.workedMinutes === 540, `(${unsorted.workedMinutes}p)`);

console.log("\n== xếp loại ngày công ==");
const ca = { id: "s1", code: "HC", name: "Hành chính", checkInStart: "07:00",
  checkInEnd: "09:00", workStart: "08:00", workEnd: "17:00", minHours: 8,
  sortOrder: 1, isDefaultFull: true };
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
check("đang trong ca = open",
  day([{ type: "in", at: at("2026-09-01", "08:00"), withinRadius: true }]).status === "open");
check("ngày lễ không chấm = holiday", day([], { isHoliday: true }).status === "holiday");
check("ngày lễ không bị tính thiếu công", day([], { isHoliday: true }).missingMinutes === 0);
check("không lịch, không chấm = off",
  evaluateDay({ scheduled: [], punches: [] }).status === "off");
check("không lịch mà có chấm = unscheduled",
  evaluateDay({ scheduled: [], punches: [
    { type: "in", at: at("2026-09-01", "08:00"), withinRadius: true },
    { type: "out", at: at("2026-09-01", "17:00"), withinRadius: true }] }).status === "unscheduled");
check("phát hiện bấm giờ ngoài bán kính",
  day([{ type: "in", at: at("2026-09-01", "08:00"), withinRadius: false },
       { type: "out", at: at("2026-09-01", "17:00"), withinRadius: true }]).outsideRadius === true);

const sang = { ...ca, id: "s2", code: "S", workStart: "08:00", workEnd: "12:00", minHours: 4, sortOrder: 1 };
const chieu = { ...ca, id: "s3", code: "C", workStart: "13:00", workEnd: "17:00", minHours: 4, sortOrder: 2 };
const both = evaluateDay({ scheduled: [sang, chieu], punches: [
  { type: "in", at: at("2026-09-01", "08:00"), withinRadius: true },
  { type: "out", at: at("2026-09-01", "12:00"), withinRadius: true },
  { type: "in", at: at("2026-09-01", "13:00"), withinRadius: true },
  { type: "out", at: at("2026-09-01", "17:00"), withinRadius: true }] });
check("part-time 2 ca: cần 8h, làm 8h = passed", both.status === "passed", `(${both.status})`);
check("part-time 2 ca hiện mã S+C", both.codes.join("+") === "S+C", `(${both.codes})`);
const onlyMorning = evaluateDay({ scheduled: [sang, chieu], punches: [
  { type: "in", at: at("2026-09-01", "08:00"), withinRadius: true },
  { type: "out", at: at("2026-09-01", "12:00"), withinRadius: true }] });
check("đăng ký 2 ca chỉ làm 1 = thiếu giờ", onlyMorning.status === "insufficient", `(${onlyMorning.status})`);

console.log(`\n===== ${pass} đạt / ${fail} hỏng =====`);
if (bad.length) bad.forEach((f) => console.log(" -", f));
process.exit(fail === 0 ? 0 : 1);
