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

    //now groups is set of sorted by date attendance record arrays, categorized employee wise
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');

    const headerRow = ws.addRow(['Check In', 'Check Out', 'Employee', 'Over Time', 'Worked Hours']);
    headerRow.font = { bold: true };

        for (const employeeRecords of groups.values()) {
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
            totalOvertime,
            totalWorked
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
                ? new Date(`${record.date}T${record.check_in_time}`)
                : null;
            const checkOut = record.check_out_time
                ? new Date(`${record.date}T${record.check_out_time}`)
                : null;

            const dailyRow = ws.addRow([
                checkIn,
                checkOut,
                record.employee_name || '',
                record.overtime_hours || 0,
                getWorkedHours(record)
            ]);

            dailyRow.getCell(1).numFmt = 'yyyy-mm-dd hh:mm:ss';
            dailyRow.getCell(2).numFmt = 'yyyy-mm-dd hh:mm:ss';
            dailyRow.getCell(4).numFmt = '#,##0.00';
            dailyRow.getCell(5).numFmt = '#,##0.00';
        }

    }

    ws.getColumn(1).width = 30;
    ws.getColumn(4).width = 10;
    ws.getColumn(5).width = 13;

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
