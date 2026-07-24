import { Icon } from "@iconify/react";
import { Badge } from "flowbite-react";
import { useEffect, useState } from "react";
import { dashboardService } from "../../services/dashboardService";

const AbsentToday = () => {
  const [absentCount, setAbsentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAbsentCount();
  }, []);

  const fetchAbsentCount = async () => {
    try {
      setLoading(true);
      const response = await dashboardService.getOverview();
      if (response.success) {
        setAbsentCount(response.data.attendance.absent_today || 0);
      }
    } catch (error) {
      console.error('Error fetching absent count:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-darkgray rounded-xl shadow-md dark:shadow-dark-md p-3 sm:p-6 h-full">
        <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-6">
          <div className="bg-lightwarning text-warning p-2 sm:p-3 rounded-md shrink-0">
            <Icon icon="solar:user-cross-rounded-linear" height={20} className="sm:hidden" />
            <Icon icon="solar:user-cross-rounded-linear" height={24} className="hidden sm:block" />
          </div>
          <p className="text-sm sm:text-base font-semibold text-dark dark:text-white">Absent Today</p>
        </div>
        <div className="flex flex-col">
          <div className="flex-1">
            {loading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2"></div>
              </div>
            ) : (
              <>
                <p className="text-2xl sm:text-3xl text-dark dark:text-white font-semibold mb-2">
                  {absentCount}
                </p>
                {absentCount > 0 && (
                  <Badge className="bg-lightwarning text-warning inline-flex">
                    Requires Attention
                  </Badge>
                )}
                {absentCount === 0 && (
                  <Badge className="bg-lightsuccess text-success inline-flex">
                    Perfect Attendance
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AbsentToday;
