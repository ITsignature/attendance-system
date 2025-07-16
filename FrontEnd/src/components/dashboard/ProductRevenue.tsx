import { Badge } from "flowbite-react";
import { Table } from "flowbite-react";
import SimpleBar from "simplebar-react";

// Employee avatar images (you can replace these with actual employee photos)
import employee1 from "/src/assets/images/products/dash-prd-1.jpg";
import employee2 from "/src/assets/images/products/dash-prd-2.jpg";
import employee3 from "/src/assets/images/products/dash-prd-3.jpg";
import employee4 from "/src/assets/images/products/dash-prd-4.jpg";

const EmployeeAttendanceTable = () => {
  const EmployeeTableData = [
    {
      img: employee1,
      name: "Leasie Watson",
      designation: "Team Lead - Design",
      type: "Office",
      checkinTime: "09:27 AM",
      status: "On Time",
      statuscolor: "text-green-600",
      statusbg: "bg-green-100",
      checkoutTime: "09:27 AM",
    },
    {
      img: employee2,
      name: "Jacob Jones",
      designation: "Medical Assistant",
      type: "Remote",
      checkinTime: "10:24 AM",
      status: "Late",
      statuscolor: "text-red-600",
      statusbg: "bg-red-100",
      checkoutTime: "10:24 AM",
    },
    {
      img: employee3,
      name: "Darlene Robertson",
      designation: "Web Designer",
      type: "Office",
      checkinTime: "10:15 AM",
      status: "Late",
      statuscolor: "text-red-600",
      statusbg: "bg-red-100",
      checkoutTime: "10:15 AM",
    },
    {
      img: employee4,
      name: "Kathryn Murphy",
      designation: "Marketing Coordinator",
      type: "Office",
      checkinTime: "09:10 AM",
      status: "On Time",
      statuscolor: "text-green-600",
      statusbg: "bg-green-100",
      checkoutTime: "09:10 AM",
    },
    {
      img: employee1,
      name: "Leslie Alexander",
      designation: "Data Analyst",
      type: "Office",
      checkinTime: "09:15 AM",
      status: "On Time",
      statuscolor: "text-green-600",
      statusbg: "bg-green-100",
      checkoutTime: "09:15 AM",
    },
    {
      img: employee2,
      name: "Ronald Richards",
      designation: "Python Developer",
      type: "Remote",
      checkinTime: "09:29 AM",
      status: "On Time",
      statuscolor: "text-green-600",
      statusbg: "bg-green-100",
      checkoutTime: "09:29 AM",
    },
    {
      img: employee3,
      name: "Jenny Wilson",
      designation: "React JS Developer",
      type: "Remote",
      checkinTime: "11:30 AM",
      status: "Late",
      statuscolor: "text-red-600",
      statusbg: "bg-red-100",
      checkoutTime: "11:30 AM",
    },
  ];

  return (
    <>
      <div className="rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray pt-6 px-0 relative w-full break-words">
        <div className="px-6">
          <h5 className="card-title mb-6">Employee Attendance</h5>
        </div>
        <SimpleBar className="max-h-[450px]">
          <div className="overflow-x-auto">
            <Table hoverable>
              <Table.Head>
                <Table.HeadCell className="p-6 text-gray-500 font-medium">Employee Name</Table.HeadCell>
                <Table.HeadCell className="text-gray-500 font-medium">Designation</Table.HeadCell>
                <Table.HeadCell className="text-gray-500 font-medium">Type</Table.HeadCell>
                <Table.HeadCell className="text-gray-500 font-medium">Check In Time</Table.HeadCell>
                <Table.HeadCell className="text-gray-500 font-medium">Status</Table.HeadCell>
                <Table.HeadCell className="text-gray-500 font-medium">Check out Time</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y divide-border dark:divide-darkborder">
                {EmployeeTableData.map((item, index) => (
                  <Table.Row key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <Table.Cell className="whitespace-nowrap ps-6">
                      <div className="flex gap-3 items-center">
                        <img
                          src={item.img}
                          alt="employee"
                          className="h-[40px] w-[40px] rounded-full object-cover"
                        />
                        <div className="truncate line-clamp-2 sm:text-wrap max-w-56">
                          <h6 className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</h6>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="me-5">
                        <p className="text-sm text-gray-600 dark:text-gray-400">{item.designation}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="me-5">
                        <p className="text-sm text-gray-900 dark:text-white">{item.type}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="me-5">
                        <p className="text-sm text-gray-900 dark:text-white font-medium">{item.checkinTime}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge className={`${item.statusbg} ${item.statuscolor} border-0`}>
                        {item.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="me-5">
                        <p className="text-sm text-gray-900 dark:text-white font-medium">{item.checkoutTime}</p>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </SimpleBar>
      </div>
    </>
  );
};

export default EmployeeAttendanceTable;