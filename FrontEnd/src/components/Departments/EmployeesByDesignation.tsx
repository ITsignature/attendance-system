// src/pages/ManageDepartments.tsx
import { useEffect, useState } from "react";
import { Table, Button, TextInput, Badge, Textarea, Modal, Label, Alert } from "flowbite-react";
import { HiOutlinePlus, HiTrash, HiPencil } from "react-icons/hi";
import apiService from "../../services/api";
import { DynamicProtectedComponent, useDynamicRBAC } from "../RBACSystem/rbacSystem";

interface Department {
  id: string;
  name: string;
  description?: string;
  employee_count?: number;
}

interface Designation {
  id: string;
  designation_name: string;
  title?: string;
  responsibilities?: string;
  department_id: string;
}

const ManageDepartments = () => {
  const { hasPermission } = useDynamicRBAC();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  // Department form state
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptFormData, setDeptFormData] = useState({ name: "", description: "" });

  // Designation form state
  const [showDesigModal, setShowDesigModal] = useState(false);
  const [editingDesig, setEditingDesig] = useState<Designation | null>(null);
  const [desigFormData, setDesigFormData] = useState({ name: "", responsibilities: "" });

  // Delete confirmation modals
  const [showDeleteDeptModal, setShowDeleteDeptModal] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [showDeleteDesigModal, setShowDeleteDesigModal] = useState(false);
  const [desigToDelete, setDesigToDelete] = useState<Designation | null>(null);

  // Notifications
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await apiService.getDepartmentsWithDesignations();
      setDepartments(res.data.departments || []);
      setDesignations(res.data.designations || []);
    } catch (error: any) {
      showError(error.message || "Failed to load data");
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(""), 5000);
  };

  // ========== DEPARTMENT HANDLERS ==========
  const openAddDeptModal = () => {
    setEditingDept(null);
    setDeptFormData({ name: "", description: "" });
    setShowDeptModal(true);
  };

  const openEditDeptModal = (dept: Department) => {
    setEditingDept(dept);
    setDeptFormData({ name: dept.name, description: dept.description || "" });
    setShowDeptModal(true);
  };

  const handleSaveDepartment = async () => {
    if (!deptFormData.name.trim()) {
      showError("Department name is required");
      return;
    }

    try {
      if (editingDept) {
        // Update
        await apiService.apiCall(`/api/departments/${editingDept.id}`, {
          method: "PUT",
          body: JSON.stringify(deptFormData),
        });
        showSuccess("Department updated successfully");
      } else {
        // Create
        await apiService.createDepartment(deptFormData);
        showSuccess("Department created successfully");
      }
      setShowDeptModal(false);
      fetchData();
    } catch (error: any) {
      showError(error.message || "Operation failed");
    }
  };

  const openDeleteDeptModal = (dept: Department) => {
    setDeptToDelete(dept);
    setShowDeleteDeptModal(true);
  };

  const handleDeleteDepartment = async () => {
    if (!deptToDelete) return;

    try {
      await apiService.deleteDepartment(deptToDelete.id);
      showSuccess("Department deleted successfully");
      setShowDeleteDeptModal(false);
      setDeptToDelete(null);
      if (selectedDeptId === deptToDelete.id) {
        setSelectedDeptId(null);
      }
      fetchData();
    } catch (error: any) {
      showError(error.message || "Failed to delete department");
      setShowDeleteDeptModal(false);
    }
  };

  // ========== DESIGNATION HANDLERS ==========
  const openAddDesigModal = () => {
    if (!selectedDeptId) return;
    setEditingDesig(null);
    setDesigFormData({ name: "", responsibilities: "" });
    setShowDesigModal(true);
  };

  const openEditDesigModal = (desig: Designation) => {
    setEditingDesig(desig);
    setDesigFormData({
      name: desig.designation_name || desig.title || "",
      responsibilities: desig.responsibilities || "",
    });
    setShowDesigModal(true);
  };

  const handleSaveDesignation = async () => {
    if (!desigFormData.name.trim()) {
      showError("Designation name is required");
      return;
    }

    try {
      if (editingDesig) {
        // Update
        await apiService.apiCall(`/api/designations/${editingDesig.id}`, {
          method: "PUT",
          body: JSON.stringify({
            title: desigFormData.name,
            responsibilities: desigFormData.responsibilities,
          }),
        });
        showSuccess("Designation updated successfully");
      } else {
        // Create
        await apiService.createDesignation({
          title: desigFormData.name,
          department_id: selectedDeptId!,
          responsibilities: desigFormData.responsibilities,
        });
        showSuccess("Designation created successfully");
      }
      setShowDesigModal(false);
      fetchData();
    } catch (error: any) {
      showError(error.message || "Operation failed");
    }
  };

  const openDeleteDesigModal = (desig: Designation) => {
    setDesigToDelete(desig);
    setShowDeleteDesigModal(true);
  };

  const handleDeleteDesignation = async () => {
    if (!desigToDelete) return;

    try {
      await apiService.deleteDesignation(desigToDelete.id);
      showSuccess("Designation deleted successfully");
      setShowDeleteDesigModal(false);
      setDesigToDelete(null);
      fetchData();
    } catch (error: any) {
      showError(error.message || "Failed to delete designation");
      setShowDeleteDesigModal(false);
    }
  };

  return (
    <div className="p-6 rounded-xl shadow-md bg-white dark:bg-darkgray w-full">
      <h2 className="text-2xl font-semibold mb-6">Manage Departments & Designations</h2>

      {/* Success/Error Messages */}
      {successMessage && (
        <Alert color="success" className="mb-4" onDismiss={() => setSuccessMessage("")}>
          {successMessage}
        </Alert>
      )}
      {errorMessage && (
        <Alert color="failure" className="mb-4" onDismiss={() => setErrorMessage("")}>
          {errorMessage}
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ========== DEPARTMENT SECTION ========== */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Departments</h3>
            <DynamicProtectedComponent permission="departments.create">
              <Button color="purple" size="sm" onClick={openAddDeptModal}>
                <HiOutlinePlus className="mr-2 h-4 w-4" />
                Add Department
              </Button>
            </DynamicProtectedComponent>
          </div>

          <Table striped={false} hoverable className="w-full">
            <Table.Head>
              <Table.HeadCell>Department</Table.HeadCell>
              <Table.HeadCell>Employees</Table.HeadCell>
              <Table.HeadCell>Actions</Table.HeadCell>
            </Table.Head>
            <Table.Body>
              {departments.map((dept) => (
                <Table.Row
                  key={dept.id}
                  className={selectedDeptId === dept.id ? "bg-purple-50 dark:bg-purple-900/20" : ""}
                >
                  <Table.Cell>
                    <button
                      className="text-left hover:text-purple-600 dark:hover:text-purple-400"
                      onClick={() => setSelectedDeptId(dept.id)}
                    >
                      <div className="font-medium">{dept.name}</div>
                      {dept.description && (
                        <div className="text-xs text-gray-500">{dept.description}</div>
                      )}
                    </button>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {dept.employee_count || 0}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-2">
                      <DynamicProtectedComponent permission="departments.edit">
                        <Button size="xs" color="warning" onClick={() => openEditDeptModal(dept)}>
                          <HiPencil className="h-3 w-3" />
                        </Button>
                      </DynamicProtectedComponent>
                      <DynamicProtectedComponent permission="departments.delete">
                        <Button size="xs" color="failure" onClick={() => openDeleteDeptModal(dept)}>
                          <HiTrash className="h-3 w-3" />
                        </Button>
                      </DynamicProtectedComponent>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>

        {/* ========== DESIGNATION SECTION ========== */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Designations</h3>
            {selectedDeptId && hasPermission("designations.view") && (
              <DynamicProtectedComponent permission="designations.create">
                <Button color="purple" size="sm" onClick={openAddDesigModal}>
                  <HiOutlinePlus className="mr-2 h-4 w-4" />
                  Add Designation
                </Button>
              </DynamicProtectedComponent>
            )}
          </div>

          {!selectedDeptId ? (
            <div className="text-center py-10 text-gray-500">
              Select a department to view its designations
            </div>
          ) : !hasPermission("designations.view") ? (
            <div className="text-center py-10 text-gray-500">
              You don't have permission to view designations
            </div>
          ) : (
            <Table striped={false} hoverable className="w-full">
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
                      <Table.Cell>
                        <div className="font-medium">{d.designation_name || d.title}</div>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {d.responsibilities || <span className="text-gray-400 italic">—</span>}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex gap-2">
                          <DynamicProtectedComponent permission="designations.edit">
                            <Button size="xs" color="warning" onClick={() => openEditDesigModal(d)}>
                              <HiPencil className="h-3 w-3" />
                            </Button>
                          </DynamicProtectedComponent>
                          <DynamicProtectedComponent permission="designations.delete">
                            <Button size="xs" color="failure" onClick={() => openDeleteDesigModal(d)}>
                              <HiTrash className="h-3 w-3" />
                            </Button>
                          </DynamicProtectedComponent>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                {designations.filter((d) => d.department_id === selectedDeptId).length === 0 && (
                  <Table.Row>
                    <Table.Cell colSpan={3} className="text-center py-8 text-gray-500">
                      No designations found for this department
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table>
          )}
        </div>
      </div>

      {/* ========== DEPARTMENT MODAL ========== */}
      <Modal show={showDeptModal} onClose={() => setShowDeptModal(false)}>
        <Modal.Header>{editingDept ? "Edit Department" : "Add Department"}</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dept-name">Department Name *</Label>
              <TextInput
                id="dept-name"
                value={deptFormData.name}
                onChange={(e) => setDeptFormData({ ...deptFormData, name: e.target.value })}
                placeholder="e.g., Engineering"
                required
              />
            </div>
            <div>
              <Label htmlFor="dept-desc">Description</Label>
              <Textarea
                id="dept-desc"
                value={deptFormData.description}
                onChange={(e) => setDeptFormData({ ...deptFormData, description: e.target.value })}
                placeholder="Brief description of the department"
                rows={3}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="purple" onClick={handleSaveDepartment}>
            {editingDept ? "Update" : "Create"}
          </Button>
          <Button color="gray" onClick={() => setShowDeptModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ========== DESIGNATION MODAL ========== */}
      <Modal show={showDesigModal} onClose={() => setShowDesigModal(false)}>
        <Modal.Header>{editingDesig ? "Edit Designation" : "Add Designation"}</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <Label htmlFor="desig-name">Designation Name *</Label>
              <TextInput
                id="desig-name"
                value={desigFormData.name}
                onChange={(e) => setDesigFormData({ ...desigFormData, name: e.target.value })}
                placeholder="e.g., Software Engineer"
                required
              />
            </div>
            <div>
              <Label htmlFor="desig-resp">Responsibilities</Label>
              <Textarea
                id="desig-resp"
                value={desigFormData.responsibilities}
                onChange={(e) =>
                  setDesigFormData({ ...desigFormData, responsibilities: e.target.value })
                }
                placeholder="Key responsibilities for this role"
                rows={3}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="purple" onClick={handleSaveDesignation}>
            {editingDesig ? "Update" : "Create"}
          </Button>
          <Button color="gray" onClick={() => setShowDesigModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ========== DELETE DEPARTMENT CONFIRMATION ========== */}
      <Modal show={showDeleteDeptModal} onClose={() => setShowDeleteDeptModal(false)} size="md">
        <Modal.Header>Confirm Delete</Modal.Header>
        <Modal.Body>
          <div className="text-center">
            <HiTrash className="mx-auto mb-4 h-14 w-14 text-red-600" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to delete the department <strong>"{deptToDelete?.name}"</strong>?
            </h3>
            <p className="text-sm text-gray-400">
              This action cannot be undone. Make sure no active employees are assigned to this
              department.
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer className="justify-center">
          <Button color="failure" onClick={handleDeleteDepartment}>
            Yes, Delete
          </Button>
          <Button color="gray" onClick={() => setShowDeleteDeptModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ========== DELETE DESIGNATION CONFIRMATION ========== */}
      <Modal show={showDeleteDesigModal} onClose={() => setShowDeleteDesigModal(false)} size="md">
        <Modal.Header>Confirm Delete</Modal.Header>
        <Modal.Body>
          <div className="text-center">
            <HiTrash className="mx-auto mb-4 h-14 w-14 text-red-600" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to delete the designation{" "}
              <strong>"{desigToDelete?.designation_name || desigToDelete?.title}"</strong>?
            </h3>
            <p className="text-sm text-gray-400">
              This action cannot be undone. Make sure no employees are assigned this designation.
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer className="justify-center">
          <Button color="failure" onClick={handleDeleteDesignation}>
            Yes, Delete
          </Button>
          <Button color="gray" onClick={() => setShowDeleteDesigModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ManageDepartments;
