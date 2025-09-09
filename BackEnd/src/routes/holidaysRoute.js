const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { getDB } = require('../config/database');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission, ensureClientAccess } = require('../middleware/rbacMiddleware');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');
const { v4: uuidv4 } = require('uuid');

// Apply authentication and client access to all routes
router.use(authenticate);
router.use(ensureClientAccess);

// =============================================
// VALIDATION HELPERS
// =============================================

const validateHoliday = [
  body('name').trim().isLength({ min: 3, max: 100 }).withMessage('Holiday name must be between 3-100 characters'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description too long (max 500 characters)'),
  body('is_optional').optional().isBoolean().withMessage('is_optional must be boolean'),
  body('applies_to_all').optional().isBoolean().withMessage('applies_to_all must be boolean'),
  body('department_ids').optional().isArray().withMessage('department_ids must be an array'),
];

// =============================================
// HOLIDAY MANAGEMENT ROUTES
// =============================================

// GET /api/holidays - Get all holidays for client
router.get('/',
  checkPermission('holidays.view'),
  [
    query('year').optional().isInt({ min: 2020, max: 2100 }).withMessage('Invalid year'),
    query('month').optional().isInt({ min: 1, max: 12 }).withMessage('Invalid month'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const db = getDB();
    const clientId = req.user.clientId;
    const { year, month, limit = 50, offset = 0 } = req.query;

    let whereClause = 'WHERE h.client_id = ?';
    let params = [clientId];

    if (year) {
      whereClause += ' AND YEAR(h.date) = ?';
      params.push(year);
    }

    if (month) {
      whereClause += ' AND MONTH(h.date) = ?';
      params.push(month);
    }

    try {
      // Get total count
      const [countResult] = await db.execute(`
        SELECT COUNT(*) as total
        FROM holidays h
        ${whereClause}
      `, params);

      // Get holidays with department info
      const [holidays] = await db.execute(`
        SELECT 
          h.id,
          h.name,
          h.date,
          h.description,
          h.is_optional,
          h.applies_to_all,
          h.department_ids,
          h.created_at,
          h.updated_at,
          'All Departments' as department_names
        FROM holidays h
        ${whereClause}
        ORDER BY h.date ASC
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), parseInt(offset)]);

      // Format the response
      const formattedHolidays = holidays.map(holiday => ({
        ...holiday,
        department_ids: holiday.department_ids ? JSON.parse(holiday.department_ids) : null
      }));

      const totalCount = countResult[0].total;
      const totalPages = Math.ceil(totalCount / limit);

      res.json({
        success: true,
        data: formattedHolidays,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          pages: totalPages,
          current_page: Math.floor(offset / limit) + 1
        }
      });

    } catch (error) {
      console.error('Error fetching holidays:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch holidays',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

// GET /api/holidays/:id - Get specific holiday
router.get('/:id',
  checkPermission('holidays.view'),
  [
    param('id').isUUID().withMessage('Invalid holiday ID')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const db = getDB();
    const { id } = req.params;
    const clientId = req.user.clientId;

    try {
      const [holiday] = await db.execute(`
        SELECT 
          h.*,
          'All Departments' as department_names
        FROM holidays h
        WHERE h.id = ? AND h.client_id = ?
      `, [id, clientId]);

      if (holiday.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Holiday not found'
        });
      }

      const formattedHoliday = {
        ...holiday[0],
        department_ids: holiday[0].department_ids ? JSON.parse(holiday[0].department_ids) : null
      };

      res.json({
        success: true,
        data: formattedHoliday
      });

    } catch (error) {
      console.error('Error fetching holiday:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch holiday',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

// POST /api/holidays - Create new holiday
router.post('/',
  checkPermission('holidays.create'),
  validateHoliday,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const db = getDB();
    const {
      name,
      date,
      description = null,
      is_optional = false,
      applies_to_all = true,
      department_ids = null
    } = req.body;

    const clientId = req.user.clientId;
    const holidayId = uuidv4();

    try {
      await db.execute('START TRANSACTION');

      // Check for duplicate holiday on same date
      const [existing] = await db.execute(`
        SELECT id FROM holidays 
        WHERE client_id = ? AND date = ? AND name = ?
      `, [clientId, date, name]);

      if (existing.length > 0) {
        await db.execute('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Holiday with same name already exists on this date'
        });
      }

      // Validate department IDs if provided (simplified for now)
      if (!applies_to_all && department_ids && department_ids.length > 0) {
        // For now, we'll skip validation and just store the IDs
        // You can add validation later if needed
      }

      // Create holiday
      await db.execute(`
        INSERT INTO holidays (
          id, client_id, name, date, description, 
          is_optional, applies_to_all, department_ids
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        holidayId, clientId, name, date, description,
        is_optional, applies_to_all,
        (!applies_to_all && department_ids) ? JSON.stringify(department_ids) : null
      ]);

      // Update attendance records for new holiday date
      try {
        console.log(`🔄 New holiday "${name}" created for ${date}, updating existing attendance records...`);
        
        // Add holiday volunteer work status to existing attendance records on this date
        await db.execute(`
          UPDATE attendance a
          JOIN employees e ON a.employee_id = e.id
          SET a.notes = CONCAT(COALESCE(a.notes, ''), 
                              CASE WHEN COALESCE(a.notes, '') != '' THEN '; ' ELSE '' END,
                              'Worked on holiday: ${name}'),
              a.updated_at = NOW()
          WHERE e.client_id = ?
            AND a.date = ?
            AND a.check_in_time IS NOT NULL
            AND (a.notes NOT LIKE '%Worked on holiday:%')
        `, [clientId, date]);
        
        console.log(`✅ Updated existing attendance records for new holiday`);
      } catch (attendanceUpdateError) {
        console.error('Error updating attendance for new holiday:', attendanceUpdateError);
        // Don't fail the creation for this
      }

      await db.execute('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Holiday created successfully',
        data: {
          id: holidayId,
          name,
          date,
          description,
          is_optional,
          applies_to_all,
          department_ids: (!applies_to_all && department_ids) ? department_ids : null
        }
      });

    } catch (error) {
      await db.execute('ROLLBACK');
      console.error('Error creating holiday:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create holiday',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

// PUT /api/holidays/:id - Update holiday
router.put('/:id',
  checkPermission('holidays.edit'),
  [
    param('id').isUUID().withMessage('Invalid holiday ID'),
    ...validateHoliday
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const db = getDB();
    const { id } = req.params;
    const {
      name,
      date,
      description = null,
      is_optional = false,
      applies_to_all = true,
      department_ids = null
    } = req.body;

    const clientId = req.user.clientId;

    try {
      await db.execute('START TRANSACTION');

      // Check if holiday exists and get current date for attendance updates
      const [existing] = await db.execute(`
        SELECT id, date as old_date FROM holidays 
        WHERE id = ? AND client_id = ?
      `, [id, clientId]);

      if (existing.length === 0) {
        await db.execute('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Holiday not found'
        });
      }

      // Check for duplicate name/date (excluding current record)
      const [duplicate] = await db.execute(`
        SELECT id FROM holidays 
        WHERE client_id = ? AND date = ? AND name = ? AND id != ?
      `, [clientId, date, name, id]);

      if (duplicate.length > 0) {
        await db.execute('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Holiday with same name already exists on this date'
        });
      }

      // Validate department IDs if provided (simplified for now)
      if (!applies_to_all && department_ids && department_ids.length > 0) {
        // For now, we'll skip validation and just store the IDs
        // You can add validation later if needed
      }

      // Update holiday
      await db.execute(`
        UPDATE holidays SET
          name = ?,
          date = ?,
          description = ?,
          is_optional = ?,
          applies_to_all = ?,
          department_ids = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND client_id = ?
      `, [
        name, date, description, is_optional, applies_to_all,
        (!applies_to_all && department_ids) ? JSON.stringify(department_ids) : null,
        id, clientId
      ]);

      // Update attendance records if holiday date changed
      const oldDate = existing[0].old_date;
      const newDate = date;
      
      if (oldDate !== newDate) {
        console.log(`🔄 Holiday date changed from ${oldDate} to ${newDate}, updating attendance records...`);
        
        try {
          // Remove holiday volunteer work status from old date
          await db.execute(`
            UPDATE attendance a
            JOIN employees e ON a.employee_id = e.id
            SET a.notes = REPLACE(COALESCE(a.notes, ''), 'Worked on holiday: ${name}', ''),
                a.notes = REPLACE(a.notes, 'Worked on holiday: ', ''),
                a.updated_at = NOW()
            WHERE e.client_id = ?
              AND a.date = ?
              AND a.check_in_time IS NOT NULL
              AND a.notes LIKE '%Worked on holiday:%'
          `, [clientId, oldDate]);
          
          // Add holiday volunteer work status to new date
          await db.execute(`
            UPDATE attendance a
            JOIN employees e ON a.employee_id = e.id
            SET a.notes = CONCAT(COALESCE(a.notes, ''), 
                                CASE WHEN COALESCE(a.notes, '') != '' THEN '; ' ELSE '' END,
                                'Worked on holiday: ${name}'),
                a.updated_at = NOW()
            WHERE e.client_id = ?
              AND a.date = ?
              AND a.check_in_time IS NOT NULL
              AND (a.notes NOT LIKE '%Worked on holiday:%')
          `, [clientId, newDate]);
          
          console.log(`✅ Updated attendance records for holiday date change`);
        } catch (attendanceUpdateError) {
          console.error('Error updating attendance for holiday change:', attendanceUpdateError);
        }
      }

      await db.execute('COMMIT');

      res.json({
        success: true,
        message: 'Holiday updated successfully',
        data: {
          id,
          name,
          date,
          description,
          is_optional,
          applies_to_all,
          department_ids: (!applies_to_all && department_ids) ? department_ids : null
        }
      });

    } catch (error) {
      await db.execute('ROLLBACK');
      console.error('Error updating holiday:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update holiday',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

// DELETE /api/holidays/:id - Delete holiday
router.delete('/:id',
  checkPermission('holidays.delete'),
  [
    param('id').isUUID().withMessage('Invalid holiday ID')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const db = getDB();
    const { id } = req.params;
    const clientId = req.user.clientId;

    try {
      // Check if holiday exists
      const [existing] = await db.execute(`
        SELECT name, date FROM holidays 
        WHERE id = ? AND client_id = ?
      `, [id, clientId]);

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Holiday not found'
        });
      }

      // Delete holiday
      await db.execute(`
        DELETE FROM holidays 
        WHERE id = ? AND client_id = ?
      `, [id, clientId]);

      // Update attendance records for deleted holiday date
      const holidayName = existing[0].name;
      const holidayDate = existing[0].date;
      
      try {
        console.log(`🔄 Holiday "${holidayName}" deleted, removing volunteer work status from attendance...`);
        
        // Remove holiday volunteer work status from attendance records
        await db.execute(`
          UPDATE attendance a
          JOIN employees e ON a.employee_id = e.id
          SET a.notes = REPLACE(COALESCE(a.notes, ''), 'Worked on holiday: ${holidayName}', ''),
              a.notes = REPLACE(a.notes, 'Worked on holiday: ', ''),
              a.updated_at = NOW()
          WHERE e.client_id = ?
            AND a.date = ?
            AND a.check_in_time IS NOT NULL
            AND a.notes LIKE '%Worked on holiday:%'
        `, [clientId, holidayDate]);
        
        console.log(`✅ Removed volunteer work status from attendance records for deleted holiday`);
      } catch (attendanceUpdateError) {
        console.error('Error updating attendance for holiday deletion:', attendanceUpdateError);
        // Don't fail the deletion for this
      }

      res.json({
        success: true,
        message: `Holiday "${existing[0].name}" deleted successfully`
      });

    } catch (error) {
      console.error('Error deleting holiday:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete holiday',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

// =============================================
// UTILITY ROUTES
// =============================================

// GET /api/holidays/working-days - Calculate working days in a period
router.get('/utils/working-days',
  checkPermission('holidays.view'),
  [
    query('start_date').isISO8601().withMessage('Valid start date is required'),
    query('end_date').isISO8601().withMessage('Valid end date is required'),
    query('include_holidays').optional().isBoolean().withMessage('include_holidays must be boolean')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const db = getDB();
    const { start_date, end_date, include_holidays = false } = req.query;
    const clientId = req.user.clientId;

    try {
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);

      if (startDate > endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date must be before end date'
        });
      }

      // Get holidays in the period
      let holidays = [];
      if (!include_holidays) {
        const [holidayResults] = await db.execute(`
          SELECT date FROM holidays 
          WHERE client_id = ? 
            AND date BETWEEN ? AND ?
            AND applies_to_all = TRUE
        `, [clientId, start_date, end_date]);
        
        holidays = holidayResults.map(h => h.date.toISOString().split('T')[0]);
      }

      // Calculate working days
      let workingDays = 0;
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        const dateStr = currentDate.toISOString().split('T')[0];

        // Exclude weekends (Saturday = 6, Sunday = 0)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          // Exclude holidays if not including them
          if (include_holidays || !holidays.includes(dateStr)) {
            workingDays++;
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      res.json({
        success: true,
        data: {
          start_date,
          end_date,
          working_days: workingDays,
          total_days: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1,
          holidays_excluded: holidays.length,
          include_holidays
        }
      });

    } catch (error) {
      console.error('Error calculating working days:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate working days',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

// POST /api/holidays/bulk - Bulk create holidays
router.post('/bulk',
  checkPermission('holidays.create'),
  [
    body('holidays').isArray({ min: 1 }).withMessage('holidays must be a non-empty array'),
    body('holidays.*.name').trim().isLength({ min: 3, max: 100 }).withMessage('Holiday name must be between 3-100 characters'),
    body('holidays.*.date').isISO8601().withMessage('Valid date is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const db = getDB();
    const { holidays } = req.body;
    const clientId = req.user.clientId;

    try {
      await db.execute('START TRANSACTION');

      const results = {
        created: [],
        skipped: [],
        errors: []
      };

      for (const holiday of holidays) {
        try {
          const holidayId = uuidv4();
          const {
            name,
            date,
            description = null,
            is_optional = false,
            applies_to_all = true,
            department_ids = null
          } = holiday;

          // Check for duplicate
          const [existing] = await db.execute(`
            SELECT id FROM holidays 
            WHERE client_id = ? AND date = ? AND name = ?
          `, [clientId, date, name]);

          if (existing.length > 0) {
            results.skipped.push({
              name,
              date,
              reason: 'Holiday already exists'
            });
            continue;
          }

          // Create holiday
          await db.execute(`
            INSERT INTO holidays (
              id, client_id, name, date, description, 
              is_optional, applies_to_all, department_ids
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            holidayId, clientId, name, date, description,
            is_optional, applies_to_all,
            (!applies_to_all && department_ids) ? JSON.stringify(department_ids) : null
          ]);

          results.created.push({
            id: holidayId,
            name,
            date
          });

        } catch (error) {
          results.errors.push({
            name: holiday.name,
            date: holiday.date,
            error: error.message
          });
        }
      }

      await db.execute('COMMIT');

      res.status(201).json({
        success: true,
        message: `Bulk holiday creation completed. Created: ${results.created.length}, Skipped: ${results.skipped.length}, Errors: ${results.errors.length}`,
        data: results
      });

    } catch (error) {
      await db.execute('ROLLBACK');
      console.error('Error in bulk holiday creation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create holidays in bulk',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

module.exports = router;