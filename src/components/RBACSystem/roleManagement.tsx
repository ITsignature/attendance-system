import React, { useState } from 'react';
import { Card, Button, Modal, TextInput, Label, Textarea, Badge, Checkbox } from 'flowbite-react';
import { HiPlus, HiPencil, HiTrash, HiUsers, HiShieldCheck } from 'react-icons/hi';
import { useDynamicRBAC, MODULES, Role } from './rbacSystem';

const RoleManagementPage: React.FC = () => {
  const { 
    roles, 
    createRole, 
    updateRole, 
    deleteRole, 
    getAllPermissions, 
    getInheritedPermissions,
    hasPermission,
    currentClient 
  } = useDynamicRBAC();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
    accessLevel: 'basic' as 'basic' | 'moderate' | 'full'
  });

  // Check if user can manage roles
  if (!hasPermission('rbac.view')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <HiShieldCheck className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
          <p className="mt-1 text-sm text-gray-500">You don't have permission to manage roles.</p>
        </div>
      </div>
    );
  }

  const handleCreateRole = () => {
    setFormData({
      name: '',
      description: '',
      permissions: [],
      accessLevel: 'basic'
    });
    setShowCreateModal(true);
  };

  const handleEditRole = (role: Role) => {
    if (role.isSystemRole) return; // Can't edit system roles
    
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      accessLevel: role.accessLevel
    });
    setShowEditModal(true);
  };

  const handleDeleteRole = (roleId: string) => {
    if (window.confirm('Are you sure you want to delete this role? Users with this role will be assigned to the basic Employee role.')) {
      deleteRole(roleId);
    }
  };

  const handleSaveRole = () => {
    const inheritedPermissions = getInheritedPermissions(formData.permissions);
    
    if (selectedRole) {
      // Update existing role
      updateRole(selectedRole.id, {
        name: formData.name,
        description: formData.description,
        permissions: inheritedPermissions,
        accessLevel: formData.accessLevel
      });
      setShowEditModal(false);
    } else {
      // Create new role
      createRole({
        name: formData.name,
        description: formData.description,
        permissions: inheritedPermissions,
        accessLevel: formData.accessLevel,
        isSystemRole: false
      });
      setShowCreateModal(false);
    }
    
    setSelectedRole(null);
  };

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        permissions: [...prev.permissions, permissionId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        permissions: prev.permissions.filter(p => p !== permissionId)
      }));
    }
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
      case 'basic': return 'Basic Access';
      case 'moderate': return 'Moderate Access';
      case 'full': return 'Full Access';
      default: return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Role Management</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage roles and permissions for {currentClient?.name}
          </p>
        </div>
        {hasPermission('rbac.create') && (
          <Button onClick={handleCreateRole} gradientDuoTone="purpleToBlue">
            <HiPlus className="mr-2 h-4 w-4" />
            Create Role
          </Button>
        )}
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((role) => (
          <Card key={role.id} className="hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  {role.name}
                  {role.isSystemRole && (
                    <Badge color="blue" size="sm" className="ml-2">System</Badge>
                  )}
                </h3>
                <Badge color={getAccessLevelColor(role.accessLevel)} size="sm" className="mt-1">
                  {getAccessLevelText(role.accessLevel)}
                </Badge>
              </div>
              
              {!role.isSystemRole && hasPermission('rbac.edit') && (
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    color="gray"
                    onClick={() => handleEditRole(role)}
                  >
                    <HiPencil className="h-4 w-4" />
                  </Button>
                  {hasPermission('rbac.delete') && (
                    <Button
                      size="sm"
                      color="failure"
                      onClick={() => handleDeleteRole(role.id)}
                    >
                      <HiTrash className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {role.description}
            </p>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                Permissions ({role.permissions.length})
              </h4>
              <div className="flex flex-wrap gap-1">
                {role.permissions.slice(0, 6).map((permission) => {
                  const [module, action] = permission.split('.');
                  return (
                    <Badge key={permission} color="purple" size="xs">
                      {action}
                    </Badge>
                  );
                })}
                {role.permissions.length > 6 && (
                  <Badge color="gray" size="xs">
                    +{role.permissions.length - 6} more
                  </Badge>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <HiUsers className="mr-1 h-4 w-4" />
                Created {new Date(role.createdAt).toLocaleDateString()}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Create Role Modal */}
      <Modal show={showCreateModal} onClose={() => setShowCreateModal(false)} size="4xl">
        <Modal.Header>Create New Role</Modal.Header>
        <Modal.Body>
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="roleName" value="Role Name" />
                <TextInput
                  id="roleName"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Department Manager"
                  required
                />
              </div>
              <div>
                <Label htmlFor="accessLevel" value="Access Level" />
                <select
                  id="accessLevel"
                  value={formData.accessLevel}
                  onChange={(e) => setFormData(prev => ({ ...prev, accessLevel: e.target.value as any }))}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                >
                  <option value="basic">Basic Access</option>
                  <option value="moderate">Moderate Access</option>
                  <option value="full">Full Access</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="roleDescription" value="Description" />
              <Textarea
                id="roleDescription"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this role can do..."
                rows={3}
              />
            </div>

            {/* Permissions */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Permissions
              </h3>
              <div className="space-y-6">
                {Object.values(MODULES).map((module) => (
                  <Card key={module.id}>
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-2">
                      {module.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {module.description}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {module.permissions.map((permission) => (
                        <div key={permission.id} className="flex items-center">
                          <Checkbox
                            id={permission.id}
                            checked={formData.permissions.includes(permission.id)}
                            onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                          />
                          <Label htmlFor={permission.id} className="ml-2 text-sm">
                            <span className="font-medium">{permission.name}</span>
                            <br />
                            <span className="text-gray-500 text-xs">{permission.description}</span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleSaveRole} gradientDuoTone="purpleToBlue">
            Create Role
          </Button>
          <Button color="gray" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Role Modal */}
      <Modal show={showEditModal} onClose={() => setShowEditModal(false)} size="4xl">
        <Modal.Header>Edit Role: {selectedRole?.name}</Modal.Header>
        <Modal.Body>
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editRoleName" value="Role Name" />
                <TextInput
                  id="editRoleName"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Department Manager"
                  required
                />
              </div>
              <div>
                <Label htmlFor="editAccessLevel" value="Access Level" />
                <select
                  id="editAccessLevel"
                  value={formData.accessLevel}
                  onChange={(e) => setFormData(prev => ({ ...prev, accessLevel: e.target.value as any }))}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                >
                  <option value="basic">Basic Access</option>
                  <option value="moderate">Moderate Access</option>
                  <option value="full">Full Access</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="editRoleDescription" value="Description" />
              <Textarea
                id="editRoleDescription"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this role can do..."
                rows={3}
              />
            </div>

            {/* Permissions */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Permissions
              </h3>
              <div className="space-y-6">
                {Object.values(MODULES).map((module) => (
                  <Card key={module.id}>
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-2">
                      {module.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {module.description}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {module.permissions.map((permission) => (
                        <div key={permission.id} className="flex items-center">
                          <Checkbox
                            id={`edit-${permission.id}`}
                            checked={formData.permissions.includes(permission.id)}
                            onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                          />
                          <Label htmlFor={`edit-${permission.id}`} className="ml-2 text-sm">
                            <span className="font-medium">{permission.name}</span>
                            <br />
                            <span className="text-gray-500 text-xs">{permission.description}</span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleSaveRole} gradientDuoTone="purpleToBlue">
            Update Role
          </Button>
          <Button color="gray" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default RoleManagementPage;