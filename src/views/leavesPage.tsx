import React, { useState } from "react";
import { Table, Select } from "flowbite-react";
import { useNavigate } from "react-router";
import { HiOutlinePlus } from "react-icons/hi";
import { Button } from "flowbite-react";


const leaveData = [
  {
    id  : 1,
    name: "Darlene Robertson",
    reason: "Personal reasons",
    avatar: "https://randomuser.me/api/portraits/women/1.jpg",
  },
  {
    id  : 2,
    name: "Floyd Miles",
    reason: "Medical appointment",
    avatar: "https://randomuser.me/api/portraits/men/2.jpg",
  },
  {
    id  : 3,
    name: "Cody Fisher",
    reason: "Family emergency",
    avatar: "https://randomuser.me/api/portraits/men/3.jpg",
  },
  {
    id  : 4,
    name: "Dianne Russell",
    reason: "Sick leave",
    avatar: "https://randomuser.me/api/portraits/women/4.jpg",
  },
  {
    id  : 5,
    name: "Savannah Nguyen",
    reason: "Urgent personal work",
    avatar: "https://randomuser.me/api/portraits/women/5.jpg",
  },
  {
    id  : 6,
    name: "Jacob Jones",
    reason: "Attending a wedding",
    avatar: "https://randomuser.me/api/portraits/men/6.jpg",
  },
  {
    id  : 7,
    name: "Marvin McKinney",
    reason: "Funeral",
    avatar: "https://randomuser.me/api/portraits/men/7.jpg",
  },
  {
    id  : 8,
    name: "Brooklyn Simmons",
    reason: "Travel commitment",
    avatar: "https://randomuser.me/api/portraits/women/8.jpg",
  },
  {
    id  : 9,
    name: "Kristin Watson",
    reason: "Childcare",
    avatar: "https://randomuser.me/api/portraits/women/9.jpg",
  },
  {
    id  : 10,
    name: "Kathryn Murphy",
    reason: "Rest due to illness",
    avatar: "https://randomuser.me/api/portraits/women/10.jpg",
  },
  {
    id  : 11,
    name: "Arlene McCoy",
    reason: "Sick leave",
    avatar: "https://randomuser.me/api/portraits/women/11.jpg",
  },
  {
    id  : 12,
    name: "Devon Lane",
    reason: "Family emergency",
    avatar: "https://randomuser.me/api/portraits/men/12.jpg",
  },
];

const LeavePage = () => {
  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [day, setDay] = useState(currentDate.getDate());
  const navigate = useNavigate();

  return (
    <div className="p-6 rounded-xl shadow-md bg-white dark:bg-darkgray space-y-6">
      {/* Date Filter */}
   <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-wrap">
  {/* Left: Date Selectors */}
  <div className="flex gap-4 flex-wrap">
    <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
      {[2023, 2024, 2025].map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </Select>
    <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
      {Array.from({ length: 12 }, (_, i) => (
        <option key={i + 1} value={i + 1}>
          {new Date(0, i).toLocaleString("default", { month: "long" })}
        </option>
      ))}
    </Select>
    <Select value={day} onChange={(e) => setDay(Number(e.target.value))}>
      {Array.from({ length: 31 }, (_, i) => (
        <option key={i + 1} value={i + 1}>
          {i + 1}
        </option>
      ))}
    </Select>
  </div>

  {/* Right: Button */}
  <div>
    <Button
      color="purple"
      className="flex items-center gap-2"
      onClick={() => navigate("/holidays")}
    >
     
      Holidays
    </Button>
  </div>
</div>


      {/* Leave Table */}
      <div className="overflow-x-auto">
        <Table>
          <Table.Head>
            <Table.HeadCell>Employee Name</Table.HeadCell>
            <Table.HeadCell>Leave Reason</Table.HeadCell>
          </Table.Head>
          <Table.Body className="divide-y">
            {leaveData.map((emp, index) => (
              <Table.Row key={index}
               className="cursor-pointer bg-gray-50"
               onClick={()=>navigate(`/employee/${emp.id}`)}>
                <Table.Cell>
                  <div className="flex items-center gap-3">
                    <img
                      src={emp.avatar}
                      alt={emp.name}
                      className="h-9 w-9 rounded-full object-cover"
                    />
                    <span>{emp.name}</span>
                  </div>
                </Table.Cell>
                <Table.Cell>{emp.reason}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </div>
  );
};

export default LeavePage;
