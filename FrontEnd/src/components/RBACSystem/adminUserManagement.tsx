import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, TextInput, Label, Badge, Table, Avatar, Alert } from 'flowbite-react';
import { HiPlus, HiPencil, HiTrash, HiMail, HiOfficeBuilding, HiShieldCheck, HiUsers } from 'react-icons/hi';
import { useDynamicRBAC, Role } from './rbacSystem';
import { apiService } from '../../services/api';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  department?: string;
  is_super_admin: boolean;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
  role_id: string;
  role_name: string;
  access_level: string;
  client_id: string;
  client_name?: string;
}

const AdminUserManagementPage: React.FC = () => {
  const { 
    roles, 
    hasPermission,
    currentClient,
    currentUser,
    error: contextError 
  } = useDynamicRBAC();

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    roleId: '',
    department: '',
    isActive: true
  });

  // Load admin users and roles when component mounts
  useEffect(() => {
    loadAdminUsers();
  }, []);

  const loadAdminUsers = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Loading admin users...');
      
      const response = await apiService.getAdminUsers();
      console.log('📊 Admin users response:', response);
      
      if (response.success && response.data) {
        console.log('✅ Admin users loaded:', response.data.users.length);
        setAdminUsers(response.data.users);
      } else {
        console.error('❌ Failed to load admin users:', response.message);
        setError('Failed to load admin users');
      }
    } catch (error: any) {
      console.error('💥 Failed to load admin users:', error);
      setError(error.message || 'Failed to load admin users');
    } finally {
      setIsLoading(false);
    }
  };

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

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleCreateUser = () => {
    clearMessages();
    setSelectedUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      roleId: roles.length > 0 ? roles[0].id : '',
      department: '',
      isActive: true
    });
    setShowCreateModal(true);
  };

  const handleEditUser = (user: AdminUser) => {
    clearMessages();
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Don't pre-fill password for security
      roleId: user.role_id,
      department: user.department || '',
      isActive: user.is_active
    });
    setShowEditModal(true);
  };

  const handleDeleteUser = async (userId: string) => {
    const userToDelete = adminUsers.find(u => u.id === userId);
    if (!userToDelete) return;

    if (userId === currentUser?.id) {
      setError('You cannot delete your own account');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${userToDelete.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsSubmitting(true);
      clearMessages();
      
      const response = await apiService.deleteAdminUser(userId);
      
      if (response.success) {
        setSuccess('Admin user deleted successfully');
        await loadAdminUsers(); // Reload the list
      } else {
        setError(response.message || 'Failed to delete admin user');
      }
    } catch (error: any) {
      console.error('Delete admin user failed:', error);
      setError(error.message || 'Failed to delete admin user');
    } finally {
      setIsSubmitting(false);
    }
  };

const [fieldErrors, setFieldErrors] = useState<{
  name?: string;
  email?: string;
  password?: string;
  role_id?: string;
}>({});

const validateForm = () => {
  const errors: { [key: string]: string } = {};

  // Name validation
  if (!formData.name.trim()) {
    errors.name = 'Name is required';
  }

  // Email validation  
  if (!formData.email.trim()) {
    errors.email = 'Email is required';
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
  }

  // Password validation (for new users)
  if (!selectedUser) {
    if (!formData.password) {
      errors.password = 'Password is required for new users';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters long';
    }
  }

  // Role validation
  if (!formData.roleId) {
    errors.role_id = 'Role is required';
  }

  return errors;
};

const handleSaveUser = async () => {
  // Clear previous field errors
  setFieldErrors({});
  
  // Run frontend validation first
  const validationErrors = validateForm();
  if (Object.keys(validationErrors).length > 0) {
    setFieldErrors(validationErrors);
    return;
  }

  setIsSubmitting(true);
  clearMessages();

  try {
    if (selectedUser) {
      // Update existing user
      const updateData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        role_id: formData.roleId,
        department: formData.department.trim() || undefined,
        is_active: formData.isActive
      };

      console.log('🔄 Updating admin user:', selectedUser.id, updateData);
      const response = await apiService.updateAdminUser(selectedUser.id, updateData);
      
      if (response.success) {
        setSuccess('Admin user updated successfully');
        setShowEditModal(false);
        setFieldErrors({});
        await loadAdminUsers();
      } else {
        handleServerErrors(response);
      }
    } else {
      // Create new user
      const createData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role_id: formData.roleId,
        department: formData.department.trim() || undefined,
        is_active: formData.isActive
      };

      console.log('🆕 Creating admin user:', createData);
      const response = await apiService.createAdminUser(createData);
      
      if (response.success) {
        setSuccess('Admin user created successfully');
        setShowCreateModal(false);
        setFieldErrors({});
        await loadAdminUsers();
      } else {
        handleServerErrors(response);
      }
    }

    // Reset form on success
    setFormData({
      name: '',
      email: '',
      password: '',
      roleId: roles.length > 0 ? roles[0].id : '',
      department: '',
      isActive: true
    });
    setSelectedUser(null);

  } catch (error: any) {
    console.error('❌ Admin user operation failed:', error);
    
    if (error.response?.data) {
      handleServerErrors(error.response.data);
    } else {
      setError(error.message || `Failed to ${selectedUser ? 'update' : 'create'} admin user`);
    }
  } finally {
    setIsSubmitting(false);
  }
};

const handleServerErrors = (responseData: any) => {
  console.log('🔍 Server response:', responseData);
  
  if (responseData.errors && Array.isArray(responseData.errors)) {
    // Map express-validator errors to specific fields
    const newFieldErrors: { [key: string]: string } = {};
    
    responseData.errors.forEach((err: any) => {
      if (err.param && err.msg) {
        // Map backend field names to frontend field names
        const fieldMap: { [key: string]: string } = {
          'name': 'name',
          'email': 'email', 
          'password': 'password',
          'role_id': 'role_id'
        };
        
        const frontendField = fieldMap[err.param] || err.param;
        newFieldErrors[frontendField] = err.msg;
      }
    });
    
    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
    } else {
      // Fallback to general error if no field-specific errors
      const errorMessages = responseData.errors.map((err: any) => err.msg || err.message).join('. ');
      setError(errorMessages);
    }
  } else if (responseData.message) {
    setError(responseData.message);
  } else {
    setError('Operation failed. Please try again.');
  }
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

  const getAccessLevelText = (level: string) => {
    switch (level) {
      case 'basic': return 'Basic';
      case 'moderate': return 'Moderate';
      case 'full': return 'Full';
      default: return 'Unknown';
    }
  };

  // Filter users by current client (unless super admin)
  const filteredUsers = currentUser?.is_super_admin 
    ? adminUsers 
    : adminUsers.filter(user => {
        // If currentClient is undefined, show all users for this user's client
        const userClientId = currentClient?.id || currentUser?.clientId;
        return user.client_id === userClientId;
      });

  console.log('🔍 Admin User Debug Info:',currentUser);
  console.log('- Your current user:', currentUser?.name, '| Email:', currentUser?.email);
  console.log('- Are you super admin?', currentUser?.is_super_admin);
  console.log('- Current client from context:', currentClient?.id, '| Client name:', currentClient?.name);
  console.log('- Current user client ID:', currentUser?.clientId);
  console.log('- Using client ID for filtering:', currentClient?.id || currentUser?.clientId);
  console.log('- Total admin users in system:', adminUsers.length);
  console.log('- Admin users after filtering:', filteredUsers.length);
  console.log('- All admin users data:', adminUsers.map(u => ({ 
    name: u.name, 
    email: u.email, 
    client_id: u.client_id, 
    is_super_admin: u.is_super_admin,
    is_active: u.is_active 
  })));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Users</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage admin users and role assignments {currentClient?.name ? `for ${currentClient.name}` : ''}
          </p>
        </div>
        <Button onClick={handleCreateUser} gradientDuoTone="purpleToBlue" disabled={isSubmitting}>
          <HiPlus className="mr-2 h-4 w-4" />
          Add Admin User
        </Button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <Alert color="success" onDismiss={() => setSuccess('')}>
          {success}
        </Alert>
      )}
      
      {(error || contextError) && (
        <Alert color="failure" onDismiss={() => setError('')}>
          {error || contextError}
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
              <HiUsers className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Total Admins
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {filteredUsers.length}
              </p>
              <p className="text-xs text-gray-400">
                Raw: {adminUsers.length} | Filtered: {filteredUsers.length}
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
                {filteredUsers.filter(u => u.is_active).length}
              </p>
              <p className="text-xs text-gray-400">
                Out of {filteredUsers.length} users
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
                Super Admins
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {filteredUsers.filter(u => u.is_super_admin).length}
              </p>
              <p className="text-xs text-gray-400">
                Super admin access
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-full">
              <HiOfficeBuilding className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Available Roles
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {roles.length}
              </p>
              <p className="text-xs text-gray-400">
                Role options
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <Table.Head>
              <Table.HeadCell>User</Table.HeadCell>
              <Table.HeadCell>Role</Table.HeadCell>
              <Table.HeadCell>Department</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
              <Table.HeadCell>Last Login</Table.HeadCell>
              <Table.HeadCell>Actions</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {filteredUsers.map((user) => {
                const role = getRoleInfo(user.role_id);
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
                          <div className="font-medium flex items-center">
                            {user.name}
                            {user.is_super_admin && (
                              <Badge color="purple" size="xs" className="ml-2">Super Admin</Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <HiMail className="mr-1 h-3 w-3" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="space-y-1">
                        <div className="font-medium">{role?.name || 'Unknown Role'}</div>
                        <Badge color={getAccessLevelColor(user.access_level)} size="sm">
                          {getAccessLevelText(user.access_level)} Access
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
                      <Badge color={getStatusColor(user.is_active)}>
                        {getStatusText(user.is_active)}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm text-gray-500">
                        {user.last_login_at 
                          ? new Date(user.last_login_at).toLocaleDateString()
                          : 'Never'
                        }
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          color="gray"
                          onClick={() => handleEditUser(user)}
                          disabled={isSubmitting}
                        >
                          <HiPencil className="h-4 w-4" />
                        </Button>
                        {user.id !== currentUser?.id && (
                          <Button
                            size="sm"
                            color="failure"
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={isSubmitting}
                          >
                            <HiTrash className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
          
          {filteredUsers.length === 0 && (
            <div className="text-center py-8">
              <HiUsers className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No admin users</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new admin user.</p>
            </div>
          )}
        </div>
      </Card>

      {/* Create User Modal */}
<Modal show={showCreateModal} onClose={() => setShowCreateModal(false)} size="2xl">
  <Modal.Header>Add New Admin User</Modal.Header>
  <Modal.Body>
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name Field with Error */}
        <div>
          <Label htmlFor="userName" value="Full Name" />
          <TextInput
            id="userName"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter full name"
            required
            disabled={isSubmitting}
            color={fieldErrors.name ? "failure" : undefined}
          />
          {fieldErrors.name && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-500">
              {fieldErrors.name}
            </p>
          )}
        </div>

        {/* Email Field with Error */}
        <div>
          <Label htmlFor="userEmail" value="Email Address" />
          <TextInput
            id="userEmail"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            placeholder="Enter email address"
            required
            disabled={isSubmitting}
            color={fieldErrors.email ? "failure" : undefined}
          />
          {fieldErrors.email && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-500">
              {fieldErrors.email}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Password Field with Error */}
        <div>
          <Label htmlFor="userPassword" value="Password" />
          <TextInput
            id="userPassword"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
            placeholder="Enter password (min 6 characters)"
            required
            disabled={isSubmitting}
            color={fieldErrors.password ? "failure" : undefined}
          />
          {fieldErrors.password && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-500">
              {fieldErrors.password}
            </p>
          )}
        </div>

        {/* Role Field with Error */}
        <div>
          <Label htmlFor="userRole" value="Assign Role" />
          <select
            id="userRole"
            value={formData.roleId}
            onChange={(e) => setFormData(prev => ({ ...prev, roleId: e.target.value }))}
            className={`bg-gray-50 border text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 ${
              fieldErrors.role_id 
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                : 'border-gray-300'
            }`}
            required
            disabled={isSubmitting}
          >
            <option value="">Select a role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name} ({getAccessLevelText(role.access_level)} Access)
              </option>
            ))}
          </select>
          {fieldErrors.role_id && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-500">
              {fieldErrors.role_id}
            </p>
          )}
        </div>
      </div>

      {/* Department Field */}
      <div>
        <Label htmlFor="userDepartment" value="Department" />
        <TextInput
          id="userDepartment"
          value={formData.department}
          onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
          placeholder="Enter department (optional)"
          disabled={isSubmitting}
        />
      </div>

      {/* Status Field */}
      <div>
        <Label htmlFor="userStatus" value="Status" />
        <select
          id="userStatus"
          value={formData.isActive ? 'active' : 'inactive'}
          onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.value === 'active' }))}
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
          disabled={isSubmitting}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Role Information */}
      {formData.roleId && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
            Role Information:
          </h4>
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>{getRoleInfo(formData.roleId)?.name}</strong> - {getRoleInfo(formData.roleId)?.description}
          </p>
        </div>
      )}
    </div>
  </Modal.Body>
  <Modal.Footer>
    <Button 
      onClick={handleSaveUser} 
      gradientDuoTone="purpleToBlue"
      disabled={isSubmitting}
    >
      {isSubmitting ? (
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          Creating...
        </div>
      ) : (
        'Create Admin User'
      )}
    </Button>
    <Button 
      color="gray" 
      onClick={() => {
        setShowCreateModal(false);
        setFieldErrors({}); // Clear errors when closing
      }}
      disabled={isSubmitting}
    >
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                >
                  <option value="">Select a role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} ({getAccessLevelText(role.access_level)} Access)
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
                  placeholder="Enter department (optional)"
                  disabled={isSubmitting}
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
                disabled={isSubmitting}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {formData.roleId && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                  Role Information:
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>{getRoleInfo(formData.roleId)?.name}</strong> - {getRoleInfo(formData.roleId)?.description}
                </p>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            onClick={handleSaveUser} 
            gradientDuoTone="purpleToBlue"
            disabled={isSubmitting || !formData.name.trim() || !formData.email.trim() || !formData.roleId}
          >
            {isSubmitting ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Updating...
              </div>
            ) : (
              'Update User'
            )}
          </Button>
          <Button 
            color="gray" 
            onClick={() => setShowEditModal(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminUserManagementPage;