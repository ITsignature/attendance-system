-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Oct 29, 2025 at 01:41 PM
-- Server version: 10.11.10-MariaDB-log
-- PHP Version: 7.3.32

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `u770612336_attendance_sys`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin_users`
--

CREATE TABLE `admin_users` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `client_id` varchar(36) DEFAULT NULL,
  `employee_id` varchar(36) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role_id` varchar(36) NOT NULL,
  `department` varchar(100) DEFAULT NULL,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `password_changed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `failed_login_attempts` int(11) DEFAULT 0,
  `account_locked_until` timestamp NULL DEFAULT NULL,
  `two_factor_enabled` tinyint(1) DEFAULT 0,
  `two_factor_secret` varchar(100) DEFAULT NULL,
  `is_super_admin` tinyint(1) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `attendance`
--

CREATE TABLE `attendance` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `employee_id` varchar(36) NOT NULL,
  `date` date NOT NULL,
  `check_in_time` time DEFAULT NULL,
  `check_out_time` time DEFAULT NULL,
  `total_hours` decimal(4,2) DEFAULT NULL,
  `overtime_hours` decimal(4,2) DEFAULT 0.00,
  `break_duration` decimal(4,2) DEFAULT 0.00,
  `status` enum('present','absent','late','half_day','on_leave') DEFAULT 'present',
  `work_type` enum('office','remote','hybrid') DEFAULT 'office',
  `notes` text DEFAULT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `updated_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `scheduled_in_time` time DEFAULT NULL,
  `scheduled_out_time` time DEFAULT NULL,
  `arrival_status` enum('on_time','late','absent','voluntary_work','scheduled_off') DEFAULT 'on_time',
  `work_duration` enum('full_day','half_day','short_leave','absent','voluntary_full_day','voluntary_half_day','voluntary_short_work','scheduled_off','insufficient_hours') DEFAULT 'full_day',
  `leave_request_id` varchar(36) DEFAULT NULL,
  `is_weekend` tinyint(1) UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Day of week: 1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday, 7=Saturday',
  `payable_duration` decimal(5,2) DEFAULT NULL COMMENT 'Pre-calculated payable hours based on overlap of scheduled and actual hours'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `attendance_master`
--

CREATE TABLE `attendance_master` (
  `id` int(11) NOT NULL,
  `userID` int(11) NOT NULL,
  `entered_by` varchar(30) NOT NULL,
  `att_date` date NOT NULL,
  `in_time` time NOT NULL,
  `out_time` time NOT NULL,
  `working_hours` time NOT NULL,
  `working_type` varchar(50) NOT NULL,
  `reason` varchar(500) NOT NULL,
  `code` varchar(50) NOT NULL,
  `late_reason` varchar(300) NOT NULL,
  `late_pay` int(11) NOT NULL,
  `ot_pay` int(11) NOT NULL,
  `note` varchar(250) NOT NULL,
  `active` int(6) NOT NULL,
  `manual_attendance_in_time_marked` varchar(225) NOT NULL,
  `manual_attendance_out_time_marked` varchar(225) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `client_id` varchar(36) DEFAULT NULL,
  `admin_user_id` varchar(36) DEFAULT NULL,
  `entity_type` varchar(50) NOT NULL,
  `entity_id` varchar(36) DEFAULT NULL,
  `action` enum('create','read','update','delete') NOT NULL,
  `old_values` longtext DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext DEFAULT NULL CHECK (json_valid(`new_values`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `clients`
--

CREATE TABLE `clients` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `contact_email` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `subscription_plan` enum('basic','premium','enterprise') DEFAULT 'basic',
  `subscription_expires_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `departments`
--

CREATE TABLE `departments` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `client_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `manager_id` varchar(36) DEFAULT NULL,
  `budget` decimal(15,2) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `designations`
--

CREATE TABLE `designations` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `client_id` varchar(36) NOT NULL,
  `title` varchar(100) NOT NULL,
  `department_id` varchar(36) DEFAULT NULL,
  `min_salary` decimal(15,2) DEFAULT NULL,
  `max_salary` decimal(15,2) DEFAULT NULL,
  `responsibilities` text DEFAULT NULL,
  `requirements` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `employees`
--

CREATE TABLE `employees` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `client_id` varchar(36) NOT NULL,
  `employee_code` varchar(50) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `gender` enum('male','female','other') DEFAULT NULL,
  `address` text DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `zip_code` varchar(20) DEFAULT NULL,
  `nationality` varchar(100) DEFAULT NULL,
  `marital_status` enum('single','married','divorced','widowed') DEFAULT NULL,
  `hire_date` date DEFAULT NULL,
  `department_id` varchar(36) DEFAULT NULL,
  `designation_id` varchar(36) DEFAULT NULL,
  `manager_id` varchar(36) DEFAULT NULL,
  `employee_type` enum('permanent','contract','intern','consultant') DEFAULT 'permanent',
  `work_location` enum('office','remote','hybrid') DEFAULT 'office',
  `employment_status` enum('active','inactive','terminated','resigned') DEFAULT 'active',
  `base_salary` decimal(15,2) DEFAULT NULL,
  `bank_account_number` varchar(50) DEFAULT NULL,
  `bank_name` varchar(100) DEFAULT NULL,
  `bank_branch` varchar(100) DEFAULT NULL,
  `bank_routing_number` varchar(50) DEFAULT NULL,
  `payment_method` enum('bank_transfer','cash','cheque') DEFAULT 'bank_transfer',
  `currency` varchar(3) DEFAULT 'USD',
  `profile_image` varchar(500) DEFAULT NULL,
  `emergency_contact_name` varchar(100) DEFAULT NULL,
  `emergency_contact_phone` varchar(20) DEFAULT NULL,
  `emergency_contact_relation` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `in_time` time DEFAULT NULL COMMENT 'Employee specific work start time',
  `out_time` time DEFAULT NULL COMMENT 'Employee specific work end time',
  `follows_company_schedule` tinyint(1) DEFAULT 1 COMMENT 'Whether employee follows company default schedule',
  `weekend_working_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'JSON object containing weekend working configuration for Saturday and Sunday' CHECK (json_valid(`weekend_working_config`)),
  `attendance_affects_salary` tinyint(1) DEFAULT 1 COMMENT 'If TRUE (default), salary is calculated based on attendance. If FALSE, full salary is paid regardless of attendance.'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Triggers `employees`
--
DELIMITER $$
CREATE TRIGGER `tr_employees_audit_update` AFTER UPDATE ON `employees` FOR EACH ROW BEGIN
    INSERT INTO audit_logs (client_id, entity_type, entity_id, action, old_values, new_values)
    VALUES (
        NEW.client_id,
        'employee',
        NEW.id,
        'update',
        JSON_OBJECT(
            'first_name', OLD.first_name,
            'last_name', OLD.last_name,
            'email', OLD.email,
            'department_id', OLD.department_id,
            'designation_id', OLD.designation_id,
            'base_salary', OLD.base_salary,
            'employment_status', OLD.employment_status
        ),
        JSON_OBJECT(
            'first_name', NEW.first_name,
            'last_name', NEW.last_name,
            'email', NEW.email,
            'department_id', NEW.department_id,
            'designation_id', NEW.designation_id,
            'base_salary', NEW.base_salary,
            'employment_status', NEW.employment_status
        )
    );
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `employee_advances`
--

CREATE TABLE `employee_advances` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `employee_id` varchar(36) NOT NULL,
  `advance_type` enum('salary','emergency','travel','medical','educational') DEFAULT 'salary',
  `advance_amount` decimal(15,2) NOT NULL,
  `description` varchar(255) NOT NULL,
  `request_date` date NOT NULL DEFAULT curdate(),
  `required_date` date DEFAULT NULL COMMENT 'When employee needs the money',
  `deduction_start_date` date DEFAULT NULL COMMENT 'When to start salary deductions',
  `deduction_months` int(11) DEFAULT 1 COMMENT 'Over how many months to deduct',
  `monthly_deduction` decimal(15,2) DEFAULT NULL,
  `total_deducted` decimal(15,2) DEFAULT 0.00,
  `remaining_amount` decimal(15,2) DEFAULT NULL,
  `status` enum('pending','approved','paid','completed','cancelled','rejected') DEFAULT 'pending',
  `approved_by` varchar(36) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `paid_by` varchar(36) DEFAULT NULL,
  `paid_at` timestamp NULL DEFAULT NULL,
  `payment_method` enum('bank_transfer','cash','cheque') DEFAULT 'bank_transfer',
  `payment_reference` varchar(100) DEFAULT NULL,
  `justification` text DEFAULT NULL COMMENT 'Reason for advance request',
  `attachments` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Supporting documents' CHECK (json_valid(`attachments`)),
  `notes` text DEFAULT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `employee_allowances`
--

CREATE TABLE `employee_allowances` (
  `id` varchar(36) NOT NULL,
  `client_id` varchar(36) NOT NULL,
  `employee_id` varchar(36) NOT NULL,
  `allowance_type` varchar(50) NOT NULL,
  `allowance_name` varchar(100) NOT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `is_percentage` tinyint(1) DEFAULT 0,
  `is_taxable` tinyint(1) DEFAULT 1,
  `is_active` tinyint(1) DEFAULT 1,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `employee_bonuses`
--

CREATE TABLE `employee_bonuses` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `employee_id` varchar(36) NOT NULL,
  `bonus_type` enum('performance','annual','quarterly','project','spot','retention','referral') DEFAULT 'performance',
  `bonus_amount` decimal(15,2) NOT NULL,
  `description` varchar(255) NOT NULL,
  `bonus_period` varchar(50) DEFAULT NULL COMMENT 'E.g., Q1 2024, Annual 2024',
  `calculation_basis` text DEFAULT NULL COMMENT 'How bonus was calculated',
  `effective_date` date NOT NULL DEFAULT curdate(),
  `payment_date` date DEFAULT NULL,
  `status` enum('pending','approved','paid','cancelled','rejected') DEFAULT 'pending',
  `approved_by` varchar(36) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `processed_by` varchar(36) DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `payment_method` enum('salary_addition','separate_payment','next_payroll') DEFAULT 'next_payroll',
  `payment_reference` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `employee_deductions`
--

CREATE TABLE `employee_deductions` (
  `id` varchar(36) NOT NULL,
  `client_id` varchar(36) NOT NULL,
  `employee_id` varchar(36) NOT NULL,
  `deduction_type` varchar(50) NOT NULL,
  `deduction_name` varchar(100) NOT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `is_percentage` tinyint(1) DEFAULT 0,
  `is_recurring` tinyint(1) DEFAULT 1,
  `remaining_installments` int(11) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `created_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `employee_documents`
--

CREATE TABLE `employee_documents` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `employee_id` varchar(36) NOT NULL,
  `client_id` varchar(36) NOT NULL,
  `document_type` enum('national_id','passport','other','resume','education','experience') NOT NULL,
  `original_filename` varchar(255) NOT NULL,
  `stored_filename` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size` int(11) NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `uploaded_by` varchar(36) NOT NULL,
  `uploaded_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_active` tinyint(1) DEFAULT 1,
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `employee_loans`
--

CREATE TABLE `employee_loans` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `employee_id` varchar(36) NOT NULL,
  `loan_type` enum('personal','advance','emergency','housing','education') DEFAULT 'personal',
  `loan_amount` decimal(15,2) NOT NULL,
  `interest_rate` decimal(5,2) DEFAULT 0.00,
  `tenure_months` int(11) NOT NULL,
  `monthly_deduction` decimal(15,2) NOT NULL,
  `total_paid` decimal(15,2) DEFAULT 0.00,
  `remaining_amount` decimal(15,2) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `status` enum('active','completed','defaulted','cancelled') DEFAULT 'active',
  `approved_by` varchar(36) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `employee_monthly_allowances`
-- (See below for the actual view)
--
CREATE TABLE `employee_monthly_allowances` (
`client_id` varchar(36)
,`employee_id` varchar(36)
,`employee_code` varchar(50)
,`employee_name` varchar(201)
,`total_allowances` decimal(56,8)
,`allowance_count` bigint(21)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `employee_monthly_deductions`
-- (See below for the actual view)
--
CREATE TABLE `employee_monthly_deductions` (
`client_id` varchar(36)
,`employee_id` varchar(36)
,`employee_code` varchar(50)
,`employee_name` varchar(201)
,`total_deductions` decimal(56,8)
,`deduction_count` bigint(21)
);

-- --------------------------------------------------------

--
-- Table structure for table `employee_payroll_components`
--

CREATE TABLE `employee_payroll_components` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `employee_id` varchar(36) NOT NULL,
  `component_id` varchar(36) NOT NULL,
  `custom_value` decimal(15,2) DEFAULT NULL COMMENT 'Override component default value',
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `holidays`
--

CREATE TABLE `holidays` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `client_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `date` date NOT NULL,
  `description` text DEFAULT NULL,
  `is_optional` tinyint(1) DEFAULT 0,
  `applies_to_all` tinyint(1) DEFAULT 1,
  `department_ids` longtext DEFAULT NULL CHECK (json_valid(`department_ids`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `leave_requests`
--

CREATE TABLE `leave_requests` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `employee_id` varchar(36) NOT NULL,
  `leave_type_id` varchar(36) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `days_requested` decimal(4,2) NOT NULL,
  `is_paid` tinyint(1) DEFAULT 1 COMMENT 'Whether this specific leave request is paid',
  `leave_duration` enum('full_day','half_day','short_leave') DEFAULT 'full_day',
  `reason` text NOT NULL,
  `status` enum('pending','approved','rejected','cancelled') DEFAULT 'pending',
  `applied_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `reviewed_by` varchar(36) DEFAULT NULL,
  `reviewer_comments` text DEFAULT NULL,
  `supporting_documents` longtext DEFAULT NULL CHECK (json_valid(`supporting_documents`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `balance_deducted` tinyint(1) DEFAULT 0,
  `balance_transaction_id` varchar(36) DEFAULT NULL,
  `balance_validation_status` enum('pending','validated','insufficient') DEFAULT 'pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `leave_types`
--

CREATE TABLE `leave_types` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `client_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `max_days_per_year` int(11) DEFAULT 0,
  `max_consecutive_days` int(11) DEFAULT 0,
  `is_paid` tinyint(1) DEFAULT 1,
  `requires_approval` tinyint(1) DEFAULT 1,
  `approval_hierarchy` longtext DEFAULT NULL CHECK (json_valid(`approval_hierarchy`)),
  `notice_period_days` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payroll_adjustments`
--

CREATE TABLE `payroll_adjustments` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `payroll_record_id` varchar(36) DEFAULT NULL,
  `employee_id` varchar(36) NOT NULL,
  `adjustment_type` enum('addition','deduction') NOT NULL,
  `adjustment_reason` varchar(255) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `applicable_month` date NOT NULL,
  `is_processed` tinyint(1) DEFAULT 0,
  `processed_at` timestamp NULL DEFAULT NULL,
  `approved_by` varchar(36) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payroll_audit_log`
--

CREATE TABLE `payroll_audit_log` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `run_id` varchar(36) NOT NULL,
  `action` varchar(50) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `new_value` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payroll_components`
--

CREATE TABLE `payroll_components` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `client_id` varchar(36) NOT NULL,
  `component_name` varchar(100) NOT NULL,
  `component_type` enum('earning','deduction') NOT NULL,
  `category` enum('basic','allowance','bonus','tax','insurance','loan','other','financial','attendance','statutory') NOT NULL,
  `calculation_type` enum('fixed','percentage','formula') DEFAULT 'fixed',
  `calculation_value` decimal(15,2) DEFAULT NULL,
  `calculation_formula` text DEFAULT NULL,
  `is_taxable` tinyint(1) DEFAULT 1,
  `is_mandatory` tinyint(1) DEFAULT 0,
  `applies_to` enum('all','department','designation','individual') DEFAULT 'all',
  `applies_to_ids` longtext DEFAULT NULL CHECK (json_valid(`applies_to_ids`)),
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payroll_periods`
--

CREATE TABLE `payroll_periods` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `client_id` varchar(36) NOT NULL,
  `period_number` int(11) NOT NULL,
  `period_year` year(4) NOT NULL,
  `period_type` enum('weekly','bi-weekly','monthly','quarterly') DEFAULT 'monthly',
  `period_start_date` date NOT NULL,
  `period_end_date` date NOT NULL,
  `cut_off_date` date NOT NULL,
  `pay_date` date NOT NULL,
  `status` enum('active','closed','archived') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payroll_records`
--

CREATE TABLE `payroll_records` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `run_id` varchar(36) NOT NULL,
  `employee_id` varchar(36) NOT NULL,
  `employee_code` varchar(50) NOT NULL,
  `employee_name` varchar(200) NOT NULL,
  `department_name` varchar(100) DEFAULT NULL,
  `designation_name` varchar(100) DEFAULT NULL,
  `calculation_status` enum('pending','calculating','calculated','error','excluded') DEFAULT 'pending',
  `calculation_errors` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`calculation_errors`)),
  `worked_days` decimal(5,2) DEFAULT 0.00,
  `worked_hours` decimal(8,2) DEFAULT 0.00,
  `overtime_hours` decimal(8,2) DEFAULT 0.00,
  `leave_days` decimal(5,2) DEFAULT 0.00,
  `total_earnings` decimal(12,2) DEFAULT 0.00,
  `total_deductions` decimal(12,2) DEFAULT 0.00,
  `total_taxes` decimal(12,2) DEFAULT 0.00,
  `total_benefits` decimal(12,2) DEFAULT 0.00,
  `gross_salary` decimal(12,2) DEFAULT 0.00,
  `taxable_income` decimal(12,2) DEFAULT 0.00,
  `net_salary` decimal(12,2) DEFAULT 0.00,
  `payment_status` enum('pending','paid','failed','cancelled') DEFAULT 'pending',
  `payment_method` enum('bank_transfer','cash','cheque') DEFAULT 'bank_transfer',
  `payment_date` date DEFAULT NULL,
  `payment_reference` varchar(100) DEFAULT NULL,
  `approved_by` varchar(36) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `calculated_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `notes` text DEFAULT NULL,
  `weekday_working_days` decimal(10,2) DEFAULT NULL COMMENT 'Pre-calculated weekday (Mon-Fri) working days excluding holidays',
  `working_saturdays` decimal(10,2) DEFAULT NULL COMMENT 'Pre-calculated Saturday working days for this employee',
  `working_sundays` decimal(10,2) DEFAULT NULL COMMENT 'Pre-calculated Sunday working days for this employee',
  `weekday_daily_hours` decimal(5,2) DEFAULT NULL COMMENT 'Pre-calculated daily hours for weekdays (Mon-Fri)',
  `saturday_daily_hours` decimal(5,2) DEFAULT NULL COMMENT 'Pre-calculated daily hours for Saturday',
  `sunday_daily_hours` decimal(5,2) DEFAULT NULL COMMENT 'Pre-calculated daily hours for Sunday',
  `daily_salary` decimal(10,2) DEFAULT NULL COMMENT 'Pre-calculated daily salary (base_salary / total_working_days)',
  `weekday_hourly_rate` decimal(10,2) DEFAULT NULL COMMENT 'Pre-calculated hourly rate for weekdays',
  `saturday_hourly_rate` decimal(10,2) DEFAULT NULL COMMENT 'Pre-calculated hourly rate for Saturday',
  `sunday_hourly_rate` decimal(10,2) DEFAULT NULL COMMENT 'Pre-calculated hourly rate for Sunday',
  `base_salary` decimal(12,2) DEFAULT NULL COMMENT 'Employee base salary at the time of payroll run creation',
  `attendance_affects_salary` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payroll_records_old_backup`
--

CREATE TABLE `payroll_records_old_backup` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `employee_id` varchar(36) NOT NULL,
  `pay_period_start` date NOT NULL,
  `pay_period_end` date NOT NULL,
  `base_salary` decimal(15,2) NOT NULL,
  `allowances` decimal(15,2) DEFAULT 0.00,
  `overtime_amount` decimal(15,2) DEFAULT 0.00,
  `bonus` decimal(15,2) DEFAULT 0.00,
  `commission` decimal(15,2) DEFAULT 0.00,
  `gross_salary` decimal(15,2) NOT NULL,
  `tax_deduction` decimal(15,2) DEFAULT 0.00,
  `provident_fund` decimal(15,2) DEFAULT 0.00,
  `insurance` decimal(15,2) DEFAULT 0.00,
  `loan_deduction` decimal(15,2) DEFAULT 0.00,
  `other_deductions` decimal(15,2) DEFAULT 0.00,
  `total_deductions` decimal(15,2) DEFAULT 0.00,
  `net_salary` decimal(15,2) NOT NULL,
  `payment_status` enum('pending','processing','paid','failed') DEFAULT 'pending',
  `payment_method` enum('bank_transfer','cash','cheque') DEFAULT 'bank_transfer',
  `payment_date` date DEFAULT NULL,
  `payment_reference` varchar(100) DEFAULT NULL,
  `processed_by` varchar(36) DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Triggers `payroll_records_old_backup`
--
DELIMITER $$
CREATE TRIGGER `trg_payroll_after_update` AFTER UPDATE ON `payroll_records_old_backup` FOR EACH ROW BEGIN
  -- If payment status changed to 'paid', update loan balances
  IF OLD.payment_status != 'paid' AND NEW.payment_status = 'paid' THEN
    UPDATE employee_loans 
    SET 
      total_paid = total_paid + NEW.loan_deduction,
      remaining_amount = remaining_amount - NEW.loan_deduction,
      status = CASE 
        WHEN remaining_amount - NEW.loan_deduction <= 0 THEN 'completed'
        ELSE status 
      END
    WHERE employee_id = NEW.employee_id 
      AND status = 'active';
  END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_payroll_before_insert` BEFORE INSERT ON `payroll_records_old_backup` FOR EACH ROW BEGIN
  -- Ensure net salary is not negative
  IF NEW.net_salary < 0 THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Net salary cannot be negative';
  END IF;
  
  -- Ensure dates are valid
  IF NEW.pay_period_end <= NEW.pay_period_start THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Pay period end date must be after start date';
  END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `payroll_record_components`
--

CREATE TABLE `payroll_record_components` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `record_id` varchar(36) NOT NULL,
  `component_id` varchar(36) DEFAULT NULL,
  `component_code` varchar(30) NOT NULL,
  `component_name` varchar(100) NOT NULL,
  `component_type` enum('earning','deduction','tax','benefit') NOT NULL,
  `component_category` varchar(50) NOT NULL,
  `calculation_method` varchar(20) NOT NULL,
  `base_amount` decimal(12,2) DEFAULT 0.00,
  `rate` decimal(10,4) DEFAULT 0.0000,
  `quantity` decimal(10,2) DEFAULT 1.00,
  `calculated_amount` decimal(12,2) NOT NULL,
  `is_overridden` tinyint(1) DEFAULT 0,
  `original_amount` decimal(12,2) DEFAULT NULL,
  `override_reason` varchar(255) DEFAULT NULL,
  `overridden_by` varchar(36) DEFAULT NULL,
  `overridden_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Triggers `payroll_record_components`
--
DELIMITER $$
CREATE TRIGGER `update_deduction_installments` AFTER INSERT ON `payroll_record_components` FOR EACH ROW BEGIN
    -- Decrease remaining installments for loan deductions
    IF NEW.component_type = 'deduction' AND NEW.component_code LIKE '%LOAN%' THEN
        UPDATE employee_deductions 
        SET remaining_installments = remaining_installments - 1
        WHERE employee_id = (
            SELECT pr.employee_id 
            FROM payroll_records pr 
            WHERE pr.id = NEW.record_id
        )
        AND deduction_type = 'loan_deduction'
        AND remaining_installments > 0;
        
        -- Deactivate deduction if installments are complete
        UPDATE employee_deductions 
        SET is_active = FALSE
        WHERE employee_id = (
            SELECT pr.employee_id 
            FROM payroll_records pr 
            WHERE pr.id = NEW.record_id
        )
        AND deduction_type = 'loan_deduction'
        AND remaining_installments <= 0;
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `payroll_runs`
--

CREATE TABLE `payroll_runs` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `client_id` varchar(36) NOT NULL,
  `run_number` varchar(50) NOT NULL,
  `period_id` varchar(36) NOT NULL,
  `run_name` varchar(100) NOT NULL,
  `run_type` enum('regular','bonus','correction','off-cycle') DEFAULT 'regular',
  `run_status` enum('draft','calculating','calculated','review','approved','processing','completed','cancelled') DEFAULT 'draft',
  `total_employees` int(11) DEFAULT 0,
  `processed_employees` int(11) DEFAULT 0,
  `total_gross_amount` decimal(15,2) DEFAULT 0.00,
  `total_deductions_amount` decimal(15,2) DEFAULT 0.00,
  `total_net_amount` decimal(15,2) DEFAULT 0.00,
  `calculation_started_at` timestamp NULL DEFAULT NULL,
  `calculation_completed_at` timestamp NULL DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `reviewed_by` varchar(36) DEFAULT NULL,
  `approved_by` varchar(36) DEFAULT NULL,
  `processed_by` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `calculation_method` enum('simple','advanced') DEFAULT 'advanced',
  `notes` text DEFAULT NULL,
  `processing_errors` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`processing_errors`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payroll_schedules`
--

CREATE TABLE `payroll_schedules` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `client_id` varchar(36) NOT NULL,
  `schedule_name` varchar(100) NOT NULL,
  `frequency` enum('weekly','bi-weekly','monthly','quarterly') DEFAULT 'monthly',
  `day_of_month` int(11) DEFAULT NULL COMMENT 'Day of month for monthly frequency',
  `day_of_week` int(11) DEFAULT NULL COMMENT 'Day of week for weekly frequency (0-6)',
  `processing_time` time DEFAULT '09:00:00',
  `default_values` longtext DEFAULT NULL CHECK (json_valid(`default_values`)),
  `is_active` tinyint(1) DEFAULT 1,
  `last_processed_date` date DEFAULT NULL,
  `last_result` longtext DEFAULT NULL CHECK (json_valid(`last_result`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payroll_tax_slabs`
--

CREATE TABLE `payroll_tax_slabs` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `client_id` varchar(36) NOT NULL,
  `slab_name` varchar(100) NOT NULL,
  `min_amount` decimal(15,2) NOT NULL,
  `max_amount` decimal(15,2) DEFAULT NULL,
  `tax_rate` decimal(5,4) NOT NULL COMMENT 'Tax rate as decimal (e.g., 0.15 for 15%)',
  `fixed_amount` decimal(15,2) DEFAULT 0.00 COMMENT 'Fixed tax amount for this slab',
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `permissions`
--

CREATE TABLE `permissions` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `module` varchar(50) NOT NULL,
  `action` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `client_id` varchar(36) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `access_level` enum('basic','moderate','full') DEFAULT 'basic',
  `is_system_role` tinyint(1) DEFAULT 0,
  `is_editable` tinyint(1) DEFAULT 1,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `role_permissions`
--

CREATE TABLE `role_permissions` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `role_id` varchar(36) NOT NULL,
  `permission_id` varchar(36) NOT NULL,
  `granted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `granted_by` varchar(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `system_settings`
--

CREATE TABLE `system_settings` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `client_id` varchar(36) DEFAULT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` longtext NOT NULL CHECK (json_valid(`setting_value`)),
  `setting_type` enum('string','number','boolean','object','array') DEFAULT 'string',
  `description` text DEFAULT NULL,
  `is_public` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `user_level` int(11) NOT NULL,
  `username` varchar(10) NOT NULL,
  `email` tinytext NOT NULL,
  `password` varchar(64) NOT NULL,
  `password_salt` varchar(20) NOT NULL,
  `name` varchar(30) NOT NULL,
  `created` datetime NOT NULL,
  `attempt` varchar(15) NOT NULL DEFAULT '0',
  `api_key` text NOT NULL,
  `api_secret` text NOT NULL,
  `language` text NOT NULL,
  `mobile_or_reg_id` text NOT NULL,
  `zoom_first_name` text NOT NULL,
  `online_payment` text NOT NULL,
  `video_records` text NOT NULL,
  `placeholder_to_input` text NOT NULL,
  `send_pin_code_automatically` text NOT NULL,
  `video_count` text NOT NULL,
  `zoom_recording_in_url` text NOT NULL,
  `student_error_msg` text NOT NULL,
  `white_label_name` text NOT NULL,
  `white_label_url` text NOT NULL,
  `text_it_username` text NOT NULL,
  `no_more` text NOT NULL,
  `profile_picture` text NOT NULL,
  `art` varchar(255) DEFAULT NULL,
  `attendance_allowed` varchar(225) NOT NULL,
  `fixed_salary` varchar(225) NOT NULL,
  `salary_allowes` varchar(225) NOT NULL,
  `company_join_month_and_year` varchar(225) NOT NULL,
  `theme_color` varchar(225) NOT NULL DEFAULT '',
  `art_work_com_not_allowed` varchar(225) NOT NULL DEFAULT '',
  `system_create_allowed` varchar(225) NOT NULL,
  `if_artwork_correction_allow` varchar(225) NOT NULL,
  `card_list_reminder_maintain` varchar(225) NOT NULL,
  `card_list_invoice_maintain` varchar(225) NOT NULL,
  `new_user_level` varchar(225) NOT NULL,
  `work_start_time` varchar(255) NOT NULL,
  `rfid_no` varchar(225) NOT NULL,
  `if_user_can_login` varchar(225) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_sessions`
--

CREATE TABLE `user_sessions` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `admin_user_id` varchar(36) NOT NULL,
  `client_id` varchar(36) DEFAULT NULL,
  `token_jti` varchar(100) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_attendance_summary`
-- (See below for the actual view)
--
CREATE TABLE `v_attendance_summary` (
`employee_id` varchar(36)
,`client_id` varchar(36)
,`employee_name` varchar(201)
,`total_days` bigint(21)
,`present_days` decimal(22,0)
,`absent_days` decimal(22,0)
,`late_days` decimal(22,0)
,`total_hours` decimal(26,2)
,`total_overtime_hours` decimal(26,2)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_current_month_payroll`
-- (See below for the actual view)
--
CREATE TABLE `v_current_month_payroll` (
`id` varchar(36)
,`employee_id` varchar(36)
,`employee_name` varchar(201)
,`employee_code` varchar(50)
,`department` varchar(100)
,`designation` varchar(100)
,`gross_salary` decimal(12,2)
,`total_deductions` decimal(12,2)
,`net_salary` decimal(12,2)
,`payment_status` enum('pending','paid','failed','cancelled')
,`payment_date` date
,`client_id` varchar(36)
);

-- --------------------------------------------------------

--
-- Table structure for table `v_dashboard_stats`
--

CREATE TABLE `v_dashboard_stats` (
  `client_id` varchar(36) DEFAULT NULL,
  `client_name` varchar(255) DEFAULT NULL,
  `total_employees` bigint(21) DEFAULT NULL,
  `active_employees` bigint(21) DEFAULT NULL,
  `total_departments` bigint(21) DEFAULT NULL,
  `total_admin_users` bigint(21) DEFAULT NULL,
  `present_today` bigint(21) DEFAULT NULL,
  `absent_today` bigint(21) DEFAULT NULL,
  `late_today` bigint(21) DEFAULT NULL,
  `pending_leave_requests` bigint(21) DEFAULT NULL,
  `pending_payroll_records` bigint(21) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `v_employee_details`
--

CREATE TABLE `v_employee_details` (
  `id` varchar(36) DEFAULT NULL,
  `client_id` varchar(36) DEFAULT NULL,
  `employee_code` varchar(50) DEFAULT NULL,
  `full_name` varchar(201) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `hire_date` date DEFAULT NULL,
  `employee_type` enum('permanent','contract','intern','consultant') DEFAULT NULL,
  `work_location` enum('office','remote','hybrid') DEFAULT NULL,
  `employment_status` enum('active','inactive','terminated','resigned') DEFAULT NULL,
  `base_salary` decimal(15,2) DEFAULT NULL,
  `department_name` varchar(100) DEFAULT NULL,
  `designation_title` varchar(100) DEFAULT NULL,
  `manager_name` varchar(201) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `v_employee_directory`
--

CREATE TABLE `v_employee_directory` (
  `id` varchar(36) DEFAULT NULL,
  `client_id` varchar(36) DEFAULT NULL,
  `employee_code` varchar(50) DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `full_name` varchar(201) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `hire_date` date DEFAULT NULL,
  `employee_type` enum('permanent','contract','intern','consultant') DEFAULT NULL,
  `work_location` enum('office','remote','hybrid') DEFAULT NULL,
  `employment_status` enum('active','inactive','terminated','resigned') DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `designation` varchar(100) DEFAULT NULL,
  `manager` varchar(201) DEFAULT NULL,
  `profile_image` varchar(500) DEFAULT NULL,
  `years_of_service` bigint(21) DEFAULT NULL,
  `last_attendance_status` varchar(8) DEFAULT NULL,
  `current_status` varchar(9) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_payroll_stats_by_department`
-- (See below for the actual view)
--
CREATE TABLE `v_payroll_stats_by_department` (
`client_id` varchar(36)
,`department_id` varchar(36)
,`department_name` varchar(100)
,`employee_count` bigint(21)
,`avg_gross_salary` decimal(16,6)
,`avg_net_salary` decimal(16,6)
,`total_gross_salary` decimal(34,2)
,`total_net_salary` decimal(34,2)
,`year` int(5)
,`month` int(3)
);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin_users`
--
ALTER TABLE `admin_users`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `attendance`
--
ALTER TABLE `attendance`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_attendance_overtime` (`employee_id`,`date`,`overtime_hours`),
  ADD KEY `fk_attendance_leave_request` (`leave_request_id`),
  ADD KEY `idx_attendance_leave_status` (`employee_id`,`date`,`status`,`leave_request_id`),
  ADD KEY `idx_attendance_is_weekend` (`employee_id`,`is_weekend`,`date`),
  ADD KEY `idx_attendance_payable_duration` (`employee_id`,`date`,`payable_duration`);

--
-- Indexes for table `attendance_master`
--
ALTER TABLE `attendance_master`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `clients`
--
ALTER TABLE `clients`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `employees`
--
ALTER TABLE `employees`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_employees_attendance_affects_salary` (`attendance_affects_salary`);

--
-- Indexes for table `employee_advances`
--
ALTER TABLE `employee_advances`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_employee_advances_employee` (`employee_id`),
  ADD KEY `idx_employee_advances_status` (`status`),
  ADD KEY `idx_employee_advances_type` (`advance_type`),
  ADD KEY `idx_employee_advances_dates` (`request_date`,`required_date`),
  ADD KEY `fk_employee_advances_approver` (`approved_by`),
  ADD KEY `fk_employee_advances_payer` (`paid_by`),
  ADD KEY `fk_employee_advances_creator` (`created_by`),
  ADD KEY `idx_advances_employee_status` (`employee_id`,`status`),
  ADD KEY `idx_advances_deduction_date` (`deduction_start_date`,`status`);

--
-- Indexes for table `employee_allowances`
--
ALTER TABLE `employee_allowances`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_emp_allowances_client_employee` (`client_id`,`employee_id`),
  ADD KEY `idx_emp_allowances_active` (`is_active`,`effective_from`,`effective_to`),
  ADD KEY `fk_allowances_employee` (`employee_id`);

--
-- Indexes for table `employee_bonuses`
--
ALTER TABLE `employee_bonuses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_employee_bonuses_employee` (`employee_id`),
  ADD KEY `idx_employee_bonuses_status` (`status`),
  ADD KEY `idx_employee_bonuses_type` (`bonus_type`),
  ADD KEY `idx_employee_bonuses_dates` (`effective_date`,`payment_date`),
  ADD KEY `idx_employee_bonuses_period` (`bonus_period`),
  ADD KEY `fk_employee_bonuses_approver` (`approved_by`),
  ADD KEY `fk_employee_bonuses_processor` (`processed_by`),
  ADD KEY `fk_employee_bonuses_creator` (`created_by`),
  ADD KEY `idx_bonuses_employee_status` (`employee_id`,`status`),
  ADD KEY `idx_bonuses_type_period` (`bonus_type`,`bonus_period`);

--
-- Indexes for table `employee_deductions`
--
ALTER TABLE `employee_deductions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_emp_deductions_client_employee` (`client_id`,`employee_id`),
  ADD KEY `idx_emp_deductions_active` (`is_active`,`effective_from`,`effective_to`),
  ADD KEY `fk_deductions_employee` (`employee_id`);

--
-- Indexes for table `employee_documents`
--
ALTER TABLE `employee_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_employee_documents` (`employee_id`,`client_id`),
  ADD KEY `idx_document_type` (`document_type`),
  ADD KEY `idx_uploaded_at` (`uploaded_at`),
  ADD KEY `idx_active_documents` (`is_active`,`employee_id`),
  ADD KEY `fk_employee_documents_client` (`client_id`);

--
-- Indexes for table `employee_loans`
--
ALTER TABLE `employee_loans`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_employee_loans_employee` (`employee_id`),
  ADD KEY `idx_employee_loans_status` (`status`),
  ADD KEY `idx_employee_loans_dates` (`start_date`,`end_date`),
  ADD KEY `fk_employee_loans_approver` (`approved_by`);

--
-- Indexes for table `employee_payroll_components`
--
ALTER TABLE `employee_payroll_components`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_employee_component` (`employee_id`,`component_id`,`effective_from`),
  ADD KEY `idx_emp_payroll_comp_employee` (`employee_id`),
  ADD KEY `idx_emp_payroll_comp_component` (`component_id`),
  ADD KEY `idx_emp_payroll_comp_dates` (`effective_from`,`effective_to`);

--
-- Indexes for table `leave_requests`
--
ALTER TABLE `leave_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_leave_balance_transaction` (`balance_transaction_id`),
  ADD KEY `idx_leave_requests_is_paid` (`is_paid`);

--
-- Indexes for table `leave_types`
--
ALTER TABLE `leave_types`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `payroll_adjustments`
--
ALTER TABLE `payroll_adjustments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_payroll_adj_employee` (`employee_id`),
  ADD KEY `idx_payroll_adj_month` (`applicable_month`),
  ADD KEY `idx_payroll_adj_processed` (`is_processed`),
  ADD KEY `fk_payroll_adj_record` (`payroll_record_id`),
  ADD KEY `fk_payroll_adj_approver` (`approved_by`),
  ADD KEY `fk_payroll_adj_creator` (`created_by`);

--
-- Indexes for table `payroll_audit_log`
--
ALTER TABLE `payroll_audit_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_run_action` (`run_id`,`action`),
  ADD KEY `idx_user_action` (`user_id`,`action`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `payroll_components`
--
ALTER TABLE `payroll_components`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_payroll_components_client` (`client_id`),
  ADD KEY `idx_payroll_components_type` (`component_type`);

--
-- Indexes for table `payroll_periods`
--
ALTER TABLE `payroll_periods`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_period` (`client_id`,`period_year`,`period_number`,`period_type`),
  ADD KEY `idx_period_dates` (`period_start_date`,`period_end_date`),
  ADD KEY `idx_pay_date` (`pay_date`);

--
-- Indexes for table `payroll_records`
--
ALTER TABLE `payroll_records`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_run_employee` (`run_id`,`employee_id`),
  ADD KEY `idx_calculation_status` (`calculation_status`),
  ADD KEY `idx_payment_status` (`payment_status`),
  ADD KEY `idx_employee` (`employee_id`),
  ADD KEY `fk_payroll_records_approver` (`approved_by`),
  ADD KEY `idx_payroll_records_calculation` (`calculation_status`,`run_id`),
  ADD KEY `idx_payroll_records_working_days` (`weekday_working_days`,`working_saturdays`,`working_sundays`),
  ADD KEY `idx_payroll_records_salary_rates` (`daily_salary`,`weekday_hourly_rate`),
  ADD KEY `idx_payroll_records_base_salary` (`base_salary`),
  ADD KEY `idx_payroll_records_attendance_affects_salary` (`attendance_affects_salary`);

--
-- Indexes for table `payroll_records_old_backup`
--
ALTER TABLE `payroll_records_old_backup`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_payroll_payment_status` (`payment_status`),
  ADD KEY `idx_payroll_payment_date` (`payment_date`),
  ADD KEY `idx_payroll_period` (`pay_period_start`,`pay_period_end`),
  ADD KEY `idx_payroll_employee_period` (`employee_id`,`pay_period_start`,`pay_period_end`);

--
-- Indexes for table `payroll_record_components`
--
ALTER TABLE `payroll_record_components`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_record_id` (`record_id`),
  ADD KEY `idx_component_type` (`component_type`),
  ADD KEY `idx_component_category` (`component_category`),
  ADD KEY `fk_payroll_record_components_overridden_by` (`overridden_by`);

--
-- Indexes for table `payroll_runs`
--
ALTER TABLE `payroll_runs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_run_number` (`client_id`,`run_number`),
  ADD KEY `idx_run_status` (`run_status`),
  ADD KEY `idx_period` (`period_id`),
  ADD KEY `idx_created_by` (`created_by`),
  ADD KEY `fk_payroll_runs_reviewed_by` (`reviewed_by`),
  ADD KEY `fk_payroll_runs_approved_by` (`approved_by`),
  ADD KEY `fk_payroll_runs_processed_by` (`processed_by`),
  ADD KEY `idx_payroll_runs_status_date` (`run_status`,`created_at`);

--
-- Indexes for table `payroll_schedules`
--
ALTER TABLE `payroll_schedules`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_payroll_schedules_client` (`client_id`),
  ADD KEY `idx_payroll_schedules_active` (`is_active`);

--
-- Indexes for table `payroll_tax_slabs`
--
ALTER TABLE `payroll_tax_slabs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_tax_slabs_client` (`client_id`),
  ADD KEY `idx_tax_slabs_amounts` (`min_amount`,`max_amount`),
  ADD KEY `idx_tax_slabs_dates` (`effective_from`,`effective_to`);

--
-- Indexes for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `user_sessions`
--
ALTER TABLE `user_sessions`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `attendance_master`
--
ALTER TABLE `attendance_master`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

-- --------------------------------------------------------

--
-- Structure for view `employee_monthly_allowances`
--
DROP TABLE IF EXISTS `employee_monthly_allowances`;

CREATE ALGORITHM=UNDEFINED DEFINER=`u770612336_root`@`localhost` SQL SECURITY DEFINER VIEW `employee_monthly_allowances`  AS SELECT `ea`.`client_id` AS `client_id`, `ea`.`employee_id` AS `employee_id`, `e`.`employee_code` AS `employee_code`, concat(`e`.`first_name`,' ',`e`.`last_name`) AS `employee_name`, sum(case when `ea`.`is_percentage` then `e`.`base_salary` * `ea`.`amount` / 100 else `ea`.`amount` end) AS `total_allowances`, count(`ea`.`id`) AS `allowance_count` FROM (`employee_allowances` `ea` join `employees` `e` on(`ea`.`employee_id` = `e`.`id`)) WHERE `ea`.`is_active` = 1 AND `ea`.`effective_from` <= curdate() AND (`ea`.`effective_to` is null OR `ea`.`effective_to` >= curdate()) GROUP BY `ea`.`client_id`, `ea`.`employee_id` ;

-- --------------------------------------------------------

--
-- Structure for view `employee_monthly_deductions`
--
DROP TABLE IF EXISTS `employee_monthly_deductions`;

CREATE ALGORITHM=UNDEFINED DEFINER=`u770612336_root`@`localhost` SQL SECURITY DEFINER VIEW `employee_monthly_deductions`  AS SELECT `ed`.`client_id` AS `client_id`, `ed`.`employee_id` AS `employee_id`, `e`.`employee_code` AS `employee_code`, concat(`e`.`first_name`,' ',`e`.`last_name`) AS `employee_name`, sum(case when `ed`.`is_percentage` then `e`.`base_salary` * `ed`.`amount` / 100 else `ed`.`amount` end) AS `total_deductions`, count(`ed`.`id`) AS `deduction_count` FROM (`employee_deductions` `ed` join `employees` `e` on(`ed`.`employee_id` = `e`.`id`)) WHERE `ed`.`is_active` = 1 AND `ed`.`effective_from` <= curdate() AND (`ed`.`effective_to` is null OR `ed`.`effective_to` >= curdate()) GROUP BY `ed`.`client_id`, `ed`.`employee_id` ;

-- --------------------------------------------------------

--
-- Structure for view `v_attendance_summary`
--
DROP TABLE IF EXISTS `v_attendance_summary`;

CREATE ALGORITHM=UNDEFINED DEFINER=`u770612336_root`@`localhost` SQL SECURITY DEFINER VIEW `v_attendance_summary`  AS SELECT `e`.`id` AS `employee_id`, `e`.`client_id` AS `client_id`, concat(`e`.`first_name`,' ',`e`.`last_name`) AS `employee_name`, count(`a`.`id`) AS `total_days`, sum(case when `a`.`status` = 'present' then 1 else 0 end) AS `present_days`, sum(case when `a`.`status` = 'absent' then 1 else 0 end) AS `absent_days`, sum(case when `a`.`status` = 'late' then 1 else 0 end) AS `late_days`, sum(`a`.`total_hours`) AS `total_hours`, sum(`a`.`overtime_hours`) AS `total_overtime_hours` FROM (`employees` `e` left join `attendance` `a` on(`e`.`id` = `a`.`employee_id` and `a`.`date` >= date_format(current_timestamp(),'%Y-%m-01') and `a`.`date` < date_format(current_timestamp() + interval 1 month,'%Y-%m-01'))) WHERE `e`.`employment_status` = 'active' GROUP BY `e`.`id`, `e`.`client_id` ;

-- --------------------------------------------------------

--
-- Structure for view `v_current_month_payroll`
--
DROP TABLE IF EXISTS `v_current_month_payroll`;

CREATE ALGORITHM=UNDEFINED DEFINER=`u770612336_root`@`localhost` SQL SECURITY DEFINER VIEW `v_current_month_payroll`  AS SELECT `pr`.`id` AS `id`, `pr`.`employee_id` AS `employee_id`, concat(`e`.`first_name`,' ',`e`.`last_name`) AS `employee_name`, `e`.`employee_code` AS `employee_code`, `d`.`name` AS `department`, `des`.`title` AS `designation`, `pr`.`gross_salary` AS `gross_salary`, `pr`.`total_deductions` AS `total_deductions`, `pr`.`net_salary` AS `net_salary`, `pr`.`payment_status` AS `payment_status`, `pr`.`payment_date` AS `payment_date`, `e`.`client_id` AS `client_id` FROM (((((`payroll_records` `pr` join `employees` `e` on(`pr`.`employee_id` = `e`.`id`)) left join `departments` `d` on(`e`.`department_id` = `d`.`id`)) left join `designations` `des` on(`e`.`designation_id` = `des`.`id`)) join `payroll_runs` `run` on(`pr`.`run_id` = `run`.`id`)) join `payroll_periods` `pp` on(`run`.`period_id` = `pp`.`id`)) WHERE year(`pp`.`period_start_date`) = year(curdate()) AND month(`pp`.`period_start_date`) = month(curdate()) ;

-- --------------------------------------------------------

--
-- Structure for view `v_payroll_stats_by_department`
--
DROP TABLE IF EXISTS `v_payroll_stats_by_department`;

CREATE ALGORITHM=UNDEFINED DEFINER=`u770612336_root`@`localhost` SQL SECURITY DEFINER VIEW `v_payroll_stats_by_department`  AS SELECT `e`.`client_id` AS `client_id`, `d`.`id` AS `department_id`, `d`.`name` AS `department_name`, count(distinct `pr`.`employee_id`) AS `employee_count`, avg(`pr`.`gross_salary`) AS `avg_gross_salary`, avg(`pr`.`net_salary`) AS `avg_net_salary`, sum(`pr`.`gross_salary`) AS `total_gross_salary`, sum(`pr`.`net_salary`) AS `total_net_salary`, year(`pp`.`period_start_date`) AS `year`, month(`pp`.`period_start_date`) AS `month` FROM ((((`payroll_records` `pr` join `employees` `e` on(`pr`.`employee_id` = `e`.`id`)) left join `departments` `d` on(`e`.`department_id` = `d`.`id`)) join `payroll_runs` `run` on(`pr`.`run_id` = `run`.`id`)) join `payroll_periods` `pp` on(`run`.`period_id` = `pp`.`id`)) GROUP BY `e`.`client_id`, `d`.`id`, `d`.`name`, year(`pp`.`period_start_date`), month(`pp`.`period_start_date`) ;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `attendance`
--
ALTER TABLE `attendance`
  ADD CONSTRAINT `fk_attendance_leave_request` FOREIGN KEY (`leave_request_id`) REFERENCES `leave_requests` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `employee_advances`
--
ALTER TABLE `employee_advances`
  ADD CONSTRAINT `fk_employee_advances_approver` FOREIGN KEY (`approved_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_employee_advances_creator` FOREIGN KEY (`created_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_employee_advances_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_employee_advances_payer` FOREIGN KEY (`paid_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `employee_allowances`
--
ALTER TABLE `employee_allowances`
  ADD CONSTRAINT `fk_allowances_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `employee_bonuses`
--
ALTER TABLE `employee_bonuses`
  ADD CONSTRAINT `fk_employee_bonuses_approver` FOREIGN KEY (`approved_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_employee_bonuses_creator` FOREIGN KEY (`created_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_employee_bonuses_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_employee_bonuses_processor` FOREIGN KEY (`processed_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `employee_deductions`
--
ALTER TABLE `employee_deductions`
  ADD CONSTRAINT `fk_deductions_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `employee_documents`
--
ALTER TABLE `employee_documents`
  ADD CONSTRAINT `fk_employee_documents_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_employee_documents_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `employee_loans`
--
ALTER TABLE `employee_loans`
  ADD CONSTRAINT `fk_employee_loans_approver` FOREIGN KEY (`approved_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_employee_loans_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `employee_payroll_components`
--
ALTER TABLE `employee_payroll_components`
  ADD CONSTRAINT `fk_emp_payroll_comp_component` FOREIGN KEY (`component_id`) REFERENCES `payroll_components` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_emp_payroll_comp_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `leave_requests`
--
ALTER TABLE `leave_requests`
  ADD CONSTRAINT `fk_leave_balance_transaction` FOREIGN KEY (`balance_transaction_id`) REFERENCES `leave_balance_transactions` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `payroll_adjustments`
--
ALTER TABLE `payroll_adjustments`
  ADD CONSTRAINT `fk_payroll_adj_approver` FOREIGN KEY (`approved_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_payroll_adj_creator` FOREIGN KEY (`created_by`) REFERENCES `admin_users` (`id`),
  ADD CONSTRAINT `fk_payroll_adj_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_payroll_adj_record` FOREIGN KEY (`payroll_record_id`) REFERENCES `payroll_records_old_backup` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `payroll_audit_log`
--
ALTER TABLE `payroll_audit_log`
  ADD CONSTRAINT `fk_payroll_audit_log_run` FOREIGN KEY (`run_id`) REFERENCES `payroll_runs` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_payroll_audit_log_user` FOREIGN KEY (`user_id`) REFERENCES `admin_users` (`id`);

--
-- Constraints for table `payroll_components`
--
ALTER TABLE `payroll_components`
  ADD CONSTRAINT `fk_payroll_components_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `payroll_periods`
--
ALTER TABLE `payroll_periods`
  ADD CONSTRAINT `fk_payroll_periods_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `payroll_records`
--
ALTER TABLE `payroll_records`
  ADD CONSTRAINT `fk_payroll_records_approver` FOREIGN KEY (`approved_by`) REFERENCES `admin_users` (`id`),
  ADD CONSTRAINT `fk_payroll_records_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_payroll_records_run` FOREIGN KEY (`run_id`) REFERENCES `payroll_runs` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `payroll_record_components`
--
ALTER TABLE `payroll_record_components`
  ADD CONSTRAINT `fk_payroll_record_components_overridden_by` FOREIGN KEY (`overridden_by`) REFERENCES `admin_users` (`id`),
  ADD CONSTRAINT `fk_payroll_record_components_record` FOREIGN KEY (`record_id`) REFERENCES `payroll_records` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `payroll_runs`
--
ALTER TABLE `payroll_runs`
  ADD CONSTRAINT `fk_payroll_runs_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `admin_users` (`id`),
  ADD CONSTRAINT `fk_payroll_runs_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_payroll_runs_created_by` FOREIGN KEY (`created_by`) REFERENCES `admin_users` (`id`),
  ADD CONSTRAINT `fk_payroll_runs_period` FOREIGN KEY (`period_id`) REFERENCES `payroll_periods` (`id`),
  ADD CONSTRAINT `fk_payroll_runs_processed_by` FOREIGN KEY (`processed_by`) REFERENCES `admin_users` (`id`),
  ADD CONSTRAINT `fk_payroll_runs_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `admin_users` (`id`);

--
-- Constraints for table `payroll_schedules`
--
ALTER TABLE `payroll_schedules`
  ADD CONSTRAINT `fk_payroll_schedules_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `payroll_tax_slabs`
--
ALTER TABLE `payroll_tax_slabs`
  ADD CONSTRAINT `fk_tax_slabs_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
