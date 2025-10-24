import { Icon } from "@iconify/react";
import { Badge } from "flowbite-react";
import { useEffect, useState } from "react";
import { dashboardService } from "../../services/dashboardService";

const TodayAttendance = () => {
  const [presentCount, setPresentCount] = useState(0);
  const [lateCount, setLateCount] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendanceData();
  }, []);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      const response = await dashboardService.getOverview();
      if (response.success) {
        setPresentCount(response.data.attendance.present_today || 0);
        setLateCount(response.data.attendance.late_today || 0);
        setTotalRecords(response.data.attendance.total_records || 0);
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const attendancePercentage = totalRecords > 0
    ? Math.round((presentCount / totalRecords) * 100)
    : 0;

  return (
    <>
      <div className="bg-white dark:bg-darkgray rounded-xl shadow-md dark:shadow-dark-md p-6 h-full">
        <div className="flex items-center gap-4 mb-6">
          <div className="bg-lightsuccess text-success p-3 rounded-md">
            <Icon icon="solar:user-check-rounded-linear" height={24} />
          </div>
          <p className="text-base font-semibold text-dark dark:text-white">Present Today</p>
        </div>
        <div className="flex flex-col">
          <div className="flex-1">
            {loading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2"></div>
              </div>
            ) : (
              <>
                <p className="text-3xl text-dark dark:text-white font-semibold mb-2">
                  {presentCount}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-lightsuccess text-success inline-flex">
                    {attendancePercentage}% Rate
                  </Badge>
                  {lateCount > 0 && (
                    <Badge className="bg-lightwarning text-warning inline-flex">
                      {lateCount} Late
                    </Badge>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default TodayAttendance;
