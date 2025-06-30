import React, { useState } from "react";
import { Tabs, TextInput, Select, Button } from "flowbite-react";
import { HiUser, HiBriefcase, HiDocumentText } from "react-icons/hi";
import { useNavigate } from "react-router-dom";
import FileUploadBox from "src/components/FileUploadBox";

const EditEmployeeDetails = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    personal: {
      firstName: "Brooklyn",
      lastName: "Simmons",
      mobile: "(702) 555-0122",
      email: "brooklyn.s@example.com",
      dob: "1995-07-14",
      maritalStatus: "Married",
      gender: "Female",
      nationality: "America",
      address: "2464 Royal Ln. Mesa, New Jersey",
      city: "California",
      state: "United State",
      zip: "35624",
    },
    professional: {
      empId: "879912390",
      username: "brooklyn_simmons",
      type: "Office",
      email: "brooklyn.s@example.com",
      department: "Project Manager",
      designation: "Project Manager",
      workingDays: "5 Days",
      joiningDate: "2022-07-10",
      location: "2464 Royal Ln. Mesa, New Jersey",
    },
  });

 const handleChange = (section: string, field: string, value: string) => {
  setForm((prev) => ({
    ...prev,
    [section]: {
      ...((prev as any)[section]),
      [field]: value,
    },
  }));
};

  const handleSave = () => {
    console.log("Saving:", form);
    navigate(`/employee/${form.professional.empId}`)
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-md">
      <h3 className="text-xl font-semibold mb-2">Edit Employee Details</h3>
      <p className="text-sm text-gray-500 mb-6">Employee &gt; Edit Details</p>

      <Tabs aria-label="Edit Employee Info Tabs">
        <Tabs.Item title="Personal Information" icon={HiUser}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {Object.entries(form.personal).map(([field, value]) => (
              <TextInput
                key={field}
                value={value}
                onChange={(e) =>
                  handleChange("personal", field, e.target.value)
                }
                placeholder={field}
                type={
                  field.toLowerCase().includes("date") ? "date" : "text"
                }
              />
            ))}
          </div>
        </Tabs.Item>

        <Tabs.Item title="Professional Information" icon={HiBriefcase}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {Object.entries(form.professional).map(([field, value]) => (
              <TextInput
                key={field}
                value={value}
                onChange={(e) =>
                  handleChange("professional", field, e.target.value)
                }
                placeholder={field}
                type={
                  field.toLowerCase().includes("date") ? "date" : "text"
                }
              />
            ))}
          </div>
        </Tabs.Item>

       <Tabs.Item title="Documents" icon={HiDocumentText}>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
    {["Appointment Letter", "Salary Slip", "Relieving Letter", "Experience Letter"].map((label, index) => (
     <div >
            <FileUploadBox
              id="appointment"
              label={label}
              onFileChange={(file) => console.log("Appointment:", file)}
            />
          </div>
    ))}
  </div>
</Tabs.Item>

      </Tabs>

      <div className="mt-6 flex justify-end gap-3">
        <Button color="gray" onClick={() => navigate("/employee/view")}>
          Cancel
        </Button>
        <Button color="purple" onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </div>
  );
};

export default EditEmployeeDetails;
