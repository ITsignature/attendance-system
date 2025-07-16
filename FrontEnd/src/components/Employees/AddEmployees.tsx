// src/pages/AddEmployeeForm.jsx
import React, { useState } from "react";
import FileUploadBox from "./FileUploadBox";
import {
  TextInput,
  Select,
  Label,
  Button,
  Datepicker,
} from "flowbite-react";
import { HiUser, HiBriefcase, HiDocumentText } from "react-icons/hi";
import { useNavigate } from "react-router";

const AddEmployeeForm = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const handleSubmit = () => {
    console.log("Form submitted!");
    navigate("/employees");
  };

  const tabTitles = [
    { title: "Personal Information", icon: HiUser },
    { title: "Professional Information", icon: HiBriefcase },
    { title: "Documents", icon: HiDocumentText },
  ];

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
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
          </>
        );

      case 1:
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
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
                <input type="checkbox" id="fixed-salary" className="rounded" defaultChecked />
                <Label htmlFor="fixed-salary">Fixed Salary/not</Label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="attendance" className="rounded" defaultChecked />
                <Label htmlFor="attendance">Attendance Allowed/not Allowed</Label>
              </div>
            </div>
          </>
        );

      case 2:
        return (
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
        );
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-md">
      <h3 className="text-xl font-semibold mb-2">Add New Employee</h3>
      <p className="text-sm text-gray-500 mb-6">
        All Employee &gt; Add New Employee
      </p>

      {/* Tabs Header */}
      <div className="flex gap-4 mb-4 border-b border-gray-200">
        {tabTitles.map((tab, index) => (
          <button
            key={index}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition ${
              step === index
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-gray-500 hover:text-purple-600"
            }`}
            onClick={() => setStep(index)}
          >
            <tab.icon className="text-lg" />
            {tab.title}
          </button>
        ))}
      </div>

      {/* Step Content */}
      {renderStepContent()}

      {/* Navigation Buttons */}
      <div className="mt-6 flex justify-end gap-3">
        {step > 0 && (
          <Button color="gray" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        {step < tabTitles.length - 1 ? (
          <Button color="purple" onClick={() => setStep(step + 1)}>
            Next
          </Button>
        ) : (
          <Button color="purple" onClick={handleSubmit}>
            Submit
          </Button>
        )}
      </div>
    </div>
  );
};

export default AddEmployeeForm;
