// src/pages/EmployeesByDesignation.tsx
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Table,
  TextInput,
  Badge,
  Button,
} from "flowbite-react";
import { HiOutlineFilter, HiOutlinePlus } from "react-icons/hi";

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
  const [searchTerm, setSearchTerm] = useState("");

  const filteredEmployees = mockEmployees.filter(
    (emp) =>
      emp.designation.toLowerCase().includes(name?.toLowerCase() || "") &&
      emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="rounded-xl shadow-md dark:shadow-dark-md bg-white dark:bg-darkgray p-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <TextInput
          type="search"
          placeholder="Search employee"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <div className="flex gap-2">
          <Button color="purple" className="flex items-center gap-2" onClick={() => navigate("/add-employee")}>
            <HiOutlinePlus className="text-lg" />
            Add New Employee
          </Button>
          <Button color="gray" className="flex items-center gap-2">
            <HiOutlineFilter className="text-lg" />
            Filter
          </Button>
        </div>
      </div>

      <h2 className="text-2xl font-semibold mb-4">Employees: {name}</h2>

      {filteredEmployees.length === 0 ? (
        <p className="text-gray-500">No employees found for this designation.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table hoverable>
            <Table.Head>
              <Table.HeadCell className="p-6">Employee Name</Table.HeadCell>
              <Table.HeadCell>Employee ID</Table.HeadCell>
              <Table.HeadCell>Designation</Table.HeadCell>
              <Table.HeadCell>Type</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
              <Table.HeadCell>Actions</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y divide-border dark:divide-darkborder">
              {filteredEmployees.map((emp, index) => (
                <Table.Row
                  key={index}
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => navigate(`/employee/${emp.id}`)}
                  
                >
                  <Table.Cell className="whitespace-nowrap ps-6">
                    <div className="flex items-center gap-3">
                      <img
                        src={emp.avatar}
                        alt={emp.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <span className="text-sm font-medium">{emp.name}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{emp.id}</Table.Cell>
                  <Table.Cell>{emp.designation}</Table.Cell>
                  <Table.Cell>{emp.type}</Table.Cell>
                  <Table.Cell>
                    <Badge color="lightsuccess" className="text-success">
                      {emp.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="flex gap-2 text-purple-600">
                    <Button size="xs" color="light" onClick={(e:any) => e.stopPropagation()}>
                      <HiOutlinePlus className="text-lg" />
                    </Button>
                    <Button size="xs" color="light" onClick={(e:any) => e.stopPropagation()}>
                      <HiOutlineFilter className="text-lg" />
                    </Button>
                    {/* Add your own action handlers here */}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}
    </div>
  );
};

export default EmployeesByDesignation;
