import { Icon } from "@iconify/react";
import { Badge } from "flowbite-react";
import { useEffect, useState } from "react";
import { dashboardService } from "../../services/dashboardService";

const TotalEmployees = () => {
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [activeEmployees, setActiveEmployees] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployeeCount();
  }, []);

  const fetchEmployeeCount = async () => {
    try {
      setLoading(true);
      const response = await dashboardService.getOverview();
      if (response.success) {
        setTotalEmployees(response.data.employees.total_employees || 0);
        setActiveEmployees(response.data.employees.active_employees || 0);
      }
    } catch (error) {
      console.error('Error fetching employee count:', error);
    } finally {
      setLoading(false);
    }
  };

  const activePercentage = totalEmployees > 0
    ? Math.round((activeEmployees / totalEmployees) * 100)
    : 0;

  return (
    <>
      <div className="bg-white dark:bg-darkgray rounded-xl shadow-md dark:shadow-dark-md p-6 h-full">
        <div className="flex items-center gap-4 mb-6">
          <div className="bg-lightprimary text-primary p-3 rounded-md">
            <Icon icon="solar:users-group-rounded-linear" height={24} />
          </div>
          <p className="text-base font-semibold text-dark dark:text-white">Total Employees</p>
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
                  {totalEmployees}
                </p>
                <div className="flex items-center gap-2">
                  <Badge className="bg-lightsuccess text-success inline-flex">
                    {activeEmployees} Active
                  </Badge>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({activePercentage}%)
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default TotalEmployees;
