import React from 'react';
import { Sidebar } from 'flowbite-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavItemsProps {
  item: {
    id: string;
    title: string;
    icon: React.ElementType;
    href: string;
  };
}

const NavItems: React.FC<NavItemsProps> = ({ item }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = location.pathname === item.href;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(item.href);
  };

  return (
    <Sidebar.Item
      as="div"
      icon={item.icon}
      active={isActive}
      className="cursor-pointer"
      onClick={handleClick}
    >
      {item.title}
    </Sidebar.Item>
  );
};

export default NavItems;