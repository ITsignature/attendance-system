import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Filter, Settings } from 'lucide-react';
import payrollConfigApi, { PayrollComponent, CreatePayrollComponentRequest } from '../../../services/payrollConfigApi';
import { useDynamicRBAC } from '../../RBACSystem/rbacSystem';

const PayrollComponents: React.FC = () => {
  const { hasPermission } = useDynamicRBAC();
  const [components, setComponents] = useState<PayrollComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingComponent, setEditingComponent] = useState<PayrollComponent | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'earning' | 'deduction'>('all');

  // Permission checks
  const canAdd = hasPermission('settings.payroll_components.add');
  const canEdit = hasPermission('settings.payroll_components.edit');
  const canDelete = hasPermission('settings.payroll_components.delete');

  const [formData, setFormData] = useState<CreatePayrollComponentRequest>({
    component_name: '',
    component_type: 'earning',
    category: '',
    calculation_type: 'fixed',
    calculation_value: 0,
    calculation_formula: '',
    is_taxable: true,
    is_mandatory: false,
    applies_to: 'all',
    applies_to_ids: []
  });

  useEffect(() => {
    fetchComponents();
  }, []);

  const fetchComponents = async () => {
    try {
      setLoading(true);
      const data = await payrollConfigApi.getPayrollComponents();
      setComponents(data);
    } catch (error) {
      console.error('Error fetching payroll components:', error);
      alert('Failed to fetch payroll components');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingComponent) {
        await payrollConfigApi.updatePayrollComponent(editingComponent.id, formData);
        alert('Component updated successfully!');
      } else {
        await payrollConfigApi.createPayrollComponent(formData);
        alert('Component created successfully!');
      }

      resetForm();
      fetchComponents();
    } catch (error) {
      console.error('Error saving component:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to save component';

      // Check if it's a permission error
      if (errorMsg.includes('Access denied') || errorMsg.includes('permission')) {
        alert('You do not have permission to modify these settings.');
      } else {
        alert(errorMsg);
      }
    }
  };

  const handleEdit = (component: PayrollComponent) => {
    setEditingComponent(component);
    setFormData({
      component_name: component.component_name,
      component_type: component.component_type,
      category: component.category,
      calculation_type: component.calculation_type,
      calculation_value: component.calculation_value,
      calculation_formula: component.calculation_formula || '',
      is_taxable: component.is_taxable,
      is_mandatory: component.is_mandatory,
      applies_to: component.applies_to,
      applies_to_ids: component.applies_to_ids || []
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this component?')) {
      try {
        await payrollConfigApi.deletePayrollComponent(id);
        alert('Component deleted successfully!');
        fetchComponents();
      } catch (error) {
        console.error('Error deleting component:', error);
        const errorMsg = error instanceof Error ? error.message : 'Failed to delete component';

        // Check if it's a permission error
        if (errorMsg.includes('Access denied') || errorMsg.includes('permission')) {
          alert('You do not have permission to delete these settings.');
        } else {
          alert(errorMsg || 'Failed to delete component. It may be in use.');
        }
      }
    }
  };

  const resetForm = () => {
    setFormData({
      component_name: '',
      component_type: 'earning',
      category: '',
      calculation_type: 'fixed',
      calculation_value: 0,
      calculation_formula: '',
      is_taxable: true,
      is_mandatory: false,
      applies_to: 'all',
      applies_to_ids: []
    });
    setEditingComponent(null);
    setShowForm(false);
  };

  const filteredComponents = components.filter(component => {
    const matchesSearch = component.component_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         component.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || component.component_type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading components...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            Payroll Components
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage salary components like allowances, deductions, and bonuses
          </p>
        </div>
        {canAdd && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Component
          </button>
        )}
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search components..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="all">All Types</option>
            <option value="earning">Earnings</option>
            <option value="deduction">Deductions</option>
          </select>
        </div>
      </div>

      {/* Components Grid */}
      <div className="grid gap-4">
        {filteredComponents.map((component) => (
          <div key={component.id} className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h5 className="text-lg font-medium text-gray-900 dark:text-white">
                    {component.component_name}
                  </h5>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    component.component_type === 'earning'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {component.component_type}
                  </span>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    component.is_taxable
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}>
                    {component.is_taxable ? 'Taxable' : 'Non-taxable'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Category:</span>
                    <span className="ml-2 text-gray-900 dark:text-white capitalize">{component.category}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Calculation:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {component.calculation_type === 'fixed' && `Rs.${component.calculation_value}`}
                      {component.calculation_type === 'percentage' && `${component.calculation_value}%`}
                      {component.calculation_type === 'formula' && 'Custom Formula'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Applies to:</span>
                    <span className="ml-2 text-gray-900 dark:text-white capitalize">{component.applies_to}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Status:</span>
                    <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                      component.is_active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}>
                      {component.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex space-x-2">
                {canEdit && (
                  <button
                    onClick={() => handleEdit(component)}
                    className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors dark:text-blue-400 dark:hover:text-blue-200 dark:hover:bg-blue-900"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleDelete(component.id)}
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

      {filteredComponents.length === 0 && (
        <div className="text-center py-12">
          <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg">No components found</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">Create your first payroll component to get started</p>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {editingComponent ? 'Edit' : 'Add'} Payroll Component
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Component Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.component_name}
                  onChange={(e) => setFormData({ ...formData, component_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="e.g., House Allowance, Transport Allowance"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Component Type
                  </label>
                  <select
                    value={formData.component_type}
                    onChange={(e) => setFormData({ ...formData, component_type: e.target.value as 'earning' | 'deduction' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="earning">Earning</option>
                    <option value="deduction">Deduction</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">Select Category</option>
                    {payrollConfigApi.getComponentCategories().map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Calculation Method
                </label>
                <select
                  value={formData.calculation_type}
                  onChange={(e) => setFormData({ ...formData, calculation_type: e.target.value as 'fixed' | 'percentage' | 'formula' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  {payrollConfigApi.getCalculationTypes().map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {formData.calculation_type !== 'formula' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {formData.calculation_type === 'percentage' ? 'Percentage (%)' : 'Amount (Rs.)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.calculation_value}
                    onChange={(e) => setFormData({ ...formData, calculation_value: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              )}

              {formData.calculation_type === 'formula' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Custom Formula
                  </label>
                  <textarea
                    value={formData.calculation_formula}
                    onChange={(e) => setFormData({ ...formData, calculation_formula: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="e.g., overtime_hours * hourly_rate * 1.5"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Available variables: basic_salary, overtime_hours, worked_days, hourly_rate
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center">
                  {/* <input
                    type="checkbox"
                    id="is_taxable"
                    checked={formData.is_taxable}
                    onChange={(e) => setFormData({ ...formData, is_taxable: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  /> */}
                  {/* <label htmlFor="is_taxable" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                    Include in taxable income
                  </label> */}
                </div>

                <div className="flex items-center">
                  {/* <input
                    type="checkbox"
                    id="is_mandatory"
                    checked={formData.is_mandatory}
                    onChange={(e) => setFormData({ ...formData, is_mandatory: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  /> */}
                  {/* <label htmlFor="is_mandatory" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                    Mandatory for all employees
                  </label> */}
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
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {editingComponent ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollComponents;