# File Tree: attendance-system

Generated on: 8/22/2025, 8:29:15 AM
Root path: `d:\attendance-system`

```
├── 📁 .git/ 🚫 (auto-hidden)
├── 📁 BackEnd/
│   ├── 📁 node_modules/ 🚫 (auto-hidden)
│   ├── 📁 src/
│   │   ├── 📁 config/
│   │   │   ├── 📄 database.js
│   │   │   └── 📄 jwt.js
│   │   ├── 📁 controllers/
│   │   │   ├── 📄 authController.js
│   │   │   ├── 📄 clientController.js
│   │   │   ├── 📄 departmentController.js
│   │   │   ├── 📄 designationController.js
│   │   │   ├── 📄 employeeController.js
│   │   │   └── 📄 payrollController.js
│   │   ├── 📁 middleware/
│   │   │   ├── 📄 authMiddleware.js
│   │   │   ├── 📄 errorHandlerMiddleware.js
│   │   │   ├── 📄 rbacMiddleware.js
│   │   │   └── 📄 requestLoggerMiddleware.js
│   │   ├── 📁 routes/
│   │   │   ├── 📄 attendanceRoute.js
│   │   │   ├── 📄 authRoute.js
│   │   │   ├── 📄 clientsRoute.js
│   │   │   ├── 📄 dashboardRoute.js
│   │   │   ├── 📄 departmentsRoute.js
│   │   │   ├── 📄 designationsRoute.js
│   │   │   ├── 📄 employeeRoute.js
│   │   │   ├── 📄 leavesRoute.js
│   │   │   ├── 📄 payrollRoute.js
│   │   │   ├── 📄 rbacRoute.js
│   │   │   └── 📄 settingsRoute.js
│   │   ├── 📁 scripts/
│   │   │   ├── 📄 createSuperAdmin.js
│   │   │   ├── 🗄️ database_schema.sql
│   │   │   ├── 📄 seedDatabase.js
│   │   │   └── 📄 seedDefaultSettings.js
│   │   ├── 📁 services/
│   │   │   └── 📄 sessionCleanup.js
│   │   └── 📁 utils/
│   │       └── 📄 settingsHelper.js
│   ├── 📁 tests/
│   │   └── 📄 hash.js
│   ├── 📁 uploads/
│   │   └── 📁 employee-documents/
│   │       ├── 📄 experience-1755592141635-275185638.docx
│   │       ├── 🖼️ national_id-1755588547328-141788856.jpg
│   │       ├── 📄 national_id-1755591546352-605321554.docx
│   │       ├── 📄 national_id-1755666653878-658027074.docx
│   │       ├── 📄 national_id-1755742094381-781186059.docx
│   │       ├── 📄 national_id-1755748516525-226633148.docx
│   │       └── 🖼️ resume-1755588631507-298900618.jpg
│   ├── 🔒 .env 🚫 (auto-hidden)
│   ├── 🚫 .gitignore
│   ├── 📖 README.md
│   ├── 📄 package-lock.json
│   ├── 📄 package.json
│   ├── 📄 server.js
│   ├── 📄 test-db-connection.js
│   └── 📄 tsconfig.json
└── 📁 FrontEnd/
    ├── 📁 node_modules/ 🚫 (auto-hidden)
    ├── 📁 public/
    │   ├── 📄 _redirects
    │   ├── 🖼️ favicon.png
    │   ├── 🖼️ logoIcon.svg
    │   └── 🖼️ vite.svg
    ├── 📁 src/
    │   ├── 📁 assets/
    │   │   ├── 📁 images/
    │   │   │   ├── 📁 backgrounds/
    │   │   │   │   ├── 🖼️ bronze.png
    │   │   │   │   ├── 🖼️ business-woman-checking-her-mail.png
    │   │   │   │   ├── 🖼️ emailSv.png
    │   │   │   │   ├── 🖼️ empty-shopping-cart.svg
    │   │   │   │   ├── 🖼️ errorimg.svg
    │   │   │   │   ├── 🖼️ gold.png
    │   │   │   │   ├── 🖼️ img1.jpg
    │   │   │   │   ├── 🖼️ line-bg-2.svg
    │   │   │   │   ├── 🖼️ line-bg.svg
    │   │   │   │   ├── 🖼️ login-bg.jpg
    │   │   │   │   ├── 🖼️ login-bg.svg
    │   │   │   │   ├── 🖼️ login-side.png
    │   │   │   │   ├── 🖼️ maintenance.svg
    │   │   │   │   ├── 🖼️ mega-dd-bg.jpg
    │   │   │   │   ├── 🖼️ my-card.jpg
    │   │   │   │   ├── 🖼️ payment.svg
    │   │   │   │   ├── 🖼️ preview-img.png
    │   │   │   │   ├── 🖼️ profile-bg.jpg
    │   │   │   │   ├── 🖼️ profilebg.jpg
    │   │   │   │   ├── 🖼️ silver.png
    │   │   │   │   ├── 🖼️ track-bg.png
    │   │   │   │   ├── 🖼️ upgrade.png
    │   │   │   │   ├── 🖼️ upgrade.svg
    │   │   │   │   ├── 🖼️ weather.jpg
    │   │   │   │   ├── 🖼️ weatherbg.jpg
    │   │   │   │   ├── 🖼️ website-under-construction.svg
    │   │   │   │   ├── 🖼️ welcome-bg.png
    │   │   │   │   └── 🖼️ welcome-bg2.png
    │   │   │   ├── 📁 blog/
    │   │   │   │   ├── 🖼️ blog-img1.jpg
    │   │   │   │   ├── 🖼️ blog-img2.jpg
    │   │   │   │   └── 🖼️ blog-img3.jpg
    │   │   │   ├── 📁 logos/
    │   │   │   │   ├── 🖼️ logo-icon.svg
    │   │   │   │   └── 🖼️ logo.svg
    │   │   │   ├── 📁 products/
    │   │   │   │   ├── 🖼️ dash-prd-1.jpg
    │   │   │   │   ├── 🖼️ dash-prd-2.jpg
    │   │   │   │   ├── 🖼️ dash-prd-3.jpg
    │   │   │   │   └── 🖼️ dash-prd-4.jpg
    │   │   │   ├── 📁 profile/
    │   │   │   │   ├── 🖼️ user-1.jpg
    │   │   │   │   ├── 🖼️ user-10.jpg
    │   │   │   │   ├── 🖼️ user-11.jpg
    │   │   │   │   ├── 🖼️ user-12.jpg
    │   │   │   │   ├── 🖼️ user-13.jpg
    │   │   │   │   ├── 🖼️ user-14.jpg
    │   │   │   │   ├── 🖼️ user-15.jpg
    │   │   │   │   ├── 🖼️ user-2.jpg
    │   │   │   │   ├── 🖼️ user-3.jpg
    │   │   │   │   ├── 🖼️ user-4.jpg
    │   │   │   │   ├── 🖼️ user-5.jpg
    │   │   │   │   ├── 🖼️ user-6.jpg
    │   │   │   │   ├── 🖼️ user-7.jpg
    │   │   │   │   ├── 🖼️ user-8.jpg
    │   │   │   │   └── 🖼️ user-9.jpg
    │   │   │   ├── 📁 shapes/
    │   │   │   │   ├── 🖼️ circle-white-shape.png
    │   │   │   │   ├── 🖼️ circlr-shape.png
    │   │   │   │   ├── 🖼️ danger-card-shape.png
    │   │   │   │   ├── 🖼️ secondary-card-shape.png
    │   │   │   │   └── 🖼️ success-card-shape.png
    │   │   │   └── 📁 svgs/
    │   │   │       ├── 🖼️ apple-icon.svg
    │   │   │       ├── 🖼️ cart-icon.svg
    │   │   │       ├── 🖼️ facebook-icon.svg
    │   │   │       ├── 🖼️ google-icon.svg
    │   │   │       ├── 🖼️ icon-account.svg
    │   │   │       ├── 🖼️ icon-adobe.svg
    │   │   │       ├── 🖼️ icon-bars.svg
    │   │   │       ├── 🖼️ icon-briefcase.svg
    │   │   │       ├── 🖼️ icon-chrome.svg
    │   │   │       ├── 🖼️ icon-connect.svg
    │   │   │       ├── 🖼️ icon-database.svg
    │   │   │       ├── 🖼️ icon-dd-application.svg
    │   │   │       ├── 🖼️ icon-dd-cart.svg
    │   │   │       ├── 🖼️ icon-dd-chat.svg
    │   │   │       ├── 🖼️ icon-dd-date.svg
    │   │   │       ├── 🖼️ icon-dd-invoice.svg
    │   │   │       ├── 🖼️ icon-dd-lifebuoy.svg
    │   │   │       ├── 🖼️ icon-dd-message-box.svg
    │   │   │       ├── 🖼️ icon-dd-mobile.svg
    │   │   │       ├── 🖼️ icon-favorites.svg
    │   │   │       ├── 🖼️ icon-figma.svg
    │   │   │       ├── 🖼️ icon-inbox.svg
    │   │   │       ├── 🖼️ icon-javascript.svg
    │   │   │       ├── 🖼️ icon-mail.svg
    │   │   │       ├── 🖼️ icon-mailbox.svg
    │   │   │       ├── 🖼️ icon-map-pin.svg
    │   │   │       ├── 🖼️ icon-master-card-2.svg
    │   │   │       ├── 🖼️ icon-master-card.svg
    │   │   │       ├── 🖼️ icon-office-bag-2.svg
    │   │   │       ├── 🖼️ icon-office-bag.svg
    │   │   │       ├── 🖼️ icon-paypal.svg
    │   │   │       ├── 🖼️ icon-phone.svg
    │   │   │       ├── 🖼️ icon-pie.svg
    │   │   │       ├── 🖼️ icon-screen-share.svg
    │   │   │       ├── 🖼️ icon-speech-bubble.svg
    │   │   │       ├── 🖼️ icon-tasks.svg
    │   │   │       ├── 🖼️ icon-user-male.svg
    │   │   │       ├── 🖼️ icon-zip-folder.svg
    │   │   │       ├── 🖼️ mastercard.svg
    │   │   │       ├── 🖼️ no-data.webp
    │   │   │       └── 🖼️ paypal.svg
    │   │   ├── 🖼️ favicon.png
    │   │   └── 🖼️ react.svg
    │   ├── 📁 components/
    │   │   ├── 📁 Attendance/
    │   │   │   ├── 📄 AttendanceDashboard.tsx
    │   │   │   ├── 📄 AttendanceForm.tsx
    │   │   │   ├── 📄 AttendanceView.tsx
    │   │   │   ├── 📄 BulkUpdateAttendance.tsx
    │   │   │   ├── 📄 ManualAttendance.tsx
    │   │   │   └── 📄 ResolveWorkDurationModal.tsx
    │   │   ├── 📁 Departments/
    │   │   │   ├── 📄 DepartmentsPage.tsx
    │   │   │   └── 📄 EmployeesByDesignation.tsx
    │   │   ├── 📁 Employees/
    │   │   │   ├── 📄 AddEmployees.tsx
    │   │   │   ├── 📄 AllEmployees.tsx
    │   │   │   ├── 📄 EditEmployeeDetails.tsx
    │   │   │   ├── 📄 EmployeeDetails.tsx
    │   │   │   └── 📄 FileUploadBox.tsx
    │   │   ├── 📁 Leaves/
    │   │   │   ├── 📄 LeaveRequestForm.tsx
    │   │   │   ├── 📄 LeaveRequests.tsx
    │   │   │   ├── 📄 holidaysPage.tsx
    │   │   │   └── 📄 leavesPage.tsx
    │   │   ├── 📁 Payroll/
    │   │   │   ├── 📄 Payroll.tsx
    │   │   │   └── 📄 PayrollView.tsx
    │   │   ├── 📁 RBACSystem/
    │   │   │   ├── 📄 adminLogin.tsx
    │   │   │   ├── 📄 adminUserManagement.tsx
    │   │   │   ├── 📄 rbacSystem.tsx
    │   │   │   └── 📄 roleManagement.tsx
    │   │   ├── 📁 Settings/
    │   │   │   └── 📄 Settings.tsx
    │   │   ├── 📁 dashboard/
    │   │   │   ├── 📄 AttendanceOverview.tsx
    │   │   │   ├── 📄 BlogCards.tsx
    │   │   │   ├── 📄 DailyActivity.tsx
    │   │   │   ├── 📄 DashboardView.tsx
    │   │   │   ├── 📄 NewCustomers.tsx
    │   │   │   ├── 📄 OnLeaveToday.tsx
    │   │   │   ├── 📄 ProductRevenue.tsx
    │   │   │   ├── 📄 TodayAttendance.tsx
    │   │   │   └── 📄 TotalEmployees.tsx
    │   │   └── 📁 shared/
    │   │       ├── 📄 CardBox.tsx
    │   │       ├── 📄 LoadingOverlay.tsx
    │   │       ├── 📄 OutlineCard.tsx
    │   │       ├── 📄 ScrollToTop.tsx
    │   │       ├── 📄 TitleBorderCard.tsx
    │   │       └── 📄 TitleIconCard.tsx
    │   ├── 📁 context/
    │   │   └── 📄 LoadingContext.tsx
    │   ├── 📁 css/
    │   │   ├── 📁 layouts/
    │   │   │   ├── 🎨 container.css
    │   │   │   ├── 🎨 header.css
    │   │   │   └── 🎨 sidebar.css
    │   │   ├── 📁 override/
    │   │   │   └── 🎨 reboot.css
    │   │   ├── 📁 theme/
    │   │   │   └── 🎨 default-colors.css
    │   │   └── 🎨 globals.css
    │   ├── 📁 hooks/
    │   │   ├── 📄 useLeaves.ts
    │   │   ├── 📄 useLoadingOverlay.ts
    │   │   ├── 📄 useSettings.ts
    │   │   └── 📄 useWorkingHours.ts
    │   ├── 📁 layouts/
    │   │   ├── 📁 blank/
    │   │   │   └── 📄 BlankLayout.tsx
    │   │   └── 📁 full/
    │   │       ├── 📁 header/
    │   │       │   ├── 📄 Header.tsx
    │   │       │   ├── 📄 Profile.tsx
    │   │       │   └── 📄 notification.tsx
    │   │       ├── 📁 shared/
    │   │       │   ├── 📁 breadcrumb/
    │   │       │   │   ├── 📄 BreadcrumbComp.tsx
    │   │       │   │   └── 📄 FrontBreadcrumb.tsx
    │   │       │   ├── 📁 loadable/
    │   │       │   │   └── 📄 Loadable.tsx
    │   │       │   └── 📁 logo/
    │   │       │       ├── 📄 FullLogo.tsx
    │   │       │       └── 📄 Logo.tsx
    │   │       ├── 📁 sidebar/
    │   │       │   ├── 📁 NavItems/
    │   │       │   │   └── 📄 index.tsx
    │   │       │   ├── 📄 MobileSidebar.tsx
    │   │       │   ├── 📄 Sidebar.tsx
    │   │       │   └── 📄 Sidebaritems.ts
    │   │       └── 📄 FullLayout.tsx
    │   ├── 📁 routes/
    │   │   └── 📄 Router.tsx
    │   ├── 📁 services/
    │   │   ├── 📄 api.ts
    │   │   ├── 📄 leaveApi.ts
    │   │   └── 📄 settingsApi.ts
    │   ├── 📁 types/
    │   │   ├── 📁 auth/
    │   │   │   └── 📄 auth.ts
    │   │   ├── 📁 layout/
    │   │   │   └── 📄 sidebar.ts
    │   │   ├── 📄 attendance.ts
    │   │   └── 📄 employee.ts
    │   ├── 📁 utils/
    │   │   └── 📁 theme/
    │   │       └── 📄 custom-theme.tsx
    │   ├── 📁 views/
    │   │   ├── 📁 auth/
    │   │   │   ├── 📁 authforms/
    │   │   │   │   ├── 📄 AuthLogin.tsx
    │   │   │   │   └── 📄 AuthRegister.tsx
    │   │   │   ├── 📁 error/
    │   │   │   │   └── 📄 Error.tsx
    │   │   │   ├── 📁 login/
    │   │   │   │   └── 📄 Login.tsx
    │   │   │   └── 📁 register/
    │   │   │       ├── 📄 Register.tsx
    │   │   │       └── 📄 page.tsx
    │   │   ├── 📁 icons/
    │   │   │   └── 📄 Solar.tsx
    │   │   ├── 📁 spinner/
    │   │   │   ├── 📄 Spinner.tsx
    │   │   │   └── 🎨 spinner.css
    │   │   ├── 📄 AttendancePage.tsx
    │   │   └── 📄 UnauthorizedPage.tsx
    │   ├── 📄 App.tsx
    │   ├── 📄 main.tsx
    │   └── 📄 vite-env.d.ts
    ├── 🔒 .env 🚫 (auto-hidden)
    ├── 📄 .eslintrc.cjs
    ├── 🚫 .gitignore
    ├── 📄 .npmrc
    ├── 📄 .prettierrc
    ├── 📖 README.md
    ├── 🌐 index.html
    ├── 📄 package-lock.json
    ├── 📄 package.json
    ├── 📄 postcss.config.js
    ├── 📄 tailwind.config.ts
    ├── 📄 tsconfig.json
    ├── 📄 tsconfig.node.json
    └── 📄 vite.config.ts
```

---
*Generated by FileTree Pro Extension*