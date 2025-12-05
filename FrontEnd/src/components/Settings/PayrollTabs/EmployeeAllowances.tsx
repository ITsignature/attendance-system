import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, DollarSign, User } from 'lucide-react';
import payrollConfigApi, { EmployeeAllowance, CreateEmployeeAllowanceRequest } from '../../../services/payrollConfigApi';
import apiService from '../../../services/api';
import { useDynamicRBAC } from '../../RBACSystem/rbacSystem';

interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  department_name?: string;
  designation_title?: string;
}

const EmployeeAllowances: React.FC = () => {
  const { hasPermission } = useDynamicRBAC();
  const [allowances, setAllowances] = useState<EmployeeAllowance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAllowance, setEditingAllowance] = useState<EmployeeAllowance | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');

  // Permission checks
  const canAdd = hasPermission('settings.employee_allowances.add');
  const canEdit = hasPermission('settings.employee_allowances.edit');
  const canDelete = hasPermission('settings.employee_allowances.delete');

  const [formData, setFormData] = useState<CreateEmployeeAllowanceRequest>({
    employee_id: '',
    allowance_type: '',
    allowance_name: '',
    amount: 0,
    is_percentage: false,
    is_taxable: true,
    effective_from: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [allowancesData, employeesResponse] = await Promise.all([
        payrollConfigApi.getEmployeeAllowances(),
        apiService.getEmployees({ limit: 10000, page: 1, status: 'active' })
      ]);

      setAllowances(allowancesData);

      // Handle different possible response structures
      let employeesArray: Employee[] = [];
      if (employeesResponse.data) {
        if (Array.isArray(employeesResponse.data)) {
          employeesArray = employeesResponse.data;
        } else if (employeesResponse.data.employees && Array.isArray(employeesResponse.data.employees)) {
          employeesArray = employeesResponse.data.employees;
        } else if (employeesResponse.data.data && Array.isArray(employeesResponse.data.data)) {
          employeesArray = employeesResponse.data.data;
        }
      }

      console.log('Employees response:', employeesResponse);
      console.log('Parsed employees array:', employeesArray);
      setEmployees(employeesArray);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAllowance) {
        await payrollConfigApi.updateEmployeeAllowance(editingAllowance.id, formData);
        alert('Allowance updated successfully!');
      } else {
        await payrollConfigApi.createEmployeeAllowance(formData);
        alert('Allowance created successfully!');
      }

      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving allowance:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to save allowance';

      // Check if it's a permission error
      if (errorMsg.includes('Access denied') || errorMsg.includes('permission')) {
        alert('You do not have permission to modify these settings.');
      } else {
        alert(errorMsg);
      }
    }
  };

  const handleEdit = (allowance: EmployeeAllowance) => {
    setEditingAllowance(allowance);
    setFormData({
      employee_id: allowance.employee_id,
      allowance_type: allowance.allowance_type,
      allowance_name: allowance.allowance_name,
      amount: allowance.amount,
      is_percentage: allowance.is_percentage,
      is_taxable: allowance.is_taxable,
      effective_from: allowance.effective_from,
      effective_to: allowance.effective_to
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this allowance?')) {
      try {
        await payrollConfigApi.deleteEmployeeAllowance(id);
        alert('Allowance deleted successfully!');
        fetchData();
      } catch (error) {
        console.error('Error deleting allowance:', error);
        const errorMsg = error instanceof Error ? error.message : 'Failed to delete allowance';

        // Check if it's a permission error
        if (errorMsg.includes('Access denied') || errorMsg.includes('permission')) {
          alert('You do not have permission to delete these settings.');
        } else {
          alert(errorMsg);
        }
      }
    }
  };

  const resetForm = () => {
    setFormData({
      employee_id: '',
      allowance_type: '',
      allowance_name: '',
      amount: 0,
      is_percentage: false,
      is_taxable: true,
      effective_from: new Date().toISOString().split('T')[0]
    });
    setEditingAllowance(null);
    setShowForm(false);
  };

  const filteredAllowances = allowances.filter(allowance => {
    const matchesSearch = allowance.allowance_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         allowance.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         allowance.employee_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEmployee = !selectedEmployee || allowance.employee_id === selectedEmployee;
    return matchesSearch && matchesEmployee;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading allowances...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
            Employee Allowances
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Assign specific allowances to individual employees
          </p>
        </div>
        {canAdd && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Allowance
          </button>
        )}
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by employee or allowance name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">All Employees</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.employee_code} - {emp.first_name} {emp.last_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Allowances Grid */}
      <div className="grid gap-4">
        {filteredAllowances.map((allowance) => (
          <div key={allowance.id} className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h5 className="text-lg font-medium text-gray-900 dark:text-white">
                    {allowance.allowance_name}
                  </h5>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    {allowance.is_percentage ? `${allowance.amount}%` : `Rs.${allowance.amount}`}
                  </span>
                  {allowance.is_taxable && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                      Taxable
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Employee:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {allowance.employee_code} - {allowance.employee_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Type:</span>
                    <span className="ml-2 text-gray-900 dark:text-white capitalize">
                      {allowance.allowance_type.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Effective From:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {new Date(allowance.effective_from).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Status:</span>
                    <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                      allowance.is_active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}>
                      {allowance.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex space-x-2">
                {canEdit && (
                  <button
                    onClick={() => handleEdit(allowance)}
                    className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors dark:text-blue-400 dark:hover:text-blue-200 dark:hover:bg-blue-900"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleDelete(allowance.id)}
                    className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors dark:text-red-400 dark:hover:text-red-200 dark:hover:bg-red-900"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredAllowances.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 text-lg">No allowances found</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">Add allowances to specific employees</p>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white dark:bg-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {editingAllowance ? 'Edit' : 'Add'} Employee Allowance
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Employee
                </label>
                <select
                  required
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  disabled={!!editingAllowance}
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employee_code} - {emp.first_name} {emp.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Allowance Type
                </label>
                <select
                  required
                  value={formData.allowance_type}
                  onChange={(e) => setFormData({ ...formData, allowance_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Select Type</option>
                  {payrollConfigApi.getAllowanceTypes().map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Allowance Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.allowance_name}
                  onChange={(e) => setFormData({ ...formData, allowance_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="e.g., Housing Allowance, Travel Allowance"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {formData.is_percentage ? 'Percentage (%)' : 'Amount (₹)'}
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Effective From
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.effective_from}
                    onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Effective To (Optional)
                </label>
                <input
                  type="date"
                  value={formData.effective_to || ''}
                  onChange={(e) => setFormData({ ...formData, effective_to: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_percentage"
                    checked={formData.is_percentage}
                    onChange={(e) => setFormData({ ...formData, is_percentage: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_percentage" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                    Percentage of base salary
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_taxable"
                    checked={formData.is_taxable}
                    onChange={(e) => setFormData({ ...formData, is_taxable: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_taxable" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                    Taxable allowance
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 border border-transparent rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  {editingAllowance ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeAllowances;