import { Icon } from "@iconify/react";
import { Badge } from "flowbite-react";
import { useEffect, useState } from "react";
import { dashboardService } from "../../services/dashboardService";

const OnLeaveToday = () => {
  const [onLeaveCount, setOnLeaveCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaveData();
  }, []);

  const fetchLeaveData = async () => {
    try {
      setLoading(true);
      const response = await dashboardService.getOverview();
      if (response.success) {
        setOnLeaveCount(response.data.attendance.on_leave_today || 0);
        setPendingRequests(response.data.leaves.pending_requests || 0);
      }
    } catch (error) {
      console.error('Error fetching leave data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-darkgray rounded-xl shadow-md dark:shadow-dark-md p-6 h-full">
        <div className="flex items-center gap-4 mb-6">
          <div className="bg-lightinfo text-info p-3 rounded-md">
            <Icon icon="solar:calendar-mark-linear" height={24} />
          </div>
          <p className="text-base font-semibold text-dark dark:text-white">On Leave Today</p>
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
                  {onLeaveCount}
                </p>
                {pendingRequests > 0 && (
                  <Badge className="bg-lightwarning text-warning inline-flex">
                    {pendingRequests} Pending
                  </Badge>
                )}
                {pendingRequests === 0 && onLeaveCount === 0 && (
                  <Badge className="bg-lightsuccess text-success inline-flex">
                    All Available
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

export default OnLeaveToday;
