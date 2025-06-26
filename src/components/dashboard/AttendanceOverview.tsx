
//import React, { useState } from "react";
import { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts"

const AttendanceOverview = () => {
  const attendanceData = {
    series: [
      {
        name: "On Time",
        data: [85, 78, 92, 88, 75, 0, 0], 
      },
      {
        name: "Late",
        data: [10, 15, 5, 8, 20, 0, 0], 
      },
      {
        name: "On Leave",
        data: [5, 7, 3, 4, 5, 0, 0], 
      },
    ],
  };

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
      categories: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
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

      {/* Legend with color indicators */}
      {/* <div className="flex flex-wrap gap-4 mb-4 text-sm"> */}
        {/* <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span>OTimen </span>
        </div> */}
        {/* <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-400 rounded"></div>
          <span>Late</span>
        </div> */}
        {/* <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>On Leave</span>
        </div> */}
      {/* </div> */}

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
          <div className="text-2xl font-bold text-green-500">84%</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Average On Time</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-500">12%</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Average Late</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-500">4%</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Average On Leave</div>
        </div>
      </div>
    </div>
  );
};

export { AttendanceOverview };