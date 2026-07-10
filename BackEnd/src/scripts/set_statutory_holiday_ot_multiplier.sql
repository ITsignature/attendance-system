-- Set statutory holiday OT multiplier to 2.00 for specific employees

UPDATE employees
SET statutory_holiday_ot_multiplier = 2.00
WHERE id IN (
  '0ecb438d-2a08-4bc9-b829-9e6a79a46299',
  '0ff29a84-2567-4011-8a61-f4e279a63646',
  '18ac5a38-8e2c-475d-9a37-b06362956f54',
  '1ab2ee30-a478-471b-ba74-da140f765d32',
  '1d0d3f0f-a6c6-4e3e-ac35-90ac3a17ac58',
  '1f61843a-9177-4760-b684-dc83687412b2',
  '2398cb4b-c463-4230-a7ea-8689819c0b6a',
  '2a0c774f-bf3c-47e7-9766-f156d80f746e',
  '2bc8494f-043d-4f93-b92a-bec53a6b43a0',
  '382f0b31-47c8-4789-b2ab-b4112f7508ef',
  '392e9e6e-890f-4f76-94bc-f1ba6619821d',
  '3f7f3cd8-25e6-4af5-8169-ceb23ca5ef93',
  '417811d3-e43d-4f2f-8b41-cb9a87f9c040',
  '4dcc92fc-57ea-46a6-b4a8-6bb37cebe177',
  '519b5b3b-4888-4f88-ae0e-a3300119a0e3',
  '572411cb-298b-459c-a65e-29875cdd82ea',
  '60a27cc1-545b-45e0-9b32-44be6affd800',
  '67787c0a-08f6-46b8-8a02-b3fc4c2dd59f',
  '67d4df9c-127a-41e5-b34b-9d6668ddf908',
  '7e33fdbc-b28c-4d93-836d-f870987d3715',
  '812e3921-28cb-4a2e-bd5f-5d30afe145df',
  '866ae69a-4834-4ff7-88ad-4b29e642ca26',
  '99be4509-551d-4a1f-863f-6d5a6db9fc05',
  '9aa22c1b-be78-4819-aa04-fa0f42872b9e',
  '9b73d5e4-d254-4959-a554-28d2d9dfdb78',
  'aa26baee-fedf-46fe-aa02-6efc15651dd5',
  'bc64e989-6471-49db-98bb-2beb6fd0e28b',
  'c8656065-97e5-44af-b349-5bd249f42058',
  'ca5e8ecc-2ba1-4cd9-ab5e-644a6344eb38',
  'd4ccd0ea-2815-4234-a3ce-5b59352de505',
  'd5066ab6-c4cb-4d92-94d5-4ceb4b70b1bc',
  'e5ef508c-33e9-4292-ad19-347a7f024438',
  'e64333c3-ca92-45bf-9687-7469edabe848',
  'e8558ba6-6fe9-49cc-9866-0118bfd9e722',
  'eae6f44a-4c21-4753-b7b4-39d0edf1ca9f',
  'efbaaf1e-62ba-4429-b5a6-4d983cc0bbf6'
);

-- Verification query:
-- SELECT id, first_name, last_name, statutory_holiday_ot_multiplier FROM employees
-- WHERE id IN (...) ;
