import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Minus, User, AlertCircle } from 'lucide-react';
import payrollConfigApi, { EmployeeDeduction, CreateEmployeeDeductionRequest } from '../../../services/payrollConfigApi';
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

const EmployeeDeductions: React.FC = () => {
  const { hasPermission } = useDynamicRBAC();
  const [deductions, setDeductions] = useState<EmployeeDeduction[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDeduction, setEditingDeduction] = useState<EmployeeDeduction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');

  // Permission checks
  const canAdd = hasPermission('settings.employee_deductions.add');
  const canEdit = hasPermission('settings.employee_deductions.edit');
  const canDelete = hasPermission('settings.employee_deductions.delete');

  const [formData, setFormData] = useState<CreateEmployeeDeductionRequest>({
    employee_id: '',
    deduction_type: '',
    deduction_name: '',
    amount: 0,
    is_percentage: false,
    is_recurring: true,
    effective_from: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [deductionsData, employeesResponse] = await Promise.all([
        payrollConfigApi.getEmployeeDeductions(),
        apiService.getEmployees({ limit: 10000, page: 1, status: 'active' })
      ]);

      setDeductions(deductionsData);

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
      if (editingDeduction) {
        await payrollConfigApi.updateEmployeeDeduction(editingDeduction.id, formData);
        alert('Deduction updated successfully!');
      } else {
        await payrollConfigApi.createEmployeeDeduction(formData);
        alert('Deduction created successfully!');
      }

      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving deduction:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to save deduction';

      // Check if it's a permission error
      if (errorMsg.includes('Access denied') || errorMsg.includes('permission')) {
        alert('You do not have permission to modify these settings.');
      } else {
        // Display the error message (includes validation errors)
        alert(errorMsg);
      }
    }
  };

  const handleEdit = (deduction: EmployeeDeduction) => {
    setEditingDeduction(deduction);
    setFormData({
      employee_id: deduction.employee_id,
      deduction_type: deduction.deduction_type,
      deduction_name: deduction.deduction_name,
      amount: deduction.amount,
      is_percentage: deduction.is_percentage,
      is_recurring: deduction.is_recurring,
      remaining_installments: deduction.remaining_installments,
      effective_from: deduction.effective_from,
      effective_to: deduction.effective_to
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this deduction?')) {
      try {
        await payrollConfigApi.deleteEmployeeDeduction(id);
        alert('Deduction deleted successfully!');
        fetchData();
      } catch (error) {
        console.error('Error deleting deduction:', error);
        const errorMsg = error instanceof Error ? error.message : 'Failed to delete deduction';

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
      deduction_type: '',
      deduction_name: '',
      amount: 0,
      is_percentage: false,
      is_recurring: true,
      effective_from: new Date().toISOString().split('T')[0]
    });
    setEditingDeduction(null);
    setShowForm(false);
  };

  const filteredDeductions = deductions.filter(deduction => {
    const matchesSearch = deduction.deduction_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         deduction.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         deduction.employee_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEmployee = !selectedEmployee || deduction.employee_id === selectedEmployee;
    return matchesSearch && matchesEmployee;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading deductions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
            <Minus className="w-5 h-5 mr-2" />
            Employee Deductions
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage employee-specific deductions like loans, advances, and penalties
          </p>
        </div>
        {canAdd && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Deduction
          </button>
        )}
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by employee or deduction name..."
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

      {/* Deductions Grid */}
      <div className="grid gap-4">
        {filteredDeductions.map((deduction) => (
          <div key={deduction.id} className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h5 className="text-lg font-medium text-gray-900 dark:text-white">
                    {deduction.deduction_name}
                  </h5>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                    {deduction.is_percentage ? `${deduction.amount}%` : `Rs.${deduction.amount}`}
                  </span>
                  {!deduction.is_recurring && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                      One-time
                    </span>
                  )}
                  {deduction.remaining_installments && deduction.remaining_installments > 0 && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {deduction.remaining_installments} left
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Employee:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {deduction.employee_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Type:</span>
                    <span className="ml-2 text-gray-900 dark:text-white capitalize">
                      {deduction.deduction_type.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Effective From:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {new Date(deduction.effective_from).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Recurring:</span>
                    <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                      deduction.is_recurring
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}>
                      {deduction.is_recurring ? 'Yes' : 'No'}
                    </span>
                  </div>
                  {deduction.effective_to && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Effective To:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">
                        {new Date(deduction.effective_to).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Status:</span>
                    <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                      deduction.is_active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}>
                      {deduction.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex space-x-2">
                {canEdit && (
                  <button
                    onClick={() => handleEdit(deduction)}
                    className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors dark:text-blue-400 dark:hover:text-blue-200 dark:hover:bg-blue-900"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleDelete(deduction.id)}
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

      {filteredDeductions.length === 0 && (
        <div className="text-center py-12">
          <Minus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg">No deductions found</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">Add deductions for specific employees</p>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white dark:bg-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {editingDeduction ? 'Edit' : 'Add'} Employee Deduction
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
                  disabled={!!editingDeduction}
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
                  Deduction Type
                </label>
                <select
                  required
                  value={formData.deduction_type}
                  onChange={(e) => setFormData({ ...formData, deduction_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Select Type</option>
                  {payrollConfigApi.getDeductionTypes().map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Deduction Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.deduction_name}
                  onChange={(e) => setFormData({ ...formData, deduction_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="e.g., Personal Loan, Advance Salary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {formData.is_percentage ? 'Percentage (%)' : 'Amount (Rs.)'}
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
                    Installments (Optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.remaining_installments || ''}
                    onChange={(e) => setFormData({ ...formData, remaining_installments: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="e.g., 12"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                    Percentage of salary
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_recurring"
                    checked={formData.is_recurring}
                    onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_recurring" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                    Recurring deduction
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
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  {editingDeduction ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDeductions;