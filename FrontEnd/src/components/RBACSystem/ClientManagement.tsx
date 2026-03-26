import React, { useState, useEffect } from 'react';
import { Modal, TextInput, Label, Select, Textarea } from 'flowbite-react';
import { HiPlus, HiOfficeBuilding, HiUserGroup, HiCog, HiEye, HiCheckCircle, HiXCircle, HiClock, HiChat } from 'react-icons/hi';
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
  logo_url?: string;
  sms_enabled: boolean;
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
  useDynamicRBAC();
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

  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsFormData, setSmsFormData] = useState({
    account_id: '',
    password: '',
    base_url: 'https://www.textit.biz/sendmsg',
    enabled: false,
    notification_number: ''
  });
  const [isSmsLoading, setIsSmsLoading] = useState(false);

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

  const handleOpenSmsConfig = async (client: Client) => {
    setSelectedClient(client);
    setError('');
    setSuccess('');
    setIsSmsLoading(true);
    setShowSmsModal(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`http://localhost:5000/api/clients/${client.id}/sms-config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSmsFormData({
          account_id: data.data.account_id || '',
          password: data.data.password || '',
          base_url: data.data.base_url || 'https://www.textit.biz/sendmsg',
          enabled: Boolean(data.data.enabled),
          notification_number: data.data.notification_number || ''
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load SMS config');
    } finally {
      setIsSmsLoading(false);
    }
  };

  const handleSaveSmsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    setIsSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`http://localhost:5000/api/clients/${selectedClient.id}/sms-config`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(smsFormData)
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('SMS configuration saved successfully');
        setShowSmsModal(false);
        loadClients();
      } else {
        setError(data.message || 'Failed to save SMS config');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save SMS config');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCount = clients.filter(c => c.is_active).length;
  const suspendedCount = clients.filter(c => !c.is_active).length;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });

  return (
    <div className="p-6 min-h-screen bg-gray-50 dark:bg-darkgray">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Super Admin Portal</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">IT Signature ERP</p>
        </div>
        <button
          onClick={handleCreateClient}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <HiPlus className="h-4 w-4" />
          Add Company
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {success}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Companies</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{clients.length}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <HiOfficeBuilding className="h-6 w-6 text-blue-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Active Companies</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{activeCount}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <HiCheckCircle className="h-6 w-6 text-green-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Pending Approval</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">0</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
            <HiClock className="h-6 w-6 text-orange-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Suspended</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{suspendedCount}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <HiXCircle className="h-6 w-6 text-red-500" />
          </div>
        </div>
      </div>

      {/* Company List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
          <HiOfficeBuilding className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-gray-500 dark:text-gray-400">No companies yet. Add your first company.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => (
            <div
              key={client.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">{client.name}</h3>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        client.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {client.is_active ? 'active' : 'suspended'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {client.contact_email}
                    {client.phone && <span> | {client.phone}</span>}
                  </p>

                  {/* Stats row */}
                  <div className="flex flex-wrap gap-6 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Employees</span>
                      <span className="ml-2 font-semibold text-gray-900 dark:text-white">{client.employee_count ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">SMS</span>
                      <span className={`ml-2 font-semibold ${client.sms_enabled ? 'text-green-600' : 'text-gray-400'}`}>
                        {client.sms_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Plan</span>
                      <span className="ml-2 font-semibold text-gray-900 dark:text-white capitalize">{client.subscription_plan}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Admins</span>
                      <span className="ml-2 font-semibold text-gray-900 dark:text-white">{client.admin_count ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Created</span>
                      <span className="ml-2 font-semibold text-gray-900 dark:text-white">{formatDate(client.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <button
                    onClick={() => loadClientDetails(client.id)}
                    className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    <HiEye className="h-4 w-4" />
                    View Portal
                  </button>
                  <button
                    onClick={() => handleEditClient(client)}
                    className="flex items-center gap-1.5 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    <HiCog className="h-4 w-4" />
                    Manage
                  </button>
                  <button
                    onClick={() => handleAddAdmin(client)}
                    className="flex items-center gap-1.5 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    title="Add Admin"
                  >
                    <HiUserGroup className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleOpenSmsConfig(client)}
                    className={`flex items-center gap-1.5 border text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                      client.sms_enabled
                        ? 'border-green-200 text-green-600 hover:bg-green-50'
                        : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                    title="SMS Configuration"
                  >
                    <HiChat className="h-4 w-4" />
                    SMS
                  </button>
                  <button
                    onClick={() => handleToggleClientStatus(client)}
                    className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors border ${
                      client.is_active
                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                        : 'border-green-200 text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {client.is_active ? 'Suspend' : 'Activate'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Client Modal */}
      <Modal show={showClientModal} onClose={() => setShowClientModal(false)}>
        <Modal.Header>
          {selectedClient ? 'Edit Company' : 'Add New Company'}
        </Modal.Header>
        <Modal.Body>
          <form onSubmit={handleSubmitClient} className="space-y-4">
            <div>
              <Label htmlFor="name">Company Name *</Label>
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
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClientModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : selectedClient ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </Modal.Body>
      </Modal>

      {/* Add Admin Modal */}
      <Modal show={showAdminModal} onClose={() => setShowAdminModal(false)}>
        <Modal.Header>Add Admin — {selectedClient?.name}</Modal.Header>
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
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Admin'}
              </button>
            </div>
          </form>
        </Modal.Body>
      </Modal>

      {/* SMS Configuration Modal */}
      <Modal show={showSmsModal} onClose={() => setShowSmsModal(false)}>
        <Modal.Header>SMS Configuration — {selectedClient?.name}</Modal.Header>
        <Modal.Body>
          {isSmsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <form onSubmit={handleSaveSmsConfig} className="space-y-4">
              {/* Enable toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Enable SMS</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Send SMS notifications for this company</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSmsFormData(p => ({ ...p, enabled: !p.enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    smsFormData.enabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    smsFormData.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div>
                <Label htmlFor="sms_account_id">Account ID *</Label>
                <TextInput
                  id="sms_account_id"
                  placeholder="e.g. 94XXXXXXXXXX"
                  value={smsFormData.account_id}
                  onChange={(e) => setSmsFormData(p => ({ ...p, account_id: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="sms_password">Password *</Label>
                <TextInput
                  id="sms_password"
                  type="password"
                  placeholder="SMS gateway password"
                  value={smsFormData.password}
                  onChange={(e) => setSmsFormData(p => ({ ...p, password: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="sms_base_url">Gateway Base URL</Label>
                <TextInput
                  id="sms_base_url"
                  placeholder="https://www.textit.biz/sendmsg"
                  value={smsFormData.base_url}
                  onChange={(e) => setSmsFormData(p => ({ ...p, base_url: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1">Leave default for TextIt.biz gateway</p>
              </div>

              <div>
                <Label htmlFor="sms_notification_number">Notification Number (optional)</Label>
                <TextInput
                  id="sms_notification_number"
                  placeholder="e.g. 0771234567"
                  value={smsFormData.notification_number}
                  onChange={(e) => setSmsFormData(p => ({ ...p, notification_number: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1">A copy of every SMS will be sent to this number</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSmsModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          )}
        </Modal.Body>
      </Modal>

      {/* View Client Details Modal */}
      <Modal show={showViewModal} onClose={() => setShowViewModal(false)} size="xl">
        <Modal.Header>{selectedClient?.name} — Details</Modal.Header>
        <Modal.Body>
          {selectedClient && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Contact Email</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedClient.contact_email}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Phone</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedClient.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Subscription Plan</p>
                  <p className="font-medium text-gray-900 dark:text-white capitalize">{selectedClient.subscription_plan}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Address</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedClient.address || '—'}</p>
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Admin Users</h3>
                {clientAdmins.length > 0 ? (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {clientAdmins.map((admin) => (
                          <tr key={admin.id} className="bg-white dark:bg-gray-800">
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{admin.name}</td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{admin.email}</td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{admin.role_name}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                admin.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {admin.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No admin users assigned yet.</p>
                )}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button
            onClick={() => setShowViewModal(false)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ClientManagement;
