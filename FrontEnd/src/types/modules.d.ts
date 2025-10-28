declare module 'lucide-react' {
  import { ComponentType, SVGProps } from 'react';

  export interface LucideProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
    size?: string | number;
    absoluteStrokeWidth?: boolean;
  }

  export type LucideIcon = ComponentType<LucideProps>;

  export const Calendar: LucideIcon;
  export const Clock: LucideIcon;
  export const User: LucideIcon;
  export const Users: LucideIcon;
  export const Settings: LucideIcon;
  export const FileText: LucideIcon;
  export const BarChart: LucideIcon;
  export const DollarSign: LucideIcon;
  export const CheckCircle: LucideIcon;
  export const XCircle: LucideIcon;
  export const AlertTriangle: LucideIcon;
  export const Plus: LucideIcon;
  export const Minus: LucideIcon;
  export const Edit: LucideIcon;
  export const Trash: LucideIcon;
  export const Save: LucideIcon;
  export const Download: LucideIcon;
  export const Upload: LucideIcon;
  export const Search: LucideIcon;
  export const Filter: LucideIcon;
  export const Eye: LucideIcon;
  export const EyeOff: LucideIcon;
  export const Mail: LucideIcon;
  export const Phone: LucideIcon;
  export const MapPin: LucideIcon;
  export const Building: LucideIcon;
  export const Briefcase: LucideIcon;
  export const Home: LucideIcon;
  export const LogOut: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const ChevronUp: LucideIcon;
  export const ChevronLeft: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const MoreHorizontal: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const X: LucideIcon;
  export const Check: LucideIcon;
  export const Info: LucideIcon;
  export const Calculator: LucideIcon;
  export const Trash2: LucideIcon;
  export const AlertCircle: LucideIcon;
  export const Shield: LucideIcon;
  export const Bell: LucideIcon;
  export const Database: LucideIcon;
  export const Globe: LucideIcon;
  export const Trash: LucideIcon;
}

declare module '@tabler/icons-react' {
  import { ComponentType, SVGProps } from 'react';

  export interface TablerIconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
    size?: string | number;
    stroke?: number;
  }

  export type TablerIcon = ComponentType<TablerIconProps>;

  export const IconCalendar: TablerIcon;
  export const IconClock: TablerIcon;
  export const IconUser: TablerIcon;
  export const IconUsers: TablerIcon;
  export const IconSettings: TablerIcon;
  export const IconFileText: TablerIcon;
  export const IconChartBar: TablerIcon;
  export const IconCurrencyDollar: TablerIcon;
  export const IconCircleCheck: TablerIcon;
  export const IconCircleX: TablerIcon;
  export const IconAlertTriangle: TablerIcon;
  export const IconPlus: TablerIcon;
  export const IconMinus: TablerIcon;
  export const IconEdit: TablerIcon;
  export const IconTrash: TablerIcon;
  export const IconDeviceFloppy: TablerIcon;
  export const IconDownload: TablerIcon;
  export const IconUpload: TablerIcon;
  export const IconSearch: TablerIcon;
  export const IconFilter: TablerIcon;
  export const IconEye: TablerIcon;
  export const IconEyeOff: TablerIcon;
  export const IconMail: TablerIcon;
  export const IconPhone: TablerIcon;
  export const IconMapPin: TablerIcon;
  export const IconBuilding: TablerIcon;
  export const IconBriefcase: TablerIcon;
  export const IconHome: TablerIcon;
  export const IconLogout: TablerIcon;
  export const IconChevronDown: TablerIcon;
  export const IconChevronUp: TablerIcon;
  export const IconChevronLeft: TablerIcon;
  export const IconChevronRight: TablerIcon;
  export const IconDots: TablerIcon;
  export const IconRefresh: TablerIcon;
  export const IconX: TablerIcon;
  export const IconCheck: TablerIcon;
  export const IconInfoCircle: TablerIcon;
  export const IconDashboard: TablerIcon;
  export const IconUserCheck: TablerIcon;
  export const IconCalendarEvent: TablerIcon;
  export const IconReportMoney: TablerIcon;
  export const IconUsersGroup: TablerIcon;
  export const IconMenu2: TablerIcon;
  export const IconBell: TablerIcon;
  export const IconPower: TablerIcon;
  export const IconLayoutDashboard: TablerIcon;
  export const IconUserPlus: TablerIcon;
}