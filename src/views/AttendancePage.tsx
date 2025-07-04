import React, { useState } from "react";
import { TextInput, Select, Button } from "flowbite-react";
import { format } from "date-fns";

const mockData = [
  {
    name: "Leasie Watson",
    designation: "Team Lead - Design",
    type: "Office",
    checkIn: "09:27 AM",
    status: "On Time",
    avatar: "https://randomuser.me/api/portraits/women/11.jpg",
  },
  {
    name: "Darlene Robertson",
    designation: "Web Designer",
    type: "Office",
    checkIn: "10:15 AM",
    status: "Late",
    avatar: "https://randomuser.me/api/portraits/women/12.jpg",
  },
  // Add more records as needed
];

const AttendancePage = () => {
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());

  const filteredData = mockData.filter(
    (emp) =>
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.designation.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <TextInput
          type="text"
          placeholder="Search"
          className="max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button color="lime">
          {format(selectedDate, "MMM dd, yyyy")}
        </Button>
      </div>

      <table className="w-full text-sm text-left text-gray-600">
        <thead className="bg-gray-100 text-xs text-gray-500 uppercase">
          <tr>
            <th className="p-2">Employee Name</th>
            <th className="p-2">Designation</th>
            <th className="p-2">Type</th>
            <th className="p-2">Check In Time</th>
            <th className="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((emp, index) => (
            <tr key={index}>
              <td className="p-2 flex items-center gap-2">
                <img
                  src={emp.avatar}
                  alt={emp.name}
                  className="w-8 h-8 rounded-full"
                />
                <span>{emp.name}</span>
              </td>
              <td className="p-2">{emp.designation}</td>
              <td className="p-2">{emp.type}</td>
              <td className="p-2">{emp.checkIn}</td>
              <td className="p-2">
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    emp.status === "On Time"
                      ? "bg-green-100 text-green-600"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {emp.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AttendancePage;
