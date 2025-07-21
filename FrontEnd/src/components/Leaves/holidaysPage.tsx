import React, { useState } from "react";
import {
  Table,
  TextInput,
  Button,
  Modal,
  Label,
} from "flowbite-react";
import { HiOutlinePlus } from "react-icons/hi";

const initialHolidays = [
  { date: "2025-01-01", name: "New Year" },
  { date: "2025-01-07", name: "International Programmers’ Day" },
  { date: "2025-02-04", name: "World Cancer Day" },
  { date: "2025-04-01", name: "April Fool Day" },
  { date: "2025-05-07", name: "International Programmer’s Day" },
  { date: "2025-05-22", name: "International Day for Biological Diversity" },
  { date: "2025-06-05", name: "International Day for Biological Diversity" },
  { date: "2025-08-07", name: "International Friendship Day" },
  { date: "2025-09-15", name: "International Day of Democracy" },
  { date: "2025-11-14", name: "World Diabetes Day" },
  { date: "2025-12-25", name: "Merry Christmas" },
];

const HolidayPage = () => {
  const [holidays, setHolidays] = useState(initialHolidays);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ date: "", name: "" });

  const filteredHolidays = holidays.filter((h) =>
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddHoliday = () => {
    if (!newHoliday.date || !newHoliday.name.trim()) return;
    setHolidays([...holidays, newHoliday]);
    setNewHoliday({ date: "", name: "" });
    setModalOpen(false);
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

  return (
    <div className="p-6 bg-white rounded-xl shadow-md w-full space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <TextInput
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <Button
          color="purple"
          className="flex items-center gap-2"
          onClick={() => setModalOpen(true)}
        >
          <HiOutlinePlus className="text-lg" />
          Add New Holiday
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table hoverable>
          <Table.Head>
            <Table.HeadCell>Date</Table.HeadCell>
            <Table.HeadCell>Day</Table.HeadCell>
            <Table.HeadCell>Holiday Name</Table.HeadCell>
          </Table.Head>
          <Table.Body className="divide-y divide-gray-200">
            {filteredHolidays.map((holiday, index) => (
              <Table.Row key={index}>
                <Table.Cell>{formatDate(holiday.date)}</Table.Cell>
                <Table.Cell>{getDay(holiday.date)}</Table.Cell>
                <Table.Cell>{holiday.name}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>

      {/* Legend */}
      <div className="flex gap-6 pt-3 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span> Upcoming
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-500"></span> Past Holidays
        </div>
      </div>

      {/* Add Holiday Modal */}
      <Modal show={modalOpen} onClose={() => setModalOpen(false)}>
        <Modal.Header>Add New Holiday</Modal.Header>
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
              />
            </div>
            <div>
              <Label htmlFor="holiday-name" value="Holiday Name" />
              <TextInput
                id="holiday-name"
                placeholder="e.g., World Environment Day"
                value={newHoliday.name}
                onChange={(e) =>
                  setNewHoliday((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="purple" onClick={handleAddHoliday}>
            Add Holiday
          </Button>
          <Button color="gray" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default HolidayPage;
