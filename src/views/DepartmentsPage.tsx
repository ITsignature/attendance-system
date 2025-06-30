import React, { useState } from "react";
import { TextInput, Button, Modal, Label } from "flowbite-react";
import { HiOutlinePlus } from "react-icons/hi";
import { useNavigate } from "react-router";

const departmentData = [
  {
    id:1,
    name: "Design Department",
    members: 20,
    employees: [
      { name: "Dianne Russell", role: "Lead UI/UX Designer", avatar: "https://randomuser.me/api/portraits/women/11.jpg" },
      { name: "Arlene McCoy", role: "Sr. UI/UX Designer", avatar: "https://randomuser.me/api/portraits/women/12.jpg" },
      { name: "Cody Fisher", role: "UI/UX Designer", avatar: "https://randomuser.me/api/portraits/men/13.jpg" },
      { name: "Theresa Webb", role: "UI/UX Designer", avatar: "https://randomuser.me/api/portraits/women/14.jpg" },
      { name: "Ronald Richards", role: "UI/UX Designer", avatar: "https://randomuser.me/api/portraits/men/15.jpg" },
    ],
  },
  {
     id:2,
    name: "Sales Department",
    members: 14,
    employees: [
      { name: "Darrell Steward", role: "Sr. Sales Manager", avatar: "https://randomuser.me/api/portraits/men/16.jpg" },
      { name: "Kristin Watson", role: "Sr. Sales Manager", avatar: "https://randomuser.me/api/portraits/women/17.jpg" },
      { name: "Courtney Henry", role: "BDM", avatar: "https://randomuser.me/api/portraits/women/18.jpg" },
      { name: "Kathryn Murphy", role: "BDE", avatar: "https://randomuser.me/api/portraits/women/19.jpg" },
      { name: "Albert Flores", role: "Sales", avatar: "https://randomuser.me/api/portraits/men/20.jpg" },
    ],
  },
  {
     id:3,
    name: "Project Manager Department",
    members: 18,
    employees: [
      { name: "Leslie Alexander", role: "Sr. Project Manager", avatar: "https://randomuser.me/api/portraits/men/21.jpg" },
      { name: "Ronald Richards", role: "Sr. Project Manager", avatar: "https://randomuser.me/api/portraits/men/22.jpg" },
      { name: "Savannah Nguyen", role: "Project Manager", avatar: "https://randomuser.me/api/portraits/women/23.jpg" },
      { name: "Eleanor Pena", role: "Project Manager", avatar: "https://randomuser.me/api/portraits/women/24.jpg" },
      { name: "Esther Howard", role: "Project Manager", avatar: "https://randomuser.me/api/portraits/women/25.jpg" },
    ],
  },
  {
     id:4,
    name: "Marketing Department",
    members: 10,
    employees: [
      { name: "Wade Warren", role: "Sr. Marketing Manager", avatar: "https://randomuser.me/api/portraits/men/26.jpg" },
      { name: "Brooklyn Simmons", role: "Sr. Marketing Manager", avatar: "https://randomuser.me/api/portraits/women/27.jpg" },
      { name: "Kristin Watson", role: "Marketing Coordinator", avatar: "https://randomuser.me/api/portraits/women/28.jpg" },
      { name: "Jacob Jones", role: "Marketing Coordinator", avatar: "https://randomuser.me/api/portraits/men/29.jpg" },
      { name: "Cody Fisher", role: "Marketing", avatar: "https://randomuser.me/api/portraits/men/30.jpg" },
    ],
  },
];


const DepartmentGrid = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const navigate = useNavigate();

  const filteredDepartments = departmentData.map((dept) => ({
    ...dept,
    employees: dept.employees.filter((emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  })).filter((dept) => dept.employees.length > 0);

  const handleCreateDepartment = () => {
    if (newDeptName.trim()) {
      alert(`New department "${newDeptName}" created!`);
      setNewDeptName("");
      setOpenModal(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <TextInput
          type="search"
          placeholder="Search"
          className="w-full max-w-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Button color="purple" className="ml-4 flex items-center gap-2" onClick={() => setOpenModal(true)}>  
          <HiOutlinePlus />
          Create Department
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {filteredDepartments.map((dept, idx) => (
          <div key={idx} className="border rounded-lg p-4"
          onClick={() => navigate(`/departments-employees`)}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-semibold text-base">{dept.name}</h3>
                <p className="text-xs text-gray-500">{dept.members} Members</p>
              </div>
             
            </div>
            <div className="space-y-3">
              {dept.employees.map((emp, i) => (
           <div
                  key={i}
                  className="flex justify-between items-center cursor-pointer"
                
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={emp.avatar}
                      alt={emp.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div>
                      <p className="text-sm font-medium">{emp.name}</p>
                      <p className="text-xs text-gray-500">{emp.role}</p>
                    </div>
                  </div>
                  <span className="text-gray-400">&gt;</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Modal show={openModal} onClose={() => setOpenModal(false)}>
        <Modal.Header>Create Department</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <Label htmlFor="deptName" value="Department Name" />
            <TextInput
              id="deptName"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              placeholder="Enter department name"
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button className="bg-purple-600 text-white py-2 px-4 rounded-md" onClick={handleCreateDepartment}>Create</button>
          <Button color="gray" onClick={() => setOpenModal(false)}>Cancel</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default DepartmentGrid;
