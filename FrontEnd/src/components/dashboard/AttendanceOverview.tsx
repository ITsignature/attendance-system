import { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import { useEffect, useState } from "react";
import { dashboardService } from "../../services/dashboardService";

interface WeeklyAttendanceData {
  day_name: string;
  date: string;
  total_records: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  on_leave_count: number;
  attendance_percentage: number;
}

const AttendanceOverview = () => {
  const [weeklyData, setWeeklyData] = useState<WeeklyAttendanceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWeeklyAttendance();
  }, []);

  const fetchWeeklyAttendance = async () => {
    try {
      setLoading(true);
      const response = await dashboardService.getAttendanceOverview();
      if (response.success) {
        setWeeklyData(response.data.weeklyAttendance || []);
      }
    } catch (error) {
      console.error('Error fetching weekly attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare data for chart - calculate percentages
  const calculatePercentages = () => {
    if (weeklyData.length === 0) {
      return {
        categories: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        onTimeData: [0, 0, 0, 0, 0, 0, 0],
        lateData: [0, 0, 0, 0, 0, 0],
        onLeaveData: [0, 0, 0, 0, 0, 0, 0],
      };
    }

    const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const dataMap = new Map(weeklyData.map(d => [d.day_name, d]));

    const onTimeData: number[] = [];
    const lateData: number[] = [];
    const onLeaveData: number[] = [];

    dayOrder.forEach(day => {
      const dayData = dataMap.get(day);
      if (dayData && dayData.total_records > 0) {
        const onTimePercent = Math.round((dayData.present_count / dayData.total_records) * 100);
        const latePercent = Math.round((dayData.late_count / dayData.total_records) * 100);
        const leavePercent = Math.round((dayData.on_leave_count / dayData.total_records) * 100);

        onTimeData.push(onTimePercent);
        lateData.push(latePercent);
        onLeaveData.push(leavePercent);
      } else {
        onTimeData.push(0);
        lateData.push(0);
        onLeaveData.push(0);
      }
    });

    return {
      categories: dayOrder,
      onTimeData,
      lateData,
      onLeaveData,
    };
  };

  const { categories, onTimeData, lateData, onLeaveData } = calculatePercentages();

  const attendanceData = {
    series: [
      {
        name: "On Time",
        data: onTimeData,
      },
      {
        name: "Late",
        data: lateData,
      },
      {
        name: "On Leave",
        data: onLeaveData,
      },
    ],
  };

  // Calculate averages
  const avgOnTime = onTimeData.length > 0
    ? Math.round(onTimeData.reduce((a, b) => a + b, 0) / onTimeData.filter(d => d > 0).length) || 0
    : 0;
  const avgLate = lateData.length > 0
    ? Math.round(lateData.reduce((a, b) => a + b, 0) / lateData.filter(d => d > 0).length) || 0
    : 0;
  const avgLeave = onLeaveData.length > 0
    ? Math.round(onLeaveData.reduce((a, b) => a + b, 0) / onLeaveData.filter(d => d > 0).length) || 0
    : 0;

  const optionsBarChart: ApexOptions = {
    chart: {
      offsetX: 0,
      offsetY: 10,
      stacked: true,
      stackType: "100%", 
      animations: {
        speed: 500,
      },
      toolbar: {
        show: false,
      },
    },
    colors: ["#22c55e", "#fbbf24", "#ef4444"], // Green, Yellow, Red
    dataLabels: {
      enabled: true,
      style: {
        fontSize: "12px",
        fontWeight: "bold",
        colors: ["#fff"]
      },
      formatter: function (val: number) {
        return val ? Math.round(val) + "%" : "";
      },
    },
    grid: {
      show: true,
      borderColor: "#90A4AE50",
      xaxis: {
        lines: {
          show: true
        }
      },
      yaxis: {
        lines: {
          show: true
        }
      },
    },
    stroke: {
      width: 1,
      colors: ["#fff"]
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "60%",
        borderRadius: 4,
        borderRadiusApplication: "end",
        borderRadiusWhenStacked: "all",
      },
    },
    xaxis: {
      categories: categories,
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      labels: {
        style: {
          fontSize: "12px",
        }
      }
    },
    yaxis: {
      min: 0,
      max: 100,
      tickAmount: 5,
      labels: {
        formatter: function (val: number) {
          return val + "%";
        },
      },
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "right",
      floating: false,
      fontSize: "13px",
      markers: {
        width: 12,
        height: 12,
        radius: 3,
      },
      itemMargin: {
        horizontal: 10,
        vertical: 5,
      },
    },
    tooltip: {
      theme: "dark",
      y: {
        formatter: function (val: number) {
          return val + "%";
        },
      },
    },
    responsive: [
      {
        breakpoint: 768,
        options: {
          legend: {
            position: "bottom",
            horizontalAlign: "center",
          },
          xaxis: {
            labels: {
              rotate: -45,
            }
          }
        },
      },
    ],
  };

  return (
    <div className="rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray p-6 relative w-full break-words">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h5 className="card-title text-xl font-semibold">Employee Attendance Overview</h5>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">This Week's Attendance Status</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[350px]">
          <div className="animate-pulse text-gray-400">Loading attendance data...</div>
        </div>
      ) : (
        <>
          <div className="-ms-4 -me-3 mt-2">
            <Chart
              options={optionsBarChart}
              series={attendanceData.series}
              type="bar"
              height="350px"
              width="100%"
            />
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{avgOnTime}%</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Average On Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">{avgLate}%</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Average Late</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{avgLeave}%</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Average On Leave</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export { AttendanceOverview };