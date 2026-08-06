import ExcelJS from 'exceljs';
import type {AttendanceRecord} from './api';

const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
];

function getWorkedHours(record: AttendanceRecord): number {
  const payable = record.payable_duration || 0;
  const preShift = record.pre_shift_overtime_seconds || 0;
  const postShift = record.post_shift_overtime_seconds || 0;
  return (payable + preShift + postShift) / 3600;
}

// Builds a Date whose UTC fields equal the literal date+time string, so that
// when ExcelJS serializes it (using UTC fields) Excel displays the same
// clock time that's stored in the database, instead of shifting it by the
// browser's local timezone offset.
function toExcelDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute, second] = timeStr.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second || 0));
}

export async function exportAttendanceToExcel(
    records : AttendanceRecord[],
    month : number,
    year : number,
): Promise<void> {
    const groups = new Map<string, AttendanceRecord[]>();

    for (const record of records){
        const key = record.employee_id;
        if (!groups.has(key)){
            groups.set(key,[]);
        }
        groups.get(key)!.push(record);
    }
    //employeerecords is one employee's array of records
    for (const employeeRecords of groups.values()){
        employeeRecords.sort((a,b) => b.date.localeCompare(a.date));
    }

    const isNumericCode = (code: string) => /^\d+$/.test(code);
    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
        const aCode = a[0].employee_code || '';
        const bCode = b[0].employee_code || '';
        const aNum = isNumericCode(aCode);
        const bNum = isNumericCode(bCode);
        if (aNum && bNum) return parseInt(aCode) - parseInt(bCode);
        if (aNum) return -1;
        if (bNum) return 1;
        return aCode.localeCompare(bCode);
    });

    //now groups is set of sorted by date attendance record arrays, categorized employee wise, ordered by employee code
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');

    const headerRow = ws.addRow(['Employee', 'Check In', 'Check Out', 'Worked Hours', 'Over Time']);
    headerRow.font = { bold: true };

        for (const employeeRecords of sortedGroups) {
        const first = employeeRecords[0];

        let totalOvertime = 0;
        let totalWorked = 0;
        for (const record of employeeRecords) {
            totalOvertime += record.overtime_hours || 0;
            totalWorked += getWorkedHours(record);
        }

        const summaryRow = ws.addRow([
            `${first.employee_name} (${first.employee_code})`,
            '',
            '',
            totalWorked,
            totalOvertime
        ]);
        summaryRow.font = { bold: true };
        summaryRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE9ECEF' }
            };
        });

            for (const record of employeeRecords) {
            const checkIn = record.check_in_time
                ? toExcelDateTime(record.date, record.check_in_time)
                : null;
            const checkOut = record.check_out_time
                ? toExcelDateTime(record.date, record.check_out_time)
                : null;

            const dailyRow = ws.addRow([
                record.employee_name || '',
                checkIn,
                checkOut,
                getWorkedHours(record),
                record.overtime_hours || 0
            ]);

            dailyRow.getCell(2).numFmt = 'yyyy-mm-dd hh:mm:ss';
            dailyRow.getCell(3).numFmt = 'yyyy-mm-dd hh:mm:ss';
            dailyRow.getCell(4).numFmt = '#,##0.00';
            dailyRow.getCell(5).numFmt = '#,##0.00';
        }

    }

    ws.getColumn(1).width = 30;
    ws.getColumn(2).width = 20;
    ws.getColumn(3).width = 20;
    ws.getColumn(4).width = 13;
    ws.getColumn(5).width = 10;

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Attendance_${MONTH_NAMES[month - 1]}_${year}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

}
