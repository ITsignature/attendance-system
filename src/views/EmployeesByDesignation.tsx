// src/pages/EmployeesByDesignation.tsx
import React from "react";
import { useParams } from "react-router-dom";
import { FaEye, FaEdit, FaTrash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const mockEmployees = [
  {
    id: "345321231",
    name: "Darlene Robertson",
    designation: "Lead UI/UX Designer",
    type: "Office",
    status: "Permanent",
    avatar: "/assets/images/avatars/avatar-1.jpg",
  },
  {
    id: "987890345",
    name: "Floyd Miles",
    designation: "Lead UI/UX Designer",
    type: "Office",
    status: "Permanent",
    avatar: "/assets/images/avatars/avatar-2.jpg",
  },
  {
    id: "453367122",
    name: "Cody Fisher",
    designation: "Sr. UI/UX Designer",
    type: "Remote",
    status: "Permanent",
    avatar: "/assets/images/avatars/avatar-3.jpg",
  },
  // Add more mock employees...
];

const EmployeesByDesignation = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();

  const filteredEmployees = mockEmployees.filter((emp) =>
    emp.designation.toLowerCase().includes(name?.toLowerCase() || "")
  );

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4">Employees: {name}</h2>

      {filteredEmployees.length === 0 ? (
        <p className="text-gray-500">No employees found for this designation.</p>
      ) : (
        <table className="w-full text-sm text-left text-gray-600">
          <thead className="bg-gray-100 text-xs text-gray-500 uppercase">
            <tr>
              <th className="p-2">Employee ID</th>
              <th className="p-2">Employee Name</th>
              <th className="p-2">Designation</th>
              <th className="p-2">Type</th>
              <th className="p-2">Status</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((emp) => (
              <tr key={emp.id} className="cusor-pointer bg-gray-50"
               onClick={() =>navigate(`/employee/${emp.id}`)}>

                <td className="p-2">{emp.id}</td>
                <td className="p-2 flex items-center gap-2">
                  <img
                    src={emp.avatar}
                    alt={emp.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  {emp.name}
                </td>
                <td className="p-2">{emp.designation}</td>
                <td className="p-2">{emp.type}</td>
                <td className="p-2">
                  <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">
                    {emp.status}
                  </span>
                </td>
                <td className="p-2 flex gap-2 text-purple-600">
                  <FaEye className="cursor-pointer" />
                  <FaEdit className="cursor-pointer" />
                  <FaTrash className="cursor-pointer" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default EmployeesByDesignation;
