import React, { useState } from 'react';
import { Card, Button, Modal, TextInput, Label, Badge, Table, Avatar } from 'flowbite-react';
import { HiPlus, HiPencil, HiTrash, HiMail, HiOfficeBuilding, HiShieldCheck } from 'react-icons/hi';
import { useDynamicRBAC, AdminUser } from './rbacSystem';

const AdminUserManagementPage: React.FC = () => {
  const { 
    adminUsers, 
    roles, 
    currentClient,
    createAdminUser, 
    updateAdminUser, 
    deleteAdminUser,
    hasPermission 
  } = useDynamicRBAC();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    roleId: '',
    department: '',
    isActive: true
  });

  // Check if user can manage admin users
  if (!hasPermission('rbac.assign')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <HiShieldCheck className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
          <p className="mt-1 text-sm text-gray-500">You don't have permission to manage admin users.</p>
        </div>
      </div>
    );
  }

  // Filter users by current client
  const clientUsers = adminUsers.filter(user => user.clientId === currentClient?.id);

  const handleCreateUser = () => {
    setFormData({
      name: '',
      email: '',
      roleId: roles[0]?.id || '',
      department: '',
      isActive: true
    });
    setShowCreateModal(true);
  };

  const handleEditUser = (user: AdminUser) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      department: user.department || '',
      isActive: user.isActive
    });
    setShowEditModal(true);
  };

  const handleDeleteUser = (userId: string) => {
    if (window.confirm('Are you sure you want to delete this admin user?')) {
      deleteAdminUser(userId);
    }
  };

  const handleSaveUser = () => {
    if (selectedUser) {
      // Update existing user
      updateAdminUser(selectedUser.id, {
        name: formData.name,
        email: formData.email,
        roleId: formData.roleId,
        department: formData.department,
        isActive: formData.isActive
      });
      setShowEditModal(false);
    } else {
      // Create new user
      createAdminUser({
        name: formData.name,
        email: formData.email,
        roleId: formData.roleId,
        department: formData.department,
        clientId: currentClient?.id || '',
        isActive: formData.isActive
      });
      setShowCreateModal(false);
    }
    
    setSelectedUser(null);
  };

  const getRoleInfo = (roleId: string) => {
    return roles.find(role => role.id === roleId);
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'green' : 'red';
  };

  const getStatusText = (isActive: boolean) => {
    return isActive ? 'Active' : 'Inactive';
  };

  const getAccessLevelColor = (level: string) => {
    switch (level) {
      case 'basic': return 'green';
      case 'moderate': return 'yellow';
      case 'full': return 'red';
      default: return 'gray';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Users</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage admin users and role assignments for {currentClient?.name}
          </p>
        </div>
        <Button onClick={handleCreateUser} gradientDuoTone="purpleToBlue">
          <HiPlus className="mr-2 h-4 w-4" />
          Add Admin User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
              <HiShieldCheck className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Total Admins
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {clientUsers.length}
              </p>
            </div>
          </div>
        </Card>
        
        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
              <HiShieldCheck className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Active Users
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {clientUsers.filter(u => u.isActive).length}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full">
              <HiShieldCheck className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                HR Admins
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {clientUsers.filter(u => u.roleId === 'hr-admin').length}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-full">
              <HiShieldCheck className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Managers
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {clientUsers.filter(u => u.roleId === 'manager').length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table hoverable>
            <Table.Head>
              <Table.HeadCell>User</Table.HeadCell>
              <Table.HeadCell>Role</Table.HeadCell>
              <Table.HeadCell>Department</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
              <Table.HeadCell>Actions</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {clientUsers.map((user) => {
                const role = getRoleInfo(user.roleId);
                return (
                  <Table.Row key={user.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center space-x-3">
                        <Avatar
                          img={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=3b82f6&color=fff`}
                          rounded
                          size="sm"
                        />
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <HiMail className="mr-1 h-3 w-3" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="space-y-1">
                        <div className="font-medium">{role?.name}</div>
                        <Badge color={getAccessLevelColor(role?.accessLevel || 'basic')} size="sm">
                          {role?.accessLevel === 'basic' ? 'Basic' : 
                           role?.accessLevel === 'moderate' ? 'Moderate' : 'Full'} Access
                        </Badge>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center">
                        <HiOfficeBuilding className="mr-1 h-4 w-4 text-gray-400" />
                        {user.department || 'Not assigned'}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={getStatusColor(user.isActive)}>
                        {getStatusText(user.isActive)}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          color="gray"
                          onClick={() => handleEditUser(user)}
                        >
                          <HiPencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          color="failure"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <HiTrash className="h-4 w-4" />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </div>
      </Card>

      {/* Create User Modal */}
      <Modal show={showCreateModal} onClose={() => setShowCreateModal(false)} size="2xl">
        <Modal.Header>Add New Admin User</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="userName" value="Full Name" />
                <TextInput
                  id="userName"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter full name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="userEmail" value="Email Address" />
                <TextInput
                  id="userEmail"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="userRole" value="Assign Role" />
                <select
                  id="userRole"
                  value={formData.roleId}
                  onChange={(e) => setFormData(prev => ({ ...prev, roleId: e.target.value }))}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                  required
                >
                  <option value="">Select a role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} ({role.accessLevel === 'basic' ? 'Basic' : 
                                   role.accessLevel === 'moderate' ? 'Moderate' : 'Full'} Access)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="userDepartment" value="Department" />
                <TextInput
                  id="userDepartment"
                  value={formData.department}
                  onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="Enter department"
                />
              </div>
            </div>

            {formData.roleId && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                  Role Description:
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  {getRoleInfo(formData.roleId)?.description}
                </p>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleSaveUser} gradientDuoTone="purpleToBlue">
            Create Admin User
          </Button>
          <Button color="gray" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit User Modal */}
      <Modal show={showEditModal} onClose={() => setShowEditModal(false)} size="2xl">
        <Modal.Header>Edit Admin User: {selectedUser?.name}</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editUserName" value="Full Name" />
                <TextInput
                  id="editUserName"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter full name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="editUserEmail" value="Email Address" />
                <TextInput
                  id="editUserEmail"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editUserRole" value="Assign Role" />
                <select
                  id="editUserRole"
                  value={formData.roleId}
                  onChange={(e) => setFormData(prev => ({ ...prev, roleId: e.target.value }))}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                  required
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} ({role.accessLevel === 'basic' ? 'Basic' : 
                                   role.accessLevel === 'moderate' ? 'Moderate' : 'Full'} Access)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="editUserDepartment" value="Department" />
                <TextInput
                  id="editUserDepartment"
                  value={formData.department}
                  onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="Enter department"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="editUserStatus" value="Status" />
              <select
                id="editUserStatus"
                value={formData.isActive ? 'active' : 'inactive'}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.value === 'active' }))}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {formData.roleId && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                  Role Description:
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  {getRoleInfo(formData.roleId)?.description}
                </p>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleSaveUser} gradientDuoTone="purpleToBlue">
            Update User
          </Button>
          <Button color="gray" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminUserManagementPage;