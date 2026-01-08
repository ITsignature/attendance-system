import { Sidebar } from 'flowbite-react';
import React from 'react';
import SimpleBar from 'simplebar-react';
import FullLogo from '../shared/logo/FullLogo';
import NavItems from './NavItems';
import SidebarContent from './Sidebaritems';
import { useDynamicRBAC } from '../../../components/RBACSystem/rbacSystem';

const SidebarLayout = () => {
  const { currentUser, hasPermission } = useDynamicRBAC();

  // Don't show sidebar if not logged in
  if (!currentUser) return null;

  // Helper function to check if user has any of the specified permissions
  const hasAnyPermission = (permissions: string[]) => {
    return permissions.some(permission => hasPermission(permission));
  };

  return (
    <>
      <div className="xl:block hidden">
        <Sidebar
          className="fixed menu-sidebar  bg-white dark:bg-darkgray rtl:pe-4 rtl:ps-0 "
          aria-label="Sidebar with multi-level dropdown example"
        >
          <div className="px-6 py-4 flex items-center sidebarlogo">
            <FullLogo />
          </div>
          <SimpleBar className="h-[calc(100vh_-_230px)]">
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
                      <div className="caption mb-4" key={item.heading}>
                        <React.Fragment key={index}>
                          <h5 className="text-link dark:text-white/70 caption font-semibold leading-6 tracking-widest text-xs pb-2 uppercase">
                            {item.heading}
                          </h5>
                          {filteredChildren.map((child: any, childIndex: number) => (
                            <React.Fragment key={child.id && childIndex}>
                              <NavItems item={child} hasPermission={hasPermission} />
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

export default SidebarLayout;