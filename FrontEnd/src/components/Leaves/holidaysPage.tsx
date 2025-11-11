import React, { useState, useEffect } from "react";
import {
  Table,
  TextInput,
  Button,
  Modal,
  Label,
  Select,
  Spinner,
  Alert,
} from "flowbite-react";
import { HiOutlinePlus, HiOutlineDownload, HiOutlineTrash } from "react-icons/hi";
import holidayService, { Holiday } from "../../services/holidayService";
import { useDynamicRBAC } from "../RBACSystem/rbacSystem";

const HolidayPage = () => {
  const { hasPermission } = useDynamicRBAC();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [newHoliday, setNewHoliday] = useState({
    date: "",
    name: "",
    description: "",
    is_optional: false
  });

  // Load holidays when year changes
  useEffect(() => {
    loadHolidays();
  }, [selectedYear]);

  const loadHolidays = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await holidayService.getHolidaysForYear(selectedYear);
      setHolidays(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load holidays');
      console.error('Error loading holidays:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredHolidays = holidays.filter((h) =>
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddHoliday = async () => {
    if (!newHoliday.date || !newHoliday.name.trim()) return;
    
    setLoading(true);
    try {
      if (editingHoliday) {
        // Update existing holiday
        await holidayService.updateHoliday(editingHoliday.id!, newHoliday);
      } else {
        // Create new holiday
        await holidayService.createHoliday({
          ...newHoliday,
          applies_to_all: true
        });
      }
      
      // Reload holidays
      await loadHolidays();
      
      // Reset form
      setNewHoliday({ date: "", name: "", description: "", is_optional: false });
      setEditingHoliday(null);
      setModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save holiday');
      console.error('Error saving holiday:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditHoliday = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setNewHoliday({
      date: holiday.date,
      name: holiday.name,
      description: holiday.description || "",
      is_optional: holiday.is_optional || false
    });
    setModalOpen(true);
  };

  const handleDeleteHoliday = async (holiday: Holiday) => {
    if (!confirm(`Are you sure you want to delete "${holiday.name}"?`)) {
      return;
    }
    
    setLoading(true);
    try {
      await holidayService.deleteHoliday(holiday.id!);
      await loadHolidays();
    } catch (err: any) {
      setError(err.message || 'Failed to delete holiday');
      console.error('Error deleting holiday:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImportSriLankanHolidays = async () => {
    setLoading(true);
    try {
      const result = await holidayService.importSriLankanHolidays(selectedYear);
      await loadHolidays();
      
      alert(`Import completed!\nCreated: ${result.created_count}\nSkipped: ${result.skipped_count}\nErrors: ${result.error_count}`);
    } catch (err: any) {
      setError(err.message || 'Failed to import holidays');
      console.error('Error importing holidays:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingHoliday(null);
    setNewHoliday({ date: "", name: "", description: "", is_optional: false });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  };

  const getDay = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { weekday: "long" });

  const getHolidayTypeColor = (is_optional?: boolean) => {
    return is_optional ? 'bg-orange-500' : 'bg-blue-500';
  };

  const getHolidayTypeName = (is_optional?: boolean) => {
    return is_optional ? 'Optional' : 'Mandatory';
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-md w-full space-y-5">
      {/* Error Alert */}
      {error && (
        <Alert color="failure" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <TextInput
            placeholder="Search holidays..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:max-w-xs"
            disabled={loading}
          />
          <Select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="w-full sm:max-w-xs"
            disabled={loading}
          >
            {Array.from({ length: 10 }, (_, i) => {
              const year = new Date().getFullYear() - 2 + i;
              return (
                <option key={year} value={year}>
                  {year}
                </option>
              );
            })}
          </Select>
        </div>
        <div className="flex gap-2">
          {hasPermission('holidays.create') && (
            <Button
              color="blue"
              className="flex items-center gap-2"
              onClick={handleImportSriLankanHolidays}
              disabled={loading}
            >
              <HiOutlineDownload className="text-lg" />
              Import SL Holidays
            </Button>
          )}
          {hasPermission('holidays.create') && (
            <Button
              color="purple"
              className="flex items-center gap-2"
              onClick={() => setModalOpen(true)}
              disabled={loading}
            >
              <HiOutlinePlus className="text-lg" />
              Add Holiday
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading && (
          <div className="flex justify-center items-center p-8">
            <Spinner size="lg" />
            <span className="ml-2">Loading holidays...</span>
          </div>
        )}
        
        {!loading && (
          <Table hoverable>
            <Table.Head>
              <Table.HeadCell>Date</Table.HeadCell>
              <Table.HeadCell>Day</Table.HeadCell>
              <Table.HeadCell>Holiday Name</Table.HeadCell>
              <Table.HeadCell>Type</Table.HeadCell>
              <Table.HeadCell>Actions</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y divide-gray-200">
              {filteredHolidays.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={5} className="text-center py-8 text-gray-500">
                    {holidays.length === 0 ? "No holidays found. Try importing Sri Lankan holidays." : "No holidays match your search."}
                  </Table.Cell>
                </Table.Row>
              ) : (
                filteredHolidays.map((holiday) => (
                  <Table.Row key={holiday.id || holiday.name}>
                    <Table.Cell>{formatDate(holiday.date)}</Table.Cell>
                    <Table.Cell>{getDay(holiday.date)}</Table.Cell>
                    <Table.Cell>
                      <div>
                        <div className="font-medium">{holiday.name}</div>
                        {holiday.description && (
                          <div className="text-sm text-gray-500">{holiday.description}</div>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${getHolidayTypeColor(holiday.is_optional)}`}>
                        {getHolidayTypeName(holiday.is_optional)}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-2">
                        {hasPermission('holidays.edit') && (
                          <Button
                            size="xs"
                            color="blue"
                            onClick={() => handleEditHoliday(holiday)}
                            disabled={loading}
                          >
                            Edit
                          </Button>
                        )}
                        {hasPermission('holidays.delete') && (
                          <Button
                            size="xs"
                            color="red"
                            onClick={() => handleDeleteHoliday(holiday)}
                            disabled={loading}
                          >
                            <HiOutlineTrash />
                          </Button>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-6 pt-3 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span> Mandatory Holidays
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500"></span> Optional Holidays
        </div>
      </div>

      {/* Add/Edit Holiday Modal */}
      <Modal show={modalOpen} onClose={handleCloseModal}>
        <Modal.Header>{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <Label htmlFor="holiday-date" value="Date" />
              <input
                type="date"
                id="holiday-date"
                value={newHoliday.date}
                onChange={(e) =>
                  setNewHoliday((prev) => ({ ...prev, date: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm"
                disabled={loading}
              />
            </div>
            <div>
              <Label htmlFor="holiday-name" value="Holiday Name" />
              <TextInput
                id="holiday-name"
                placeholder="e.g., Company Anniversary"
                value={newHoliday.name}
                onChange={(e) =>
                  setNewHoliday((prev) => ({ ...prev, name: e.target.value }))
                }
                disabled={loading}
              />
            </div>
            <div>
              <Label htmlFor="holiday-description" value="Description (Optional)" />
              <TextInput
                id="holiday-description"
                placeholder="e.g., Annual company celebration"
                value={newHoliday.description}
                onChange={(e) =>
                  setNewHoliday((prev) => ({ ...prev, description: e.target.value }))
                }
                disabled={loading}
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="holiday-optional"
                checked={newHoliday.is_optional}
                onChange={(e) =>
                  setNewHoliday((prev) => ({ ...prev, is_optional: e.target.checked }))
                }
                className="mr-2"
                disabled={loading}
              />
              <Label htmlFor="holiday-optional" value="Optional Holiday" />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            color="purple" 
            onClick={handleAddHoliday}
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                {editingHoliday ? 'Updating...' : 'Adding...'}
              </>
            ) : (
              editingHoliday ? 'Update Holiday' : 'Add Holiday'
            )}
          </Button>
          <Button color="gray" onClick={handleCloseModal} disabled={loading}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default HolidayPage;
