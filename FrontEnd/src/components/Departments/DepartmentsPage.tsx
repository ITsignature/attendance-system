// src/pages/ManageDepartments.tsx
import { useEffect, useState } from "react";
import { Table, Button, TextInput, Badge } from "flowbite-react";
import { HiOutlinePlus, HiTrash } from "react-icons/hi";
import apiService from "../../services/api";

interface Department {
  id: string;
  name: string;
}

interface Designation {
  id: string;
  name: string;
  department_id: string;
}

const ManageDepartments = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDesigName, setNewDesigName] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await apiService.getDepartmentsWithEmployees();
      setDepartments(res.data.departments);
      setDesignations(res.data.designations);
      console.log("depatments data",res.data);
    } catch (error) {
      console.error("Failed to load data", error);
    }
  };

  const handleAddDepartment = async () => {
    if (!newDeptName.trim()) return;
    await apiService.createDepartment({ name: newDeptName });
    setNewDeptName("");
    fetchData();
  };

  const handleAddDesignation = async () => {
    if (!newDesigName.trim() || !selectedDeptId) return;
    await apiService.createDesignation({ name: newDesigName, department_id: selectedDeptId });
    setNewDesigName("");
    fetchData();
  };

  const handleDeleteDepartment = async (id: string) => {
    await apiService.deleteDepartment(id);
    fetchData();
  };

  const handleDeleteDesignation = async (id: string) => {
    await apiService.deleteDesignation(id);
    fetchData();
  };

  return (
    <div className="p-6 rounded-xl shadow-md bg-white dark:bg-darkgray w-full">
      <h2 className="text-2xl font-semibold mb-6">Manage Departments & Designations</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Department Section */}
        <div>
          <div className="flex gap-2 mb-4">
            <TextInput
              placeholder="New department name"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
            />
            <Button color="purple" onClick={handleAddDepartment}>
              <HiOutlinePlus />
            </Button>
          </div>

          <Table striped={false} hoverable={false} className="w-full">
            <Table.Head>
              <Table.HeadCell>Department</Table.HeadCell>
              <Table.HeadCell>Actions</Table.HeadCell>
            </Table.Head>
            <Table.Body>
              {departments.map((dept) => (
                <Table.Row key={dept.id}>
                  <Table.Cell>
                    <Badge
                      className="cursor-pointer text-sm"
                      color={selectedDeptId === dept.id ? "purple" : "gray"}
                      onClick={() => setSelectedDeptId(dept.id)}
                    >
                      {dept.name}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Button size="xs" color="gray" onClick={() => handleDeleteDepartment(dept.id)}>
                      <HiTrash />
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>

        {/* Designation Section */}
        <div>
          <div className="flex gap-2 mb-4">
            <TextInput
              placeholder="New designation name"
              value={newDesigName}
              onChange={(e) => setNewDesigName(e.target.value)}
              disabled={!selectedDeptId}
            />
            <Button color="purple" onClick={handleAddDesignation} disabled={!selectedDeptId}>
              <HiOutlinePlus />
            </Button>
          </div>

          {selectedDeptId ? (
            <Table striped={false} hoverable={false} className="w-full">
              <Table.Head>
                <Table.HeadCell>Designation</Table.HeadCell>
                <Table.HeadCell>Actions</Table.HeadCell>
              </Table.Head>
              <Table.Body>
                {designations
                  .filter((d) => d.department_id === selectedDeptId)
                  .map((d) => (
                    <Table.Row key={d.id}>
                      <Table.Cell>{d.name}</Table.Cell>
                      <Table.Cell>
                        <Button
                          size="xs"
                          color="gray"
                          onClick={() => handleDeleteDesignation(d.id)}
                        >
                          <HiTrash />
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
              </Table.Body>
            </Table>
          ) : (
            <p className="text-gray-500">Select a department to view its designations.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageDepartments;
