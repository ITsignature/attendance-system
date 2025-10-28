import { useState } from "react";
import { TextInput, Button, Table, Badge, Modal, Label } from "flowbite-react";
import { format } from "date-fns";

// Mock Data
const initialData = [
  {
    id: 1,
    name: "Leasie Watson",
    designation: "Team Lead - Design",
    type: "Office",
    checkIn: "09:27",
    checkOut: "18:00",
    status: "On Time",
    avatar: "https://randomuser.me/api/portraits/women/11.jpg",
    date: "2025-07-04",
  },
  {
    id: 2,
    name: "Darlene Robertson",
    designation: "Web Designer",
    type: "Office",
    checkIn: "10:15",
    checkOut: "18:30",
    status: "Late",
    avatar: "https://randomuser.me/api/portraits/women/12.jpg",
    date: "2025-07-04",
  },
];

const AttendancePage = () => {
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [attendanceData, setAttendanceData] = useState(initialData);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<"checkIn" | "checkOut" | null>(null);
  const [currentEdit, setCurrentEdit] = useState<{ id: number; value: string }>({ id: 0, value: "" });

  const filteredData = attendanceData.filter(
    (emp) =>
      emp.date === selectedDate &&
      (emp.name.toLowerCase().includes(search.toLowerCase()) ||
        emp.designation.toLowerCase().includes(search.toLowerCase()))
  );

  const openModal = (id: number, type: "checkIn" | "checkOut", currentValue: string) => {
    setCurrentEdit({ id, value: currentValue });
    setEditingField(type);
    setModalOpen(true);
  };

  const saveTimeChange = () => {
    const updated = attendanceData.map((emp) =>
      emp.id === currentEdit.id ? { ...emp, [editingField!]: currentEdit.value } : emp
    );
    setAttendanceData(updated);
    setModalOpen(false);
  };

  return (
    <div className="rounded-xl shadow-md bg-white dark:bg-darkgray p-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <TextInput
          type="search"
          placeholder="Search employee"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <input
          type="date"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm dark:bg-darkgray dark:text-white"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {filteredData.length > 0 ? (
          <Table hoverable>
            <Table.Head>
              <Table.HeadCell className="p-6">Employee Name</Table.HeadCell>
              <Table.HeadCell>Designation</Table.HeadCell>
              <Table.HeadCell>Type</Table.HeadCell>
              <Table.HeadCell>Check-In</Table.HeadCell>
              <Table.HeadCell>Check-Out</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {filteredData.map((emp) => (
                <Table.Row key={emp.id}>
                  <Table.Cell className="ps-6">
                    <div className="flex items-center gap-3">
                      <img
                        src={emp.avatar}
                        alt={emp.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <span>{emp.name}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{emp.designation}</Table.Cell>
                  <Table.Cell>{emp.type}</Table.Cell>
                  <Table.Cell onClick={() => openModal(emp.id, "checkIn", emp.checkIn)}>
                    <span className="underline text-blue-600 cursor-pointer">{emp.checkIn}</span>
                  </Table.Cell>
                  <Table.Cell onClick={() => openModal(emp.id, "checkOut", emp.checkOut)}>
                    <span className="underline text-blue-600 cursor-pointer">{emp.checkOut}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      color={emp.status === "On Time" ? "success" : "failure"}
                      className={
                        emp.status === "On Time" ? "text-green-700" : "text-red-700"
                      }
                    >
                      {emp.status}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : (
          <div className="text-center text-gray-500 py-10">
            No records found for <strong>{format(new Date(selectedDate), "MMM dd, yyyy")}</strong>
          </div>
        )}
      </div>

      {/* Time Edit Modal */}
      <Modal show={modalOpen} onClose={() => setModalOpen(false)}>
        <Modal.Header>Edit {editingField === "checkIn" ? "Check-In" : "Check-Out"} Time</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <Label htmlFor="time">Select Time</Label>
            <input
              type="time"
              value={currentEdit.value}
              onChange={(e) => setCurrentEdit((prev) => ({ ...prev, value: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="purple" onClick={saveTimeChange}>Save</Button>
          <Button color="gray" onClick={() => setModalOpen(false)}>Cancel</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AttendancePage;
