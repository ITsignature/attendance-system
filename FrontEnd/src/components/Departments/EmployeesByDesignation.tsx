// src/pages/ManageDepartments.tsx
import { useEffect, useState } from "react";
import { Table, Button, TextInput, Badge, Textarea } from "flowbite-react";
import { HiOutlinePlus, HiTrash } from "react-icons/hi";
import apiService from "../../services/api";

interface Department {
  id: string;
  name: string;
  description?: string;
}

interface Designation {
  id: string;
  designation_name: string;
  responsibilities?: string;
  department_id: string;
}

const ManageDepartments = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");
  const [newDesigName, setNewDesigName] = useState("");
  const [newDesigResp, setNewDesigResp] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await apiService.getDepartmentsWithDesignations();
      setDepartments(res.data.departments);
      setDesignations(res.data.designations);
      console.log("depatments data", res.data);
    } catch (error) {
      console.error("Failed to load data", error);
    }
  };

  console.log("desa", departments);

  const handleAddDepartment = async () => {
    if (!newDeptName.trim()) return;
    try {
      await apiService.createDepartment({ name: newDeptName, description: newDeptDesc });
      setNewDeptName("");
      setNewDeptDesc("");
      fetchData();
    } catch (err) {
      console.error("Failed to create department", err);
    }
  };

  const handleAddDesignation = async () => {
    if (!newDesigName.trim() || !selectedDeptId) return;
    try {
      await apiService.createDesignation({ title: newDesigName, responsibilities: newDesigResp, department_id: selectedDeptId });
      setNewDesigName("");
      setNewDesigResp("");
      fetchData();
    } catch (err) {
      console.error("Failed to create designation", err);
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    try {
      await apiService.deleteDepartment(id);
      fetchData();
    } catch (err) {
      console.error("Failed to delete department", err);
    }
  };

  const handleDeleteDesignation = async (id: string) => {
    try {
      await apiService.deleteDesignation(id);
      fetchData();
    } catch (err) {
      console.error("Failed to delete designation", err);
    }
  };

  return (
    <div className="p-6 rounded-xl shadow-md bg-white dark:bg-darkgray w-full">
      <h2 className="text-2xl font-semibold mb-6">Manage Departments & Designations</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Department Section */}
        <div>
          <div className="flex flex-col gap-2 mb-4">
            <TextInput
              placeholder="New department name"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
            />
            <Textarea
              placeholder="Description (optional)"
              value={newDeptDesc}
              onChange={(e) => setNewDeptDesc(e.target.value)}
              rows={2}
            />
            <Button color="purple" onClick={handleAddDepartment} className="w-max">
              <HiOutlinePlus className="me-1" /> Add Department
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
                    {dept.description && <p className="text-sm text-gray-500 mt-1">{dept.description}</p>}
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
          <div className="flex flex-col gap-2 mb-4">
            <TextInput
              placeholder="New designation title"
              value={newDesigName}
              onChange={(e) => setNewDesigName(e.target.value)}
              disabled={!selectedDeptId}
            />
            <Textarea
              placeholder="Responsibilities (optional)"
              value={newDesigResp}
              onChange={(e) => setNewDesigResp(e.target.value)}
              rows={2}
              disabled={!selectedDeptId}
            />
            <Button color="purple" onClick={handleAddDesignation} disabled={!selectedDeptId} className="w-max">
              <HiOutlinePlus className="me-1" /> Add Designation
            </Button>
          </div>

          {selectedDeptId ? (
            <Table striped={false} hoverable={false} className="w-full">
              <Table.Head>
                <Table.HeadCell>Designation</Table.HeadCell>
                <Table.HeadCell>Responsibilities</Table.HeadCell>
                <Table.HeadCell>Actions</Table.HeadCell>
              </Table.Head>
              <Table.Body>
                {designations
                  .filter((d) => d.department_id === selectedDeptId)
                  .map((d) => (
                    <Table.Row key={d.id}>
                      <Table.Cell>{d.designation_name}</Table.Cell>
                      <Table.Cell>{d.responsibilities || <span className="text-gray-400 italic">—</span>}</Table.Cell>
                      <Table.Cell>
                        <Button size="xs" color="gray" onClick={() => handleDeleteDesignation(d.id)}>
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
