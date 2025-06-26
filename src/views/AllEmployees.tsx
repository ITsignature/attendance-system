// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from "react";
import { Badge, Dropdown, Table, Button, TextInput } from "flowbite-react";
import { HiOutlineDotsVertical, HiOutlinePlus, HiOutlineFilter } from "react-icons/hi";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";

// Sample avatars (replace with real employee avatars)
import avatar1 from "/src/assets/images/products/dash-prd-1.jpg";
import avatar2 from "/src/assets/images/products/dash-prd-2.jpg";
import avatar3 from "/src/assets/images/products/dash-prd-3.jpg";

const EmployeeTable = () => {
  const navigate = useNavigate();
  
  const EmployeeData = [
    {
      img: avatar1,
      name: "Darlene Robertson",
      id: "345321231",
      department: "Design",
      designation: "UI/UX Designer",
      type: "Office",
      status: "Permanent",
    },
    {
      img: avatar2,
      name: "Floyd Miles",
      id: "987890345",
      department: "Development",
      designation: "PHP Developer",
      type: "Office",
      status: "Permanent",
    },
    {
      img: avatar3,
      name: "Dianne Russell",
      id: "345321231",
      department: "Sales",
      designation: "BDM",
      type: "Remote",
      status: "Permanent",
    },
    // Repeat or add more entries...
  ];

  const tableActionData = [
    { icon: "solar:add-circle-outline", listtitle: "Add" },
    { icon: "solar:pen-new-square-broken", listtitle: "Edit" },
    { icon: "solar:trash-bin-minimalistic-outline", listtitle: "Delete" },
  ];

  return (
    <div className="rounded-xl shadow-md dark:shadow-dark-md bg-white dark:bg-darkgray p-6 w-full">
      {/* Header: Search, Add Employee, Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <TextInput
          type="search"
          placeholder="Search"
          className="w-full sm:max-w-xs"
        />
        <div className="flex gap-2">
          <Button color="purple" className="flex items-center gap-2" onClick={()=>navigate("/add-employee")}>
            <HiOutlinePlus className="text-lg" />
            Add New Employee
          </Button>
          <Button color="gray" className="flex items-center gap-2">
            <HiOutlineFilter className="text-lg" />
            Filter
          </Button>
        </div>
      </div>

      {/* Employee Table */}
      <div className="overflow-x-auto">
        <Table hoverable>
          <Table.Head>
            <Table.HeadCell className="p-6">Employee Name</Table.HeadCell>
            <Table.HeadCell>Employee ID</Table.HeadCell>
            <Table.HeadCell>Department</Table.HeadCell>
            <Table.HeadCell>Designation</Table.HeadCell>
            <Table.HeadCell>Type</Table.HeadCell>
            <Table.HeadCell>Status</Table.HeadCell>
            <Table.HeadCell />
          </Table.Head>
          <Table.Body className="divide-y divide-border dark:divide-darkborder">
            {EmployeeData.map((emp, index) => (
              <Table.Row key={index}>
                <Table.Cell className="whitespace-nowrap ps-6">
                  <div className="flex items-center gap-3">
                    <img
                      src={emp.img}
                      alt={emp.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <span className="text-sm font-medium">{emp.name}</span>
                  </div>
                </Table.Cell>
                <Table.Cell>{emp.id}</Table.Cell>
                <Table.Cell>{emp.department}</Table.Cell>
                <Table.Cell>{emp.designation}</Table.Cell>
                <Table.Cell>{emp.type}</Table.Cell>
                <Table.Cell>
                  <Badge color="lightsuccess" className="text-success">
                    {emp.status}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Dropdown
                    label=""
                    dismissOnClick={false}
                    renderTrigger={() => (
                      <span className="h-9 w-9 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer">
                        <HiOutlineDotsVertical size={22} />
                      </span>
                    )}
                  >
                    {tableActionData.map((action, idx) => (
                      <Dropdown.Item key={idx} className="flex gap-3">
                        <Icon icon={action.icon} height={18} />
                        <span>{action.listtitle}</span>
                      </Dropdown.Item>
                    ))}
                  </Dropdown>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </div>
  );
};

export default EmployeeTable;
