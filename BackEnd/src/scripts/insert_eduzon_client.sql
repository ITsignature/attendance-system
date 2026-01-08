-- Insert new client: Eduzon
-- This script creates a new client entry in the clients table
-- Note: For admin user creation, use the Node.js script instead (createEduzonAdmin.js)

-- Store the client ID in a variable
SET @eduzon_client_id = UUID();

INSERT INTO `clients` (
  `id`,
  `name`,
  `description`,
  `contact_email`,
  `phone`,
  `address`,
  `is_active`,
  `subscription_plan`,
  `subscription_expires_at`
) VALUES (
  @eduzon_client_id,
  'Eduzon',
  'Eduzon - Educational Services',
  'info@eduzon.com',
  NULL,
  NULL,
  1,
  'basic',
  NULL
);

-- Verify the insert
SELECT * FROM `clients` WHERE `name` = 'Eduzon';

-- Note: To create an admin user for Eduzon, run the Node.js script:
-- node src/scripts/createEduzonAdmin.js
