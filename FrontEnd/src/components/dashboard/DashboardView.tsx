import { Link } from 'react-router';
//import BlogCards from 'src/components/dashboard/BlogCards';
//import NewCustomers from 'src/components/dashboard/NewCustomers';
import ProductRevenue from 'src/components/dashboard/ProductRevenue';
import {AttendanceOverview} from 'src/components/dashboard/AttendanceOverview';
import TotalEmployees from 'src/components/dashboard/TotalEmployees';
import TodayAttendance from 'src/components/dashboard/TodayAttendance';
import OnLeaveToday from 'src/components/dashboard/OnLeaveToday';

const Dashboard = () => {

  const user = localStorage.getItem('user');
  console.log(user);
  return (
    <div className="grid grid-cols-12 gap-30">
          <div className="col-span-4">
            <TotalEmployees />
          </div>
          <div className="col-span-4">
            <TodayAttendance />
          </div>
          <div className="col-span-4">
            <OnLeaveToday />
          </div>
        {/* </div> */}
      {/* </div> */}
      <div className="col-span-12">
        <AttendanceOverview />
      </div>
      <div className="col-span-12">
        <ProductRevenue />
      </div>
      {/* <div className="col-span-12">
        <BlogCards />
      </div> */}
      <div className="flex justify-center align-middle gap-2 flex-wrap col-span-12 text-center">
        <p className="text-base">
          Design and Developed by{' '}
          <Link
            to="https://adminmart.com/"
            target="_blank"
            className="pl-1 text-primary underline decoration-primary"
          >
            adminmart.com
          </Link>
        </p>
        <p className="text-base">
          Distributed by
          <Link
            to="https://themewagon.com/"
            target="_blank"
            className="pl-1 text-primary underline decoration-primary"
          >
            ThemeWagon
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
