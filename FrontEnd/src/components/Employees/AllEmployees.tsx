// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React, { useState } from "react";
import { Badge, Dropdown, Table, Button, TextInput, Checkbox } from "flowbite-react";
import { HiOutlineDotsVertical, HiOutlinePlus, HiOutlineFilter } from "react-icons/hi";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import { DynamicProtectedComponent } from "../RBACSystem/rbacSystem";

// Sample avatars (replace with real employee avatars)
import avatar1 from "/src/assets/images/products/dash-prd-1.jpg";
import avatar2 from "/src/assets/images/products/dash-prd-2.jpg";
import avatar3 from "/src/assets/images/products/dash-prd-3.jpg";

const EmployeeTable = () => {
  const navigate = useNavigate();
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  
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
    // Add more sample employees
    {
      img: avatar1,
      name: "Brooklyn Simmons",
      id: "123456789",
      department: "Marketing",
      designation: "Marketing Manager",
      type: "Hybrid",
      status: "Permanent",
    },
    {
      img: avatar2,
      name: "Ronald Richards",
      id: "987654321",
      department: "HR",
      designation: "HR Specialist",
      type: "Office",
      status: "Contract",
    },
  ];

  const tableActionData = [
    { 
      icon: "solar:eye-outline", 
      listtitle: "View", 
      permission: "employees.view",
      action: (empId: string) => navigate(`/employee/${empId}`)
    },
    { 
      icon: "solar:pen-new-square-broken", 
      listtitle: "Edit", 
      permission: "employees.edit",
      action: (empId: string) => navigate(`/edit-employee/${empId}`)
    },
    { 
      icon: "solar:trash-bin-minimalistic-outline", 
      listtitle: "Delete", 
      permission: "employees.delete",
      action: (empId: string) => handleDeleteEmployee(empId)
    },
  ];

  const handleDeleteEmployee = (empId: string) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      // Handle delete logic here
      console.log('Deleting employee:', empId);
      // In real app: call API to delete employee
    }
  };

  const handleSelectEmployee = (empId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(empId) 
        ? prev.filter(id => id !== empId)
        : [...prev, empId]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(EmployeeData.map(emp => emp.id));
    }
    setSelectAll(!selectAll);
  };

  const handleBulkDelete = () => {
    if (selectedEmployees.length === 0) {
      alert('Please select employees to delete');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete ${selectedEmployees.length} selected employees?`)) {
      console.log('Deleting employees:', selectedEmployees);
      // In real app: call API to delete selected employees
      setSelectedEmployees([]);
      setSelectAll(false);
    }
  };

  const handleRowClick = (empId: string, event: React.MouseEvent) => {
    // Don't navigate if clicking on checkbox, dropdown, or action buttons
    const target = event.target as HTMLElement;
    if (target.closest('input[type="checkbox"]') || 
        target.closest('.dropdown-trigger') || 
        target.closest('button')) {
      return;
    }
    navigate(`/employee/${empId}`);
  };

  return (
    <div className="rounded-xl shadow-md dark:shadow-dark-md bg-white dark:bg-darkgray p-6 w-full">
      {/* Header: Search, Add Employee, Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <TextInput
          type="search"
          placeholder="Search employees..."
          className="w-full sm:max-w-xs"
        />
        <div className="flex gap-2">
          {/* PROTECTED: Add Employee Button - Only for users who can create employees */}
          <DynamicProtectedComponent permission="employees.create">
            <Button 
              color="purple" 
              className="flex items-center gap-2" 
              onClick={() => navigate("/add-employee")}
            >
              <HiOutlinePlus className="text-lg" />
              Add New Employee
            </Button>
          </DynamicProtectedComponent>
          
          {/* PROTECTED: Filter Button - Only for users who can view employees */}
          <DynamicProtectedComponent permission="employees.view">
            <Button color="gray" className="flex items-center gap-2">
              <HiOutlineFilter className="text-lg" />
              Filter
            </Button>
          </DynamicProtectedComponent>
        </div>
      </div>

      {/* Employee Table */}
      <div className="overflow-x-auto">
        <Table hoverable>
          <Table.Head>
            {/* PROTECTED: Select All Checkbox - Only for users who can delete */}
            <DynamicProtectedComponent 
              permission="employees.delete"
              fallback={<Table.HeadCell className="w-4"></Table.HeadCell>}
            >
              <Table.HeadCell className="w-4">
                <Checkbox
                  checked={selectAll}
                  onChange={handleSelectAll}
                />
              </Table.HeadCell>
            </DynamicProtectedComponent>
            
            <Table.HeadCell className="p-6">Employee Name</Table.HeadCell>
            <Table.HeadCell>Employee ID</Table.HeadCell>
            <Table.HeadCell>Department</Table.HeadCell>
            <Table.HeadCell>Designation</Table.HeadCell>
            <Table.HeadCell>Type</Table.HeadCell>
            <Table.HeadCell>Status</Table.HeadCell>
            
            {/* PROTECTED: Actions Column - Only show if user has any employee management permissions */}
            <DynamicProtectedComponent 
              permissions={["employees.edit", "employees.delete"]}
              fallback={null}
            >
              <Table.HeadCell>Actions</Table.HeadCell>
            </DynamicProtectedComponent>
          </Table.Head>
          <Table.Body className="divide-y divide-border dark:divide-darkborder">
            {EmployeeData.map((emp, index) => (
              <Table.Row 
                key={index}
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={(e) => handleRowClick(emp.id, e)}
              >
                {/* PROTECTED: Select Checkbox - Only for users who can delete */}
                <DynamicProtectedComponent 
                  permission="employees.delete"
                  fallback={<Table.Cell className="w-4"></Table.Cell>}
                >
                  <Table.Cell className="w-4">
                    <Checkbox
                      checked={selectedEmployees.includes(emp.id)}
                      onChange={() => handleSelectEmployee(emp.id)}
                      onClick={(e) => e.stopPropagation()} // Prevent row click
                    />
                  </Table.Cell>
                </DynamicProtectedComponent>

                {/* Employee Name */}
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
                  <Badge 
                    color={emp.status === 'Permanent' ? 'green' : 'blue'} 
                    className={emp.status === 'Permanent' ? 'text-green-600' : 'text-blue-600'}
                  >
                    {emp.status}
                  </Badge>
                </Table.Cell>
                
                {/* PROTECTED: Action Dropdown - Only show if user has management permissions */}
                <DynamicProtectedComponent 
                  permissions={["employees.edit", "employees.delete"]}
                  fallback={<Table.Cell></Table.Cell>}
                >
                  <Table.Cell>
                    <Dropdown
                      label=""
                      dismissOnClick={false}
                      renderTrigger={() => (
                        <span 
                          className="dropdown-trigger h-9 w-9 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer"
                          onClick={(e) => e.stopPropagation()} // Prevent row click
                        >
                          <HiOutlineDotsVertical size={22} />
                        </span>
                      )}
                    >
                      {tableActionData.map((action, idx) => (
                        <DynamicProtectedComponent 
                          key={idx}
                          permission={action.permission}
                        >
                          <Dropdown.Item 
                            className="flex gap-3"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row click
                              action.action(emp.id);
                            }}
                          >
                            <Icon icon={action.icon} height={18} />
                            <span>{action.listtitle}</span>
                          </Dropdown.Item>
                        </DynamicProtectedComponent>
                      ))}
                    </Dropdown>
                  </Table.Cell>
                </DynamicProtectedComponent>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>

      {/* PROTECTED: Bulk Actions - Only for users with delete permissions */}
      <DynamicProtectedComponent permission="employees.delete">
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Selected: {selectedEmployees.length} employees
            </span>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                color="red" 
                disabled={selectedEmployees.length === 0}
                onClick={handleBulkDelete}
              >
                Delete Selected ({selectedEmployees.length})
              </Button>
              <Button 
                size="sm" 
                color="blue" 
                disabled={selectedEmployees.length === 0}
              >
                Export Selected ({selectedEmployees.length})
              </Button>
              {selectedEmployees.length > 0 && (
                <Button 
                  size="sm" 
                  color="gray"
                  onClick={() => {
                    setSelectedEmployees([]);
                    setSelectAll(false);
                  }}
                >
                  Clear Selection
                </Button>
              )}
            </div>
          </div>
        </div>
      </DynamicProtectedComponent>

      {/* PROTECTED: Employee Statistics - Only for managers and above */}
      <DynamicProtectedComponent 
        permissions={["employees.view", "attendance.reports"]}
        requireAll={true}
      >
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-blue-600">Total Employees</h3>
            <p className="text-2xl font-bold text-blue-800">{EmployeeData.length}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-green-600">Permanent</h3>
            <p className="text-2xl font-bold text-green-800">
              {EmployeeData.filter(emp => emp.status === 'Permanent').length}
            </p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-yellow-600">Contract</h3>
            <p className="text-2xl font-bold text-yellow-800">
              {EmployeeData.filter(emp => emp.status === 'Contract').length}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-purple-600">Remote Workers</h3>
            <p className="text-2xl font-bold text-purple-800">
              {EmployeeData.filter(emp => emp.type === 'Remote').length}
            </p>
          </div>
        </div>
      </DynamicProtectedComponent>
    </div>
  );
};

export default EmployeeTable;