// src/pages/AddEmployeeForm.jsx
import React from "react";
import FileUploadBox from "../components/FileUploadBox";
import {
  TextInput,
  Select,
  Label,
  Button,
  Datepicker,
  Tabs
} from "flowbite-react";
import { HiUser, HiBriefcase, HiDocumentText } from "react-icons/hi";


const AddEmployeeForm = () => {
  return (
    <div className="p-6 bg-white rounded-xl shadow-md">
      <h3 className="text-xl font-semibold mb-2">Add New Employee</h3>
      <p className="text-sm text-gray-500 mb-6">
        All Employee &gt; Add New Employee
      </p>

      <Tabs>
        {/* Personal Information */}
        <Tabs.Item title="Personal Information" icon={HiUser}>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput placeholder="First Name" />
            <TextInput placeholder="Last Name" />
            <TextInput placeholder="Mobile Number" />
            <TextInput placeholder="Email Address" />
            <Datepicker placeholder="Date of Birth" />
            <Select>
              <option>Marital Status</option>
              <option>Single</option>
              <option>Married</option>
            </Select>
            <Select>
              <option>Gender</option>
              <option>Male</option>
              <option>Female</option>
            </Select>
            <TextInput placeholder="Nationality" />
            <TextInput placeholder="Address" className="md:col-span-2" />
            <Select>
              <option>City</option>
              <option>New York</option>
              <option>London</option>
            </Select>
            <TextInput placeholder="State" />
            <TextInput placeholder="ZIP Code" />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button color="gray">Cancel</Button>
            <Button color="purple">Next</Button>
          </div>
        </Tabs.Item>

        {/* Professional Information */}
        <Tabs.Item title="Professional Information" icon={HiBriefcase}>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput placeholder="Employee ID" />
            <TextInput placeholder="User Name" />
            <Select>
              <option>Select Employee Type</option>
              <option>Permanent</option>
              <option>Contract</option>
            </Select>
            <TextInput placeholder="Email Address" />
            <Select>
              <option>Select Department</option>
              <option>Design</option>
              <option>Development</option>
              <option>HR</option>
            </Select>
            <TextInput placeholder="Enter Designation" />
            <Select>
              <option>Select Working Days</option>
              <option>Mon-Fri</option>
              <option>Mon-Sat</option>
            </Select>
            <Datepicker placeholder="Select Joining Date" />
            <Select>
              <option>Select Office Location</option>
              <option>New York</option>
              <option>Remote</option>
            </Select>
            <TextInput type="time" placeholder="Start time" />
          </div>

          <div className="mt-4 flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="fixed-salary"
                className="rounded"
                defaultChecked
              />
              <Label htmlFor="fixed-salary">Fixed Salary/not</Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="attendance"
                className="rounded"
                defaultChecked
              />
              <Label htmlFor="attendance">Attendance Allowed/not Allowed</Label>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button color="gray">Cancel</Button>
            <Button color="purple">Next</Button>
          </div>
        </Tabs.Item>

        {/* Documents */}
        <Tabs.Item title="Documents" icon={HiDocumentText}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <FileUploadBox
              id="appointment"
              label="Upload Appointment Letter"
              onFileChange={(file) => console.log("Appointment:", file)}
            />
            <FileUploadBox
              id="salary"
              label="Upload Salary Slips"
              onFileChange={(file) => console.log("Salary:", file)}
            />
            <FileUploadBox
              id="relieving"
              label="Upload Relieving Letter"
              onFileChange={(file) => console.log("Relieving:", file)}
            />
            <FileUploadBox
              id="experience"
              label="Upload Experience Letter"
              onFileChange={(file) => console.log("Experience:", file)}
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button color="gray">Cancel</Button>
            <Button color="purple">Next</Button>
          </div>
        </Tabs.Item>
      </Tabs>
    </div>
  );
};

export default AddEmployeeForm;
