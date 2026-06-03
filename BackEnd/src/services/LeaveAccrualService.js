const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');

class LeaveAccrualService {
    
    async processMonthlyAccrual(db){    
        const summary = { processed: 0, skipped: 0, errors: []};

        const [accrualLeaveTypes] = await db.execute(`
            SELECT id,client_id,name,accrual_per_month
            FROM leave_types
            WHERE is_trainee_only = 1 AND accrual_per_month > 0 AND is_active = 1
            `
        );

        if(accrualLeaveTypes.length === 0){
            console.log(`No active accrual leave types found `);
            return summary;
        }

        const now = new Date();
        const endMonth = new Date(now.getFullYear(),now.getMonth()+1,1);
        const endMonthStr = this._toDateStr(endMonth);

        for(const leaveType of accrualLeaveTypes){
            const [trainees] = await db.execute(`
                SELECT id,employee_code,hire_date
                FROM employees
                WHERE client_id = ? AND employee_type = 'trainee' AND employment_status = 'active' AND hire_date IS NOT NULL
                `,[leaveType.client_id]

            );

            for( const trainee of trainees){
                try{
                    await this._processTraineeAccrual(db,trainee,leaveType,endMonthStr);
                    summary.processed++;
                }catch(err){
                    summary.errors.push({
                        employee_code: trainee.employee_code,
                        leave_type: leaveType.name,
                        error:err.message
                    });
                    console.error(`LeaveAccrualService: Error processing accrual for ${trainee.employee_code} / ${leaveType.name}:`,err.message);
                }
            }
        }

        console.log(`LeaveAccrualService: Done. Processed= ${summary.processed}, Skipped=${summary.skipped}, Errors=${summary.errors.length}`);
        return {summary};

            
    }

    async _processTraineeAccrual(db,trainee,leaveType,endMonthStr){
        await this._ensureBalanceRow(db,trainee.id,leaveType.id);

        const [rows] = await db.execute(`
            SELECT cumulative_accrued, cumulative_used, available_balance, last_accrual_month
            FROM leave_accrual_balances
            WHERE employee_id = ? AND leave_type_id = ? 
            `,[trainee.id, leaveType.id]
        );

        const balance = rows[0];
        const lastAccrualMonth = balance.last_accrual_month;

        let startMonthStr;
        if(!lastAccrualMonth){
            const hireDate = new Date(trainee.hire_date);
            const joiningMonth = new Date(hireDate.getFullYear(), hireDate.getMonth()+1, 1);
            startMonthStr = this._toDateStr(joiningMonth);
            await this._reconcileUsed(db, trainee.id, leaveType.id);
        }else{
            const last = new Date(lastAccrualMonth);
            const nextMonth = new Date(last.getFullYear(),last.getMonth()+1,1);
            startMonthStr = this._toDateStr(nextMonth);

        }

        const startDate = new Date(startMonthStr);
        const endDate = new Date(endMonthStr);
        const monthsToAccrue = this._monthDiff (startDate,endDate);

        if(monthsToAccrue <= 0){
            return;
        }

        const newDays = monthsToAccrue * parseFloat(leaveType.accrual_per_month);
        const prevMonth = new Date(endDate.getFullYear(),endDate.getMonth()-1,1);
        const newLastAccrueMonth = this._toDateStr(prevMonth);

        await db.execute(`
            UPDATE leave_accrual_balances
            SET cumulative_accrued = cumulative_accrued + ?,
                available_balance  = available_balance + ?,
                last_accrual_month = ?
            WHERE employee_id = ? AND leave_type_id = ?
            `,[newDays, newDays, newLastAccrueMonth, trainee.id, leaveType.id]
        );

        console.log(
            `LeaveAccrualService: ${trainee.employee_code} - accrued ${newDays} days` +
            `(${monthsToAccrue} months x ${leaveType.accrual_per_month}) for "${leaveType.name}"`
        );
    }

    async _ensureBalanceRow(db, employeeId, leaveTypeId){
        await db.execute(`
            INSERT IGNORE INTO leave_accrual_balances
                (id, employee_id, leave_type_id, cumulative_accrued, cumulative_used, available_balance)
            VALUES (?, ?, ?, 0, 0, 0)    
            `,[uuidv4(), employeeId, leaveTypeId]);

    }

    async _reconcileUsed(db, employeeId, leaveTypeId) {
        const [result] = await db.execute(`
            SELECT COALESCE(SUM(days_requested),0) AS total_used
                FROM leave_requests
                WHERE status = 'approved' AND 
                employee_id = ? AND leave_type_id = ?
            `,[employeeId,leaveTypeId]);

        const totalUsed = parseFloat(result[0].total_used) || 0;

        await db.execute(`
            UPDATE leave_accrual_balances
                SET cumulative_used = ?
                WHERE employee_id = ? AND leave_type_id = ?
            `,[totalUsed, employeeId, leaveTypeId]);
    }

    _toDateStr(date){
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2,'0');
        return `${y}-${m}-01`;
    }

    _monthDiff(startDate,endDate){
        const y1 = startDate.getFullYear();
        const y2 = endDate.getFullYear();
        const m1 = startDate.getMonth();
        const m2 = endDate.getMonth();
        return (y2 - y1)*12 + m2 - m1;
    }
              
}

module.exports = new LeaveAccrualService();

