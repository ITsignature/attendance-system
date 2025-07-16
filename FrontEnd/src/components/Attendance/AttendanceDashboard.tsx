import React, { useState } from 'react';
import { TextInput, Button, Select, Modal } from "flowbite-react";
import { DynamicProtectedComponent } from "../RBACSystem/rbacSystem";

// Type definitions
interface Employee {
  id: number;
  name: string;
  designation: string;
  type: string;
  checkIn: string;
  checkOut: string;
  status: string;
  avatar: string;
}

interface AttendanceData {
  [date: string]: Employee[];
}

interface EditingCell {
  employeeId: number;
  field: 'checkIn' | 'checkOut';
}

const AttendanceDashboard = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [recordsPerPage, setRecordsPerPage] = useState<number>(10);
  const [selectedDate, setSelectedDate] = useState<string>('2024-06-10');
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [tempValue, setTempValue] = useState<string>('');
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [modalEmployee, setModalEmployee] = useState<Employee | null>(null);
  const [modalCheckIn, setModalCheckIn] = useState<string>('');
  const [modalCheckOut, setModalCheckOut] = useState<string>('');

  // Sample attendance data for different dates
  const [attendanceData, setAttendanceData] = useState<AttendanceData>({
    '2024-06-10': [
      { id: 1, name: 'Leasie Watson', designation: 'Team Lead - Design', type: 'Office', checkIn: '09:27 AM', checkOut: '06:15 PM', status: 'On Time', avatar: '👩‍💼' },
      { id: 2, name: 'Darlene Robertson', designation: 'Web Designer', type: 'Office', checkIn: '10:15 AM', checkOut: '06:45 PM', status: 'Late', avatar: '👩‍🎨' },
      { id: 3, name: 'Jacob Jones', designation: 'Medical Assistant', type: 'Remote', checkIn: '10:24 AM', checkOut: '07:00 PM', status: 'Late', avatar: '👨‍⚕️' },
      { id: 4, name: 'Kathryn Murphy', designation: 'Marketing Coordinator', type: 'Office', checkIn: '09:10 AM', checkOut: '05:30 PM', status: 'On Time', avatar: '👩‍💻' },
      { id: 5, name: 'Leslie Alexander', designation: 'Data Analyst', type: 'Office', checkIn: '09:15 AM', checkOut: '06:00 PM', status: 'On Time', avatar: '👨‍💼' },
      { id: 6, name: 'Ronald Richards', designation: 'Python Developer', type: 'Remote', checkIn: '09:29 AM', checkOut: '06:30 PM', status: 'On Time', avatar: '👨‍💻' },
      { id: 7, name: 'Guy Hawkins', designation: 'UI/UX Design', type: 'Remote', checkIn: '09:29 AM', checkOut: '05:45 PM', status: 'On Time', avatar: '👨‍🎨' },
      { id: 8, name: 'Albert Flores', designation: 'React JS', type: 'Remote', checkIn: '09:29 AM', checkOut: '06:20 PM', status: 'On Time', avatar: '👨‍💻' },
      { id: 9, name: 'Savannah Nguyen', designation: 'iOS Developer', type: 'Remote', checkIn: '10:50 AM', checkOut: '07:30 PM', status: 'Late', avatar: '👩‍💻' },
      { id: 10, name: 'Marvin McKinney', designation: 'HR', type: 'Remote', checkIn: '09:29 AM', checkOut: '05:50 PM', status: 'On Time', avatar: '👨‍💼' },
      { id: 11, name: 'Jerome Bell', designation: 'Sales Manager', type: 'Remote', checkIn: '09:29 AM', checkOut: '06:10 PM', status: 'On Time', avatar: '👨‍💼' },
      { id: 12, name: 'Jenny Wilson', designation: 'React JS Developer', type: 'Remote', checkIn: '11:30 AM', checkOut: 'Not Checked Out', status: 'Late', avatar: '👩‍💻' }
    ],
    '2024-06-11': [
      { id: 1, name: 'Leasie Watson', designation: 'Team Lead - Design', type: 'Office', checkIn: '09:15 AM', checkOut: '06:00 PM', status: 'On Time', avatar: '👩‍💼' },
      { id: 2, name: 'Darlene Robertson', designation: 'Web Designer', type: 'Office', checkIn: '09:45 AM', checkOut: '06:30 PM', status: 'On Time', avatar: '👩‍🎨' },
      { id: 3, name: 'Jacob Jones', designation: 'Medical Assistant', type: 'Remote', checkIn: '09:30 AM', checkOut: '06:45 PM', status: 'On Time', avatar: '👨‍⚕️' },
      { id: 4, name: 'Kathryn Murphy', designation: 'Marketing Coordinator', type: 'Office', checkIn: '10:30 AM', checkOut: '07:15 PM', status: 'Late', avatar: '👩‍💻' },
      { id: 5, name: 'Leslie Alexander', designation: 'Data Analyst', type: 'Office', checkIn: '09:00 AM', checkOut: '05:45 PM', status: 'On Time', avatar: '👨‍💼' },
      { id: 6, name: 'Ronald Richards', designation: 'Python Developer', type: 'Remote', checkIn: '09:20 AM', checkOut: '06:20 PM', status: 'On Time', avatar: '👨‍💻' },
      { id: 7, name: 'Guy Hawkins', designation: 'UI/UX Design', type: 'Remote', checkIn: 'Absent', checkOut: 'Absent', status: 'Absent', avatar: '👨‍🎨' },
      { id: 8, name: 'Albert Flores', designation: 'React JS', type: 'Remote', checkIn: '09:35 AM', checkOut: '06:35 PM', status: 'On Time', avatar: '👨‍💻' },
      { id: 9, name: 'Savannah Nguyen', designation: 'iOS Developer', type: 'Remote', checkIn: '09:25 AM', checkOut: '06:25 PM', status: 'On Time', avatar: '👩‍💻' },
      { id: 10, name: 'Marvin McKinney', designation: 'HR', type: 'Remote', checkIn: '09:40 AM', checkOut: '06:40 PM', status: 'On Time', avatar: '👨‍💼' },
      { id: 11, name: 'Jerome Bell', designation: 'Sales Manager', type: 'Remote', checkIn: '10:45 AM', checkOut: '07:45 PM', status: 'Late', avatar: '👨‍💼' },
      { id: 12, name: 'Jenny Wilson', designation: 'React JS Developer', type: 'Remote', checkIn: '09:30 AM', checkOut: '06:30 PM', status: 'On Time', avatar: '👩‍💻' }
    ],
    '2024-06-12': [
      { id: 1, name: 'Leasie Watson', designation: 'Team Lead - Design', type: 'Office', checkIn: '09:30 AM', checkOut: '06:30 PM', status: 'On Time', avatar: '👩‍💼' },
      { id: 2, name: 'Darlene Robertson', designation: 'Web Designer', type: 'Office', checkIn: '10:00 AM', checkOut: '07:00 PM', status: 'Late', avatar: '👩‍🎨' },
      { id: 3, name: 'Jacob Jones', designation: 'Medical Assistant', type: 'Remote', checkIn: 'Absent', checkOut: 'Absent', status: 'Absent', avatar: '👨‍⚕️' },
      { id: 4, name: 'Kathryn Murphy', designation: 'Marketing Coordinator', type: 'Office', checkIn: '09:05 AM', checkOut: '05:35 PM', status: 'On Time', avatar: '👩‍💻' },
      { id: 5, name: 'Leslie Alexander', designation: 'Data Analyst', type: 'Office', checkIn: '09:20 AM', checkOut: '06:05 PM', status: 'On Time', avatar: '👨‍💼' },
      { id: 6, name: 'Ronald Richards', designation: 'Python Developer', type: 'Remote', checkIn: '09:25 AM', checkOut: '06:25 PM', status: 'On Time', avatar: '👨‍💻' },
      { id: 7, name: 'Guy Hawkins', designation: 'UI/UX Design', type: 'Remote', checkIn: '09:35 AM', checkOut: '05:50 PM', status: 'On Time', avatar: '👨‍🎨' },
      { id: 8, name: 'Albert Flores', designation: 'React JS', type: 'Remote', checkIn: '09:40 AM', checkOut: '06:40 PM', status: 'On Time', avatar: '👨‍💻' },
      { id: 9, name: 'Savannah Nguyen', designation: 'iOS Developer', type: 'Remote', checkIn: '11:00 AM', checkOut: 'Not Checked Out', status: 'Late', avatar: '👩‍💻' },
      { id: 10, name: 'Marvin McKinney', designation: 'HR', type: 'Remote', checkIn: '09:15 AM', checkOut: '05:45 PM', status: 'On Time', avatar: '👨‍💼' },
      { id: 11, name: 'Jerome Bell', designation: 'Sales Manager', type: 'Remote', checkIn: '09:30 AM', checkOut: '06:15 PM', status: 'On Time', avatar: '👨‍💼' },
      { id: 12, name: 'Jenny Wilson', designation: 'React JS Developer', type: 'Remote', checkIn: '09:45 AM', checkOut: '06:45 PM', status: 'On Time', avatar: '👩‍💻' }
    ]
  });

  // Get employees for selected date
  const employees: Employee[] = attendanceData[selectedDate] || [];

  const filteredEmployees = employees.filter((employee: Employee) =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.designation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRecords = filteredEmployees.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentEmployees = filteredEmployees.slice(startIndex, endIndex);

  // Helper function to calculate status based on check-in time
  const calculateStatus = (checkIn: string, checkOut: string): string => {
    if (checkIn === 'Absent' || checkOut === 'Absent') return 'Absent';
    if (checkOut === 'Not Checked Out') return 'Late';
    
    // Simple logic: if check-in is after 10:00 AM, mark as Late
    const checkInTime = new Date(`2024-01-01 ${checkIn}`);
    const lateThreshold = new Date('2024-01-01 10:00 AM');
    
    return checkInTime > lateThreshold ? 'Late' : 'On Time';
  };

  // Handle inline editing
  const handleCellClick = (employeeId: number, field: 'checkIn' | 'checkOut') => {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return;

    setEditingCell({ employeeId, field });
    setTempValue(employee[field]);
  };

  const handleCellSave = () => {
    if (!editingCell) return;

    const updatedData = { ...attendanceData };
    const employeeIndex = updatedData[selectedDate].findIndex(emp => emp.id === editingCell.employeeId);
    
    if (employeeIndex !== -1) {
      updatedData[selectedDate][employeeIndex][editingCell.field] = tempValue;
      
      // Recalculate status
      const employee = updatedData[selectedDate][employeeIndex];
      employee.status = calculateStatus(employee.checkIn, employee.checkOut);
      
      setAttendanceData(updatedData);
    }

    setEditingCell(null);
    setTempValue('');
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setTempValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellSave();
    } else if (e.key === 'Escape') {
      handleCellCancel();
    }
  };

  // Handle modal editing
  const openEditModal = (employee: Employee) => {
    setModalEmployee(employee);
    setModalCheckIn(employee.checkIn);
    setModalCheckOut(employee.checkOut);
    setShowEditModal(true);
  };

  const handleModalSave = () => {
    if (!modalEmployee) return;

    const updatedData = { ...attendanceData };
    const employeeIndex = updatedData[selectedDate].findIndex(emp => emp.id === modalEmployee.id);
    
    if (employeeIndex !== -1) {
      updatedData[selectedDate][employeeIndex].checkIn = modalCheckIn;
      updatedData[selectedDate][employeeIndex].checkOut = modalCheckOut;
      updatedData[selectedDate][employeeIndex].status = calculateStatus(modalCheckIn, modalCheckOut);
      
      setAttendanceData(updatedData);
    }

    setShowEditModal(false);
    setModalEmployee(null);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setModalEmployee(null);
  };

  const renderTimeCell = (employee: Employee, field: 'checkIn' | 'checkOut') => {
    const isEditing = editingCell?.employeeId === employee.id && editingCell?.field === field;
    const value = employee[field];

    if (isEditing) {
      return (
        <input
          type="text"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleCellSave}
          onKeyDown={handleKeyPress}
          autoFocus
          className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50"
          placeholder="e.g., 09:30 AM"
        />
      );
    }

    return (
      <DynamicProtectedComponent 
        permission="attendance.edit"
        fallback={
          <div className={`text-sm ${
            value === 'Absent' 
              ? 'text-red-600 dark:text-red-400 font-medium' 
              : value === 'Not Checked Out'
              ? 'text-orange-600 dark:text-orange-400 font-medium'
              : 'text-gray-900 dark:text-white'
          }`}>
            {value}
          </div>
        }
      >
        <div
          onClick={() => handleCellClick(employee.id, field)}
          className={`text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900 px-2 py-1 rounded transition-colors ${
            value === 'Absent' 
              ? 'text-red-600 dark:text-red-400 font-medium' 
              : value === 'Not Checked Out'
              ? 'text-orange-600 dark:text-orange-400 font-medium'
              : 'text-gray-900 dark:text-white'
          }`}
          title="Click to edit"
        >
          {value}
          <span className="ml-1 text-xs text-gray-400">✏️</span>
        </div>
      </DynamicProtectedComponent>
    );
  };

  return (
    <div className="rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray p-6 relative w-full break-words">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h5 className="card-title">Attendance</h5>
          <p className="text-gray-600 dark:text-gray-400">All Employee Attendance</p>
        </div>
        
        {/* PROTECTED: Bulk Edit Button */}
        <DynamicProtectedComponent permission="attendance.edit">
          <Button
            color="blue"
            size="sm"
            onClick={() => {
              // You can implement bulk edit functionality here
              alert('Bulk edit functionality can be implemented here');
            }}
          >
            📝 Bulk Edit
          </Button>
        </DynamicProtectedComponent>
      </div>
      
      <div className="mt-6">
        {/* Search and Date Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-80">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              🔍
            </div>
            <TextInput
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Date:
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Instructions for editing */}
        <DynamicProtectedComponent permission="attendance.edit">
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900 rounded-lg border border-blue-200 dark:border-blue-700">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 <strong>Editing Instructions:</strong> Click on any check-in or check-out time to edit it inline. 
              Press Enter to save or Escape to cancel. You can also click the "Edit" button for modal editing.
            </p>
          </div>
        </DynamicProtectedComponent>

        {/* Employee Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-6 py-3">Employee Name</th>
                <th scope="col" className="px-6 py-3">Designation</th>
                <th scope="col" className="px-6 py-3">Type</th>
                <th scope="col" className="px-6 py-3">Check In Time</th>
                <th scope="col" className="px-6 py-3">Check Out Time</th>
                <th scope="col" className="px-6 py-3">Status</th>
                <DynamicProtectedComponent permission="attendance.edit">
                  <th scope="col" className="px-6 py-3">Actions</th>
                </DynamicProtectedComponent>
              </tr>
            </thead>
            <tbody>
              {currentEmployees.map((employee: Employee) => (
                <tr key={employee.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center text-lg">
                        {employee.avatar}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{employee.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">{employee.designation}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">{employee.type}</div>
                  </td>
                  <td className="px-6 py-4">
                    {renderTimeCell(employee, 'checkIn')}
                  </td>
                  <td className="px-6 py-4">
                    {renderTimeCell(employee, 'checkOut')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      employee.status === 'On Time'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : employee.status === 'Late'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : employee.status === 'Absent'
                        ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {employee.status}
                    </span>
                  </td>
                  <DynamicProtectedComponent permission="attendance.edit">
                    <td className="px-6 py-4">
                      <Button
                        size="xs"
                        color="blue"
                        onClick={() => openEditModal(employee)}
                      >
                        Edit
                      </Button>
                    </td>
                  </DynamicProtectedComponent>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">Showing</span>
            <Select
              value={recordsPerPage}
              onChange={(e) => setRecordsPerPage(parseInt(e.target.value))}
              className="w-20"
              sizing="sm"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </Select>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Showing {startIndex + 1} to {Math.min(endIndex, totalRecords)} out of {totalRecords} records
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              size="sm"
              color="gray"
              className="p-2"
            >
              ←
            </Button>
            
            {[...Array(Math.min(totalPages, 5))].map((_, index) => {
              let pageNumber;
              if (totalPages <= 5) {
                pageNumber = index + 1;
              } else if (currentPage <= 3) {
                pageNumber = index + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNumber = totalPages - 4 + index;
              } else {
                pageNumber = currentPage - 2 + index;
              }
              
              return (
                <Button
                  key={pageNumber}
                  onClick={() => setCurrentPage(pageNumber)}
                  size="sm"
                  color={currentPage === pageNumber ? 'blue' : 'gray'}
                  className="min-w-[2.5rem]"
                >
                  {pageNumber}
                </Button>
              );
            })}
            
            <Button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              size="sm"
              color="gray"
              className="p-2"
            >
              →
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal show={showEditModal} onClose={closeEditModal} size="md">
        <Modal.Header>
          Edit Attendance - {modalEmployee?.name}
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Check In Time
                </label>
                <TextInput
                  type="text"
                  value={modalCheckIn}
                  onChange={(e) => setModalCheckIn(e.target.value)}
                  placeholder="e.g., 09:30 AM or Absent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Check Out Time
                </label>
                <TextInput
                  type="text"
                  value={modalCheckOut}
                  onChange={(e) => setModalCheckOut(e.target.value)}
                  placeholder="e.g., 06:30 PM or Not Checked Out"
                />
              </div>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900 p-3 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Format Examples:</strong><br/>
                • Times: "09:30 AM", "06:45 PM"<br/>
                • Special cases: "Absent", "Not Checked Out"<br/>
                • Status will be automatically calculated
              </p>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleModalSave} className="bg-blue-600">
            Save Changes
          </Button>
          <Button color="gray" onClick={closeEditModal}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AttendanceDashboard;