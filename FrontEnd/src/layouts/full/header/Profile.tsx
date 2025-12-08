
import { Button, Dropdown } from "flowbite-react";
import { Icon } from "@iconify/react";
import { Link } from "react-router";
import { useDynamicRBAC } from '../../../components/RBACSystem/rbacSystem';

const Profile = () => {
  const { logout, currentUser } = useDynamicRBAC();

  return (
    <div className="relative group/menu">
      <Dropdown
        label=""
        className="rounded-sm w-44"
        dismissOnClick={false}
        renderTrigger={() => (
          <div className="flex items-center gap-2 px-3 py-2 hover:bg-lightprimary rounded-lg cursor-pointer group-hover/menu:bg-lightprimary">
            <Icon icon="solar:user-circle-bold" height={24} className="text-primary" />
            <span className="text-sm font-medium text-dark dark:text-white">
              {currentUser?.name || 'User'}
            </span>
          </div>
        )}
      >
        <div className="p-3">
          <Button
            as={Link}
            size={'sm'}
            onClick={logout}
            to="/admin/login"
            className="w-full border border-primary text-primary bg-transparent hover:bg-lightprimary outline-none focus:outline-none"
          >
            <Icon icon="solar:logout-2-outline" height={18} className="mr-2" />
            Logout
          </Button>
        </div>
      </Dropdown>
    </div>
  );
};

export default Profile;
