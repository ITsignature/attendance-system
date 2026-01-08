
import { Sidebar } from "flowbite-react";
import SidebarContent from "./Sidebaritems";
import NavItems from "./NavItems";
import SimpleBar from "simplebar-react";
import React from "react";
import FullLogo from "../shared/logo/FullLogo";
import { useDynamicRBAC } from '../../../components/RBACSystem/rbacSystem';
import 'simplebar-react/dist/simplebar.min.css';


const MobileSidebar = () => {
  const { currentUser, hasPermission } = useDynamicRBAC();

  // Don't show sidebar if not logged in
  if (!currentUser) return null;

  // Helper function to check if user has any of the specified permissions
  const hasAnyPermission = (permissions: string[]) => {
    return permissions.some(permission => hasPermission(permission));
  };

  return (
    <>
      <div>
        <Sidebar
          className="fixed menu-sidebar pt-0 bg-white dark:bg-darkgray transition-all"
          aria-label="Sidebar with multi-level dropdown example"
        >
          <div className="px-5 py-4 pb-7 flex items-center sidebarlogo">
            <FullLogo />
          </div>
          <SimpleBar className="h-[calc(100vh_-_242px)]">
            <Sidebar.Items className="px-5 mt-2">
              <Sidebar.ItemGroup className="sidebar-nav hide-menu">
                {SidebarContent &&
                  SidebarContent?.map((item, index) => {
                    // Filter children based on permissions
                    const filteredChildren = item.children?.filter((child: any) => {
                      // Check if super admin is required
                      if (child.requireSuperAdmin) {
                        // Support both boolean (true/false) and number (1/0) formats
                        return !!(currentUser?.isSuperAdmin || (currentUser as any)?.is_super_admin);
                      }
                      // Check anyPermission first
                      if (child.anyPermission && Array.isArray(child.anyPermission)) {
                        return hasAnyPermission(child.anyPermission);
                      }
                      // If child has permission requirement, check it
                      if (child.permission) {
                        return hasPermission(child.permission);
                      }
                      // If no permission required, show it
                      return true;
                    });

                    // Don't show section if no children are visible
                    if (!filteredChildren || filteredChildren.length === 0) {
                      return null;
                    }

                    return (
                      <div className="caption" key={item.heading}>
                        <React.Fragment key={index}>
                          <h5 className="text-link dark:text-white/70 caption font-semibold leading-6 tracking-widest text-xs pb-2 uppercase">
                            {item.heading}
                          </h5>
                          {filteredChildren.map((child: any, childIndex: number) => (
                            <React.Fragment key={child.id && childIndex}>
                              <NavItems item={child} />
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      </div>
                    );
                  })}
              </Sidebar.ItemGroup>
            </Sidebar.Items>
          </SimpleBar>

        </Sidebar>
      </div>
    </>
  );
};

export default MobileSidebar;
