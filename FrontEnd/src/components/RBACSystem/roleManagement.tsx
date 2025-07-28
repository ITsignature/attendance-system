import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, TextInput, Label, Textarea, Badge, Checkbox, Alert } from 'flowbite-react';
import { HiPlus, HiPencil, HiTrash, HiUsers, HiShieldCheck } from 'react-icons/hi';
import { useDynamicRBAC, MODULES, Role } from './rbacSystem';
import { apiService } from '../../services/api';

const RoleManagementPage: React.FC = () => {
  const { 
    roles, 
    createRole, 
    updateRole, 
    deleteRole, 
    getAllPermissions, 
    getInheritedPermissions,
    hasPermission,
    currentClient,
    error: contextError 
  } = useDynamicRBAC();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [availablePermissions, setAvailablePermissions] = useState<any>({});
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
    accessLevel: 'basic' as 'basic' | 'moderate' | 'full'
  });

  // Load permissions when component mounts
  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const response = await apiService.getPermissions();
      if (response.success && response.data) {
        setAvailablePermissions(response.data.permissions);
      }
    } catch (error) {
      console.error('Failed to load permissions:', error);
    }
  };

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

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleCreateRole = () => {
    clearMessages();
    setSelectedRole(null); // Ensure this is null for create
    setFormData({
      name: '',
      description: '',
      permissions: [],
      accessLevel: 'basic'
    });
    setShowCreateModal(true);
  };

  const handleEditRole = async (role: Role) => {
    if (role.is_system_role) {
      setError('Cannot edit system roles');
      return;
    }
    
    clearMessages();
    setSelectedRole(role);
    
    try {
      // Get full role details with permissions from backend
      console.log('🔍 Getting role details for edit:', role.id);
      const roleResponse = await apiService.getRole(role.id);
      
      if (roleResponse.success && roleResponse.data) {
        const fullRole = roleResponse.data.role;
        console.log('🔍 Full role data:', fullRole);
        
        // Extract permission IDs properly
        let rolePermissionIds: string[] = [];
        
        if (fullRole.permissions && Array.isArray(fullRole.permissions)) {
          rolePermissionIds = fullRole.permissions.map((perm: any) => {
            // Check if it's already a permission ID (UUID format)
            if (typeof perm === 'string' && perm.includes('-')) {
              return perm;
            }
            // If it's an object with id field
            if (perm.id) {
              return perm.id;
            }
            // If it's module.action format, find corresponding permission ID
            if (typeof perm === 'string' && perm.includes('.')) {
              // Find the permission ID from availablePermissions
              for (const [module, permissions] of Object.entries(availablePermissions)) {
                if (Array.isArray(permissions)) {
                  const found = permissions.find((p: any) => `${p.module}.${p.action}` === perm);
                  if (found) return found.id;
                }
              }
            }
            return perm;
          }).filter(Boolean);
        }
        
        console.log('🔍 Extracted permission IDs:', rolePermissionIds);
        
        setFormData({
          name: fullRole.name,
          description: fullRole.description || '',
          permissions: rolePermissionIds,
          accessLevel: fullRole.access_level
        });
      } else {
        // Fallback to using the role data passed in
        console.log('🔍 Using fallback role data');
        setFormData({
          name: role.name,
          description: role.description || '',
          permissions: role.permissions || [],
          accessLevel: role.access_level
        });
      }
      
      setShowEditModal(true);
      
    } catch (error) {
      console.error('❌ Failed to get role details:', error);
      setError('Failed to load role details');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!window.confirm('Are you sure you want to delete this role? Users with this role will need to be reassigned.')) {
      return;
    }

    try {
      setIsSubmitting(true);
      clearMessages();
      
      await deleteRole(roleId);
      setSuccess('Role deleted successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error: any) {
      console.error('Delete role failed:', error);
      setError(error.message || 'Failed to delete role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveRole = async () => {
    if (!formData.name.trim()) {
      setError('Role name is required');
      return;
    }

    if (formData.permissions.length === 0) {
      setError('At least one permission must be selected');
      return;
    }

    setIsSubmitting(true);
    clearMessages();

    try {
      const roleData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        access_level: formData.accessLevel,
        permissions: formData.permissions
      };

      console.log('🚀 Saving role data:', roleData);
      console.log('🚀 Selected role for edit:', selectedRole?.id);

      if (selectedRole) {
        // Update existing role
        console.log('🔄 Updating role:', selectedRole.id);
        await updateRole(selectedRole.id, roleData);
        setShowEditModal(false);
        setSuccess('Role updated successfully');
      } else {
        // Create new role
        console.log('🆕 Creating new role');
        await createRole(roleData);
        setShowCreateModal(false);
        setSuccess('Role created successfully');
      }

      // Reset form
      setFormData({
        name: '',
        description: '',
        permissions: [],
        accessLevel: 'basic'
      });
      setSelectedRole(null);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);

    } catch (error: any) {
      console.error('❌ Role operation failed:', error);
      setError(error.message || `Failed to ${selectedRole ? 'update' : 'create'} role`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    console.log('🔄 Permission change:', permissionId, checked);
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

  const renderPermissionCheckboxes = () => {
    console.log('🔍 Rendering permissions. Current selections:', formData.permissions);
    console.log('🔍 Available permissions:', availablePermissions);
    
    // Use API permissions if available, otherwise fall back to MODULES
    if (Object.keys(availablePermissions).length > 0) {
      return Object.entries(availablePermissions).map(([moduleName, permissions]: [string, any]) => (
        <Card key={moduleName}>
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-2">
            {moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Array.isArray(permissions) && permissions.map((permission: any) => {
              const isChecked = formData.permissions.includes(permission.id);
              console.log(`🔍 Permission ${permission.id} (${permission.name}) checked:`, isChecked);
              
              return (
                <div key={permission.id} className="flex items-center">
                  <Checkbox
                    id={permission.id}
                    checked={isChecked}
                    onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                  />
                  <Label htmlFor={permission.id} className="ml-2 text-sm">
                    <span className="font-medium">{permission.name}</span>
                    <br />
                    <span className="text-gray-500 text-xs">{permission.description}</span>
                  </Label>
                </div>
              );
            })}
          </div>
        </Card>
      ));
    }

    // Fallback to MODULES if API permissions not loaded
    return Object.values(MODULES).map((module) => (
      <Card key={module.id}>
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-2">
          {module.name}
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {module.description}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {module.permissions.map((permission) => {
            const isChecked = formData.permissions.includes(permission.id);
            
            return (
              <div key={permission.id} className="flex items-center">
                <Checkbox
                  id={permission.id}
                  checked={isChecked}
                  onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                />
                <Label htmlFor={permission.id} className="ml-2 text-sm">
                  <span className="font-medium">{permission.name}</span>
                  <br />
                  <span className="text-gray-500 text-xs">{permission.description}</span>
                </Label>
              </div>
            );
          })}
        </div>
      </Card>
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Role Management</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage roles and permissions {currentClient?.name ? `for ${currentClient.name}` : ''}
          </p>
        </div>
        {hasPermission('rbac.create') && (
          <Button onClick={handleCreateRole} gradientDuoTone="purpleToBlue" disabled={isSubmitting}>
            <HiPlus className="mr-2 h-4 w-4" />
            Create Role
          </Button>
        )}
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

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((role) => (
          <Card key={role.id} className="hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  {role.name}
                  {role.is_system_role && (
                    <Badge color="blue" size="sm" className="ml-2">System</Badge>
                  )}
                </h3>
                <Badge color={getAccessLevelColor(role.access_level)} size="sm" className="mt-1">
                  {getAccessLevelText(role.access_level)}
                </Badge>
              </div>
              
              {!role.is_system_role && hasPermission('rbac.edit') && (
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    color="gray"
                    onClick={() => handleEditRole(role)}
                    disabled={isSubmitting}
                  >
                    <HiPencil className="h-4 w-4" />
                  </Button>
                  {hasPermission('rbac.delete') && (
                    <Button
                      size="sm"
                      color="failure"
                      onClick={() => handleDeleteRole(role.id)}
                      disabled={isSubmitting}
                    >
                      <HiTrash className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {role.description || 'No description'}
            </p>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                Permissions ({role.permissions?.length || 0})
              </h4>
              <div className="flex flex-wrap gap-1">
                {(role.permissions || []).slice(0, 6).map((permission, index) => {
                  // Handle both string and object permissions
                  let displayText = '';
                  if (typeof permission === 'string') {
                    const parts = permission.split('.');
                    displayText = parts.length > 1 ? parts[1] : permission;
                  } else if (permission.action) {
                    displayText = permission.action;
                  } else if (permission.name) {
                    displayText = permission.name.toLowerCase();
                  } else {
                    displayText = `perm-${index}`;
                  }
                  
                  return (
                    <Badge key={index} color="purple" size="xs">
                      {displayText}
                    </Badge>
                  );
                })}
                {(role.permissions?.length || 0) > 6 && (
                  <Badge color="gray" size="xs">
                    +{(role.permissions?.length || 0) - 6} more
                  </Badge>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <HiUsers className="mr-1 h-4 w-4" />
                {role.created_at ? new Date(role.created_at).toLocaleDateString() : 'System role'}
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
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Label htmlFor="accessLevel" value="Access Level" />
                <select
                  id="accessLevel"
                  value={formData.accessLevel}
                  onChange={(e) => setFormData(prev => ({ ...prev, accessLevel: e.target.value as any }))}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                  disabled={isSubmitting}
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
                disabled={isSubmitting}
              />
            </div>

            {/* Permissions */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Permissions ({formData.permissions.length} selected)
              </h3>
              <div className="space-y-6">
                {renderPermissionCheckboxes()}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            onClick={handleSaveRole} 
            gradientDuoTone="purpleToBlue"
            disabled={isSubmitting || !formData.name.trim()}
          >
            {isSubmitting ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </div>
            ) : (
              'Create Role'
            )}
          </Button>
          <Button 
            color="gray" 
            onClick={() => setShowCreateModal(false)}
            disabled={isSubmitting}
          >
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
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Label htmlFor="editAccessLevel" value="Access Level" />
                <select
                  id="editAccessLevel"
                  value={formData.accessLevel}
                  onChange={(e) => setFormData(prev => ({ ...prev, accessLevel: e.target.value as any }))}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                  disabled={isSubmitting}
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
                disabled={isSubmitting}
              />
            </div>

            {/* Permissions */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Permissions ({formData.permissions.length} selected)
              </h3>
              <div className="space-y-6">
                {renderPermissionCheckboxes()}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            onClick={handleSaveRole} 
            gradientDuoTone="purpleToBlue"
            disabled={isSubmitting || !formData.name.trim()}
          >
            {isSubmitting ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Updating...
              </div>
            ) : (
              'Update Role'
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

export default RoleManagementPage;