import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, TextInput, Label, Badge, Table, Select, Textarea } from 'flowbite-react';
import { HiPlus, HiPencil, HiTrash, HiOfficeBuilding, HiUsers, HiUserGroup } from 'react-icons/hi';
import { useDynamicRBAC } from './rbacSystem';

interface Client {
  id: string;
  name: string;
  description?: string;
  contact_email: string;
  phone?: string;
  address?: string;
  is_active: boolean;
  subscription_plan: 'basic' | 'premium' | 'enterprise';
  subscription_expires_at?: string;
  created_at: string;
  updated_at: string;
  admin_count?: number;
  employee_count?: number;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  department?: string;
  is_active: boolean;
  last_login_at?: string;
  role_name: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  access_level: string;
  is_system_role: boolean;
}

const ClientManagement: React.FC = () => {
  const { currentUser } = useDynamicRBAC();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [clientAdmins, setClientAdmins] = useState<AdminUser[]>([]);

  const [clientFormData, setClientFormData] = useState({
    name: '',
    description: '',
    contact_email: '',
    phone: '',
    address: '',
    subscription_plan: 'basic' as 'basic' | 'premium' | 'enterprise',
    subscription_expires_at: ''
  });

  const [adminFormData, setAdminFormData] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
    role_id: ''
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:5000/api/clients', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        setClients(data.data);
      } else {
        setError(data.message || 'Failed to load clients');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load clients');
    } finally {
      setIsLoading(false);
    }
  };

  const loadClientDetails = async (clientId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:5000/api/clients/${clientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        setSelectedClient(data.data);
        setClientAdmins(data.data.adminUsers || []);
        setShowViewModal(true);
      } else {
        setError(data.message || 'Failed to load client details');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load client details');
    }
  };

  const loadRolesForClient = async (clientId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:5000/api/clients/${clientId}/roles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        setAvailableRoles(data.data);
      }
    } catch (error: any) {
      console.error('Failed to load roles:', error);
    }
  };

  const handleCreateClient = () => {
    setError('');
    setSuccess('');
    setSelectedClient(null);
    setClientFormData({
      name: '',
      description: '',
      contact_email: '',
      phone: '',
      address: '',
      subscription_plan: 'basic',
      subscription_expires_at: ''
    });
    setShowClientModal(true);
  };

  const handleEditClient = (client: Client) => {
    setError('');
    setSuccess('');
    setSelectedClient(client);
    setClientFormData({
      name: client.name,
      description: client.description || '',
      contact_email: client.contact_email,
      phone: client.phone || '',
      address: client.address || '',
      subscription_plan: client.subscription_plan,
      subscription_expires_at: client.subscription_expires_at?.split('T')[0] || ''
    });
    setShowClientModal(true);
  };

  const handleSubmitClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('accessToken');
      const url = selectedClient
        ? `http://localhost:5000/api/clients/${selectedClient.id}`
        : 'http://localhost:5000/api/clients';

      const response = await fetch(url, {
        method: selectedClient ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(clientFormData)
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(data.message);
        setShowClientModal(false);
        loadClients();
      } else {
        setError(data.message || 'Failed to save client');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to save client');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleClientStatus = async (client: Client) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:5000/api/clients/${client.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: !client.is_active })
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(`Client ${!client.is_active ? 'activated' : 'deactivated'} successfully`);
        loadClients();
      } else {
        setError(data.message || 'Failed to update client status');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to update client status');
    }
  };

  const handleAddAdmin = (client: Client) => {
    setError('');
    setSuccess('');
    setSelectedClient(client);
    setAdminFormData({
      name: '',
      email: '',
      password: '',
      department: '',
      role_id: ''
    });
    loadRolesForClient(client.id);
    setShowAdminModal(true);
  };

  const handleSubmitAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:5000/api/clients/${selectedClient.id}/admin-users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(adminFormData)
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Admin user created successfully');
        setShowAdminModal(false);
        loadClients();
      } else {
        setError(data.message || 'Failed to create admin user');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to create admin user');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if user is super admin
  // Support both boolean (true/false) and number (1/0) formats for backward compatibility
  const isSuperAdmin = !!(currentUser?.isSuperAdmin || (currentUser as any)?.is_super_admin);

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <HiOfficeBuilding className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
          <p className="mt-1 text-sm text-gray-500">Only Super Admins can manage clients.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Client Management</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage all clients and their admin users</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Clients</h2>
          <Button onClick={handleCreateClient} color="blue">
            <HiPlus className="mr-2 h-5 w-5" />
            Add Client
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <Table>
            <Table.Head>
              <Table.HeadCell>Name</Table.HeadCell>
              <Table.HeadCell>Contact Email</Table.HeadCell>
              <Table.HeadCell>Subscription</Table.HeadCell>
              <Table.HeadCell>Admins</Table.HeadCell>
              <Table.HeadCell>Employees</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
              <Table.HeadCell>Actions</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {clients.map((client) => (
                <Table.Row key={client.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <Table.Cell className="font-medium text-gray-900 dark:text-white">
                    {client.name}
                  </Table.Cell>
                  <Table.Cell>{client.contact_email}</Table.Cell>
                  <Table.Cell>
                    <Badge color={
                      client.subscription_plan === 'enterprise' ? 'purple' :
                      client.subscription_plan === 'premium' ? 'blue' : 'gray'
                    }>
                      {client.subscription_plan}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>{client.admin_count || 0}</Table.Cell>
                  <Table.Cell>{client.employee_count || 0}</Table.Cell>
                  <Table.Cell>
                    <Badge color={client.is_active ? 'success' : 'failure'}>
                      {client.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-2">
                      <Button
                        size="xs"
                        color="light"
                        onClick={() => loadClientDetails(client.id)}
                      >
                        View
                      </Button>
                      <Button
                        size="xs"
                        color="light"
                        onClick={() => handleEditClient(client)}
                      >
                        <HiPencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="xs"
                        color="light"
                        onClick={() => handleAddAdmin(client)}
                      >
                        <HiUserGroup className="h-4 w-4" />
                      </Button>
                      <Button
                        size="xs"
                        color={client.is_active ? 'failure' : 'success'}
                        onClick={() => handleToggleClientStatus(client)}
                      >
                        {client.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Card>

      {/* Create/Edit Client Modal */}
      <Modal show={showClientModal} onClose={() => setShowClientModal(false)}>
        <Modal.Header>
          {selectedClient ? 'Edit Client' : 'Create New Client'}
        </Modal.Header>
        <Modal.Body>
          <form onSubmit={handleSubmitClient} className="space-y-4">
            <div>
              <Label htmlFor="name">Client Name *</Label>
              <TextInput
                id="name"
                value={clientFormData.name}
                onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                value={clientFormData.description}
                onChange={(e) => setClientFormData({ ...clientFormData, description: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="contact_email">Contact Email *</Label>
              <TextInput
                id="contact_email"
                type="email"
                value={clientFormData.contact_email}
                onChange={(e) => setClientFormData({ ...clientFormData, contact_email: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <TextInput
                id="phone"
                value={clientFormData.phone}
                onChange={(e) => setClientFormData({ ...clientFormData, phone: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                rows={2}
                value={clientFormData.address}
                onChange={(e) => setClientFormData({ ...clientFormData, address: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="subscription_plan">Subscription Plan *</Label>
              <Select
                id="subscription_plan"
                value={clientFormData.subscription_plan}
                onChange={(e) => setClientFormData({ ...clientFormData, subscription_plan: e.target.value as any })}
                required
              >
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="subscription_expires_at">Subscription Expires At</Label>
              <TextInput
                id="subscription_expires_at"
                type="date"
                value={clientFormData.subscription_expires_at}
                onChange={(e) => setClientFormData({ ...clientFormData, subscription_expires_at: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button color="gray" onClick={() => setShowClientModal(false)}>
                Cancel
              </Button>
              <Button type="submit" color="blue" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : selectedClient ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Modal.Body>
      </Modal>

      {/* Add Admin Modal */}
      <Modal show={showAdminModal} onClose={() => setShowAdminModal(false)}>
        <Modal.Header>
          Add Admin User to {selectedClient?.name}
        </Modal.Header>
        <Modal.Body>
          <form onSubmit={handleSubmitAdmin} className="space-y-4">
            <div>
              <Label htmlFor="admin_name">Name *</Label>
              <TextInput
                id="admin_name"
                value={adminFormData.name}
                onChange={(e) => setAdminFormData({ ...adminFormData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="admin_email">Email *</Label>
              <TextInput
                id="admin_email"
                type="email"
                value={adminFormData.email}
                onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="admin_password">Password * (min 8 characters)</Label>
              <TextInput
                id="admin_password"
                type="password"
                value={adminFormData.password}
                onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                required
                minLength={8}
              />
            </div>

            <div>
              <Label htmlFor="admin_department">Department</Label>
              <TextInput
                id="admin_department"
                value={adminFormData.department}
                onChange={(e) => setAdminFormData({ ...adminFormData, department: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="admin_role">Role *</Label>
              <Select
                id="admin_role"
                value={adminFormData.role_id}
                onChange={(e) => setAdminFormData({ ...adminFormData, role_id: e.target.value })}
                required
              >
                <option value="">Select a role</option>
                {availableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} {role.is_system_role ? '(System)' : ''}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button color="gray" onClick={() => setShowAdminModal(false)}>
                Cancel
              </Button>
              <Button type="submit" color="blue" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Admin User'}
              </Button>
            </div>
          </form>
        </Modal.Body>
      </Modal>

      {/* View Client Details Modal */}
      <Modal show={showViewModal} onClose={() => setShowViewModal(false)} size="xl">
        <Modal.Header>
          Client Details: {selectedClient?.name}
        </Modal.Header>
        <Modal.Body>
          {selectedClient && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  <p className="text-gray-900 dark:text-white">{selectedClient.name}</p>
                </div>
                <div>
                  <Label>Contact Email</Label>
                  <p className="text-gray-900 dark:text-white">{selectedClient.contact_email}</p>
                </div>
                <div>
                  <Label>Phone</Label>
                  <p className="text-gray-900 dark:text-white">{selectedClient.phone || 'N/A'}</p>
                </div>
                <div>
                  <Label>Subscription Plan</Label>
                  <Badge color={
                    selectedClient.subscription_plan === 'enterprise' ? 'purple' :
                    selectedClient.subscription_plan === 'premium' ? 'blue' : 'gray'
                  }>
                    {selectedClient.subscription_plan}
                  </Badge>
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <p className="text-gray-900 dark:text-white">{selectedClient.description || 'N/A'}</p>
              </div>

              <div>
                <Label>Address</Label>
                <p className="text-gray-900 dark:text-white">{selectedClient.address || 'N/A'}</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Admin Users</h3>
                {clientAdmins.length > 0 ? (
                  <Table>
                    <Table.Head>
                      <Table.HeadCell>Name</Table.HeadCell>
                      <Table.HeadCell>Email</Table.HeadCell>
                      <Table.HeadCell>Role</Table.HeadCell>
                      <Table.HeadCell>Department</Table.HeadCell>
                      <Table.HeadCell>Status</Table.HeadCell>
                    </Table.Head>
                    <Table.Body className="divide-y">
                      {clientAdmins.map((admin) => (
                        <Table.Row key={admin.id}>
                          <Table.Cell>{admin.name}</Table.Cell>
                          <Table.Cell>{admin.email}</Table.Cell>
                          <Table.Cell>{admin.role_name}</Table.Cell>
                          <Table.Cell>{admin.department || 'N/A'}</Table.Cell>
                          <Table.Cell>
                            <Badge color={admin.is_active ? 'success' : 'failure'}>
                              {admin.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>
                ) : (
                  <p className="text-gray-500">No admin users assigned yet.</p>
                )}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="gray" onClick={() => setShowViewModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ClientManagement;
