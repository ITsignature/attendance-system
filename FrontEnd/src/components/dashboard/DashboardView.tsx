import {AttendanceOverview} from 'src/components/dashboard/AttendanceOverview';
import TotalEmployees from 'src/components/dashboard/TotalEmployees';
import TodayAttendance from 'src/components/dashboard/TodayAttendance';
import OnLeaveToday from 'src/components/dashboard/OnLeaveToday';
import AbsentToday from 'src/components/dashboard/AbsentToday';
import TodayEmployeeAttendance from 'src/components/dashboard/TodayEmployeeAttendance';

const Dashboard = () => {
  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Key Metrics Row */}
      <div className="col-span-12 lg:col-span-3">
        <TotalEmployees />
      </div>
      <div className="col-span-12 lg:col-span-3">
        <TodayAttendance />
      </div>
      <div className="col-span-12 lg:col-span-3">
        <AbsentToday />
      </div>
      <div className="col-span-12 lg:col-span-3">
        <OnLeaveToday />
      </div>

      {/* Weekly Attendance Overview */}
      <div className="col-span-12">
        <AttendanceOverview />
      </div>

      {/* Today's Employee Attendance Table */}
      <div className="col-span-12">
        <TodayEmployeeAttendance />
      </div>
    </div>
  );
};

export default Dashboard;
