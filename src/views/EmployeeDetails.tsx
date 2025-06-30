import React, { useState } from "react";
import { Tabs, Button, Select } from "flowbite-react";
import { HiUser, HiBriefcase, HiDocumentText } from "react-icons/hi";
import { FaEye, FaDownload } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";

const employeeDetails = {
  personal: {
    firstName: "Brooklyn",
    lastName: "Simmons",
    mobile: "(702) 555-0122",
    email: "brooklyn.s@example.com",
    dob: "July 14, 1995",
    maritalStatus: "Married",
    gender: "Female",
    nationality: "America",
    address: "2464 Royal Ln. Mesa, New Jersey",
    city: "California",
    state: "United State",
    zip: "35624",
  },
  professional: {
    empId: "879912390",
    username: "brooklyn_simmons",
    type: "Office",
    email: "brooklyn.s@example.com",
    department: "Project Manager",
    designation: "Project Manager",
    workingDays: "5 Days",
    joiningDate: "July 10, 2022",
    location: "2464 Royal Ln. Mesa, New Jersey",
  },
  documents: [
    "Appointment Letter.pdf",
    "Salary Slip_May.pdf",
    "Reliving Letter.pdf",
    "Salary Slip_June.pdf",
    "Salary Slip_April.pdf",
    "Experience Letter.pdf",
  ],
  attendance: [
    ["July 01, 2023", "09:28 AM", "07:00 PM", "00:30 Min", "09:02 Hrs", "On Time"],
    ["July 02, 2023", "09:20 AM", "07:00 PM", "00:20 Min", "09:20 Hrs", "On Time"],
    ["July 03, 2023", "09:25 AM", "07:00 PM", "00:30 Min", "09:05 Hrs", "On Time"],
    ["July 04, 2023", "09:45 AM", "07:00 PM", "00:40 Min", "08:35 Hrs", "Late"],
    ["July 05, 2023", "10:00 AM", "07:00 PM", "00:30 Min", "08:30 Hrs", "Late"],
  ],
  leave: [
    ["June, 2023", "June 05 - June 08", "3 Days", "Mark Williams", "Pending"],
    ["Apr, 2023", "Apr 06 - Apr 10", "4 Days", "Mark Williams", "Approved"],
    ["Mar, 2023", "Mar 14 - Mar 16", "2 Days", "Mark Williams", "Approved"],
    ["Feb, 2023", "Feb 02 - Feb 10", "8 Days", "Mark Williams", "Approved"],
    ["Jan, 2023", "Jan 16 - Jan 19", "3 Days", "Mark Williams", "Reject"],
  ],
};

interface FieldProps {
  label: string;
  value: string;
}

const ViewEmployeeDetails = () => {


   const navigate = useNavigate();
  const params = useParams();
  const [activeSidebarTab, setActiveSidebarTab] = useState("Profile");
  const [attendanceMonth, setAttendanceMonth] = useState("July , 2023");
  const [leaveMonth, setLeaveMonth] = useState("Jun , 2023");

  const sidebarTabs = ["Profile", "Attendance", "Leave"];

  return (
    <div className="p-6 bg-white rounded-xl shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <img
            src="https://via.placeholder.com/60"
            alt="avatar"
            className="w-16 h-16 rounded-full object-cover"
          />
          <div>
            <h4 className="text-lg font-semibold">{employeeDetails.personal.firstName} {employeeDetails.personal.lastName}</h4>
            <p className="text-sm text-gray-500">{employeeDetails.professional.designation}</p>
            <p className="text-sm text-gray-500">{employeeDetails.personal.email}</p>
          </div>
        </div>
        <Button color="purple" onClick={() => navigate(`/edit-employee/${params.id}`)}>Edit Profile</Button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-1/5">
          <div className="bg-gray-100 h-full rounded-lg p-6">
            <ul className="space-y-3">
              {sidebarTabs.map((tab) => (
                <li
                  key={tab}
                  onClick={() => setActiveSidebarTab(tab)}
                  className={`cursor-pointer hover:underline-purple ${
                    activeSidebarTab === tab
                      ? "text-purple-600 font-semibold"
                      : "text-gray-600"
                  }`}
                >
                  {tab}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Main Content */}
        <div className="w-4/5 ps-6">
          {activeSidebarTab === "Profile" && (
            <Tabs aria-label="Employee Info Tabs">
              <Tabs.Item title="Personal Information" icon={HiUser}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {Object.entries(employeeDetails.personal).map(([key, value]) => (
                    <Field key={key} label={key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase())} value={value} />
                  ))}
                </div>
              </Tabs.Item>

              <Tabs.Item title="Professional Information" icon={HiBriefcase}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {Object.entries(employeeDetails.professional).map(([key, value]) => (
                    <Field key={key} label={key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase())} value={value} />
                  ))}
                </div>
              </Tabs.Item>

              <Tabs.Item title="Documents" icon={HiDocumentText}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {employeeDetails.documents.map((file, i) => (
                    <div
                      key={i}
                      className="border border-gray-300 rounded-md px-4 py-3 flex justify-between items-center"
                    >
                      <p className="text-sm font-medium text-gray-700">{file}</p>
                      <div className="flex gap-4 text-purple-600">
                        <FaEye className="cursor-pointer" />
                        <FaDownload className="cursor-pointer" />
                      </div>
                    </div>
                  ))}
                </div>
              </Tabs.Item>
            </Tabs>
          )}

          {activeSidebarTab === "Attendance" && (
            <div>
              <div className="flex justify-end mb-3">
                <Select
                  value={attendanceMonth}
                  onChange={(e) => setAttendanceMonth(e.target.value)}
                  className="w-fit text-sm text-white"
                >
                  <option>July , 2023</option>
                  <option>June , 2023</option>
                  <option>May , 2023</option>
                </Select>
              </div>
              <table className="w-full text-sm text-left text-gray-600">
                <thead className="bg-gray-100 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="p-2">Date</th>
                    <th className="p-2">Check In</th>
                    <th className="p-2">Check Out</th>
                    <th className="p-2">Break</th>
                    <th className="p-2">Working Hours</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeDetails.attendance.map(([date, inTime, outTime, breakTime, hours, status], i) => (
                    <tr key={i}>
                      <td className="p-2">{date}</td>
                      <td className="p-2">{inTime}</td>
                      <td className="p-2">{outTime}</td>
                      <td className="p-2">{breakTime}</td>
                      <td className="p-2">{hours}</td>
                      <td className="p-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            status === "Late"
                              ? "bg-red-100 text-red-600"
                              : "bg-green-100 text-green-600"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeSidebarTab === "Leave" && (
            <div>
              <div className="flex justify-end mb-3">
                <Select
                  value={leaveMonth}
                  onChange={(e) => setLeaveMonth(e.target.value)}
                  className="w-fit text-sm text-white"
                >
                  <option>Jun , 2023</option>
                  <option>May , 2023</option>
                  <option>Apr , 2023</option>
                </Select>
              </div>
              <table className="w-full text-sm text-left text-gray-600">
                <thead className="bg-gray-100 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="p-2">Month</th>
                    <th className="p-2">Duration</th>
                    <th className="p-2">Days</th>
                    <th className="p-2">Reporting Manager</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeDetails.leave.map(([month, duration, days, manager, status], i) => (
                    <tr key={i}>
                      <td className="p-2">{month}</td>
                      <td className="p-2">{duration}</td>
                      <td className="p-2">{days}</td>
                      <td className="p-2">{manager}</td>
                      <td className="p-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            status === "Approved"
                              ? "bg-green-100 text-green-600"
                              : status === "Reject"
                              ? "bg-red-100 text-red-600"
                              : "bg-yellow-100 text-yellow-600"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value }:FieldProps) => (
  <div>
    <p className="text-xs text-gray-400 mb-1">{label}</p>
    <p className="font-medium text-gray-800 text-sm">{value}</p>
  </div>
);

export default ViewEmployeeDetails;
