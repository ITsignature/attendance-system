const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: '.env' });

/**
 * Migration Script: Update Settings Permissions
 *
 * This script:
 * - Removes old generic settings permissions (settings.view, settings.edit, settings.admin)
 * - Adds new granular settings permissions organized as:
 *
 *   Main Module: Settings
 *     - Attendance Settings (view, edit)
 *     - Leave Settings (view, edit)
 *     - Payroll Settings (view, edit)
 *     - Payroll Component Configuration (view, add, edit, delete for components, allowances, deductions)
 */

const updateSettingsPermissions = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('🔄 Starting settings permissions migration...');
    console.log(`📡 Connected to database: ${process.env.DB_NAME} at ${process.env.DB_HOST}`);

    // Step 1: Remove old settings permissions
    console.log('\n🗑️  Removing old settings permissions...');

    // Get old settings permissions
    const [oldPerms] = await connection.execute(
      'SELECT id, module, action FROM permissions WHERE module = ?',
      ['settings']
    );

    if (oldPerms.length > 0) {
      console.log(`  Found ${oldPerms.length} old settings permissions:`);
      oldPerms.forEach(p => console.log(`    - ${p.module}.${p.action}`));

      // Remove from role_permissions first (foreign key constraint)
      for (const perm of oldPerms) {
        await connection.execute(
          'DELETE FROM role_permissions WHERE permission_id = ?',
          [perm.id]
        );
        console.log(`    ✅ Removed ${perm.module}.${perm.action} from all roles`);
      }

      // Remove the permissions themselves
      await connection.execute(
        'DELETE FROM permissions WHERE module = ?',
        ['settings']
      );
      console.log(`  ✅ Deleted all old settings permissions`);
    } else {
      console.log(`  ℹ️  No old settings permissions found`);
    }

    // Step 2: Define new settings permissions
    // All under module: 'settings', with sub-categories in action field
    console.log('\n📝 Adding new settings permissions...');

    const newPermissions = [
      // Attendance Settings
      {
        module: 'settings',
        action: 'attendance.view',
        name: 'View Attendance Settings',
        description: 'View attendance configuration and policies',
        category: 'Attendance Settings'
      },
      {
        module: 'settings',
        action: 'attendance.edit',
        name: 'Edit Attendance Settings',
        description: 'Modify attendance configuration and policies',
        category: 'Attendance Settings'
      },

      // Leave Settings
      {
        module: 'settings',
        action: 'leaves.view',
        name: 'View Leave Settings',
        description: 'View leave policies and configuration',
        category: 'Leave Settings'
      },
      {
        module: 'settings',
        action: 'leaves.edit',
        name: 'Edit Leave Settings',
        description: 'Modify leave policies and configuration',
        category: 'Leave Settings'
      },

      // Payroll Settings
      {
        module: 'settings',
        action: 'payroll.view',
        name: 'View Payroll Settings',
        description: 'View payroll configuration and policies',
        category: 'Payroll Settings'
      },
      {
        module: 'settings',
        action: 'payroll.edit',
        name: 'Edit Payroll Settings',
        description: 'Modify payroll configuration and policies',
        category: 'Payroll Settings'
      },

      // Payroll Component Configuration - Payroll Components
      {
        module: 'settings',
        action: 'payroll_components.view',
        name: 'View Payroll Components',
        description: 'View payroll component definitions (earnings, deductions, etc.)',
        category: 'Payroll Component Configuration'
      },
      {
        module: 'settings',
        action: 'payroll_components.add',
        name: 'Add Payroll Components',
        description: 'Create new payroll component definitions',
        category: 'Payroll Component Configuration'
      },
      {
        module: 'settings',
        action: 'payroll_components.edit',
        name: 'Edit Payroll Components',
        description: 'Modify existing payroll component definitions',
        category: 'Payroll Component Configuration'
      },
      {
        module: 'settings',
        action: 'payroll_components.delete',
        name: 'Delete Payroll Components',
        description: 'Remove payroll component definitions',
        category: 'Payroll Component Configuration'
      },

      // Payroll Component Configuration - Employee Allowances
      {
        module: 'settings',
        action: 'employee_allowances.view',
        name: 'View Employee Allowances',
        description: 'View employee allowance assignments',
        category: 'Payroll Component Configuration'
      },
      {
        module: 'settings',
        action: 'employee_allowances.add',
        name: 'Add Employee Allowances',
        description: 'Assign new allowances to employees',
        category: 'Payroll Component Configuration'
      },
      {
        module: 'settings',
        action: 'employee_allowances.edit',
        name: 'Edit Employee Allowances',
        description: 'Modify employee allowance assignments',
        category: 'Payroll Component Configuration'
      },
      {
        module: 'settings',
        action: 'employee_allowances.delete',
        name: 'Delete Employee Allowances',
        description: 'Remove employee allowance assignments',
        category: 'Payroll Component Configuration'
      },

      // Payroll Component Configuration - Employee Deductions
      {
        module: 'settings',
        action: 'employee_deductions.view',
        name: 'View Employee Deductions',
        description: 'View employee deduction assignments',
        category: 'Payroll Component Configuration'
      },
      {
        module: 'settings',
        action: 'employee_deductions.add',
        name: 'Add Employee Deductions',
        description: 'Assign new deductions to employees',
        category: 'Payroll Component Configuration'
      },
      {
        module: 'settings',
        action: 'employee_deductions.edit',
        name: 'Edit Employee Deductions',
        description: 'Modify employee deduction assignments',
        category: 'Payroll Component Configuration'
      },
      {
        module: 'settings',
        action: 'employee_deductions.delete',
        name: 'Delete Employee Deductions',
        description: 'Remove employee deduction assignments',
        category: 'Payroll Component Configuration'
      }
    ];

    // Insert new permissions
    const insertedPermissions = [];

    for (const perm of newPermissions) {
      // Check if permission already exists
      const [existing] = await connection.execute(
        'SELECT id, module, action FROM permissions WHERE module = ? AND action = ?',
        [perm.module, perm.action]
      );

      if (existing.length > 0) {
        console.log(`  ⚠️  Permission ${perm.module}.${perm.action} already exists, updating...`);

        // Update description
        await connection.execute(`
          UPDATE permissions
          SET name = ?, description = ?, is_active = TRUE
          WHERE id = ?
        `, [perm.name, perm.description, existing[0].id]);

        insertedPermissions.push(existing[0]);
      } else {
        const permId = uuidv4();
        await connection.execute(`
          INSERT INTO permissions (id, module, action, name, description, is_active)
          VALUES (?, ?, ?, ?, ?, TRUE)
        `, [permId, perm.module, perm.action, perm.name, perm.description]);

        console.log(`  ✅ Added: ${perm.module}.${perm.action} - ${perm.name}`);
        insertedPermissions.push({ id: permId, module: perm.module, action: perm.action });
      }
    }

    // Step 3: Update system roles to include new permissions
    console.log('\n📋 Updating system roles with new permissions...');

    // Get all new settings permission IDs
    const [allPermissions] = await connection.execute(
      'SELECT id, module, action FROM permissions WHERE module = ? AND is_active = TRUE',
      ['settings']
    );

    const permissionMap = {};
    allPermissions.forEach(p => {
      permissionMap[`${p.module}.${p.action}`] = p.id;
    });

    console.log(`\n📊 Available new settings permissions: ${Object.keys(permissionMap).length}`);

    // Define which roles should get which permissions
    const rolePermissionUpdates = {
      'hr-admin': [
        // Full access to all settings
        'settings.attendance.view',
        'settings.attendance.edit',
        'settings.leaves.view',
        'settings.leaves.edit',
        'settings.payroll.view',
        'settings.payroll.edit',
        'settings.payroll_components.view',
        'settings.payroll_components.add',
        'settings.payroll_components.edit',
        'settings.payroll_components.delete',
        'settings.employee_allowances.view',
        'settings.employee_allowances.add',
        'settings.employee_allowances.edit',
        'settings.employee_allowances.delete',
        'settings.employee_deductions.view',
        'settings.employee_deductions.add',
        'settings.employee_deductions.edit',
        'settings.employee_deductions.delete'
      ],
      'super-admin': [
        // Full access to all settings
        'settings.attendance.view',
        'settings.attendance.edit',
        'settings.leaves.view',
        'settings.leaves.edit',
        'settings.payroll.view',
        'settings.payroll.edit',
        'settings.payroll_components.view',
        'settings.payroll_components.add',
        'settings.payroll_components.edit',
        'settings.payroll_components.delete',
        'settings.employee_allowances.view',
        'settings.employee_allowances.add',
        'settings.employee_allowances.edit',
        'settings.employee_allowances.delete',
        'settings.employee_deductions.view',
        'settings.employee_deductions.add',
        'settings.employee_deductions.edit',
        'settings.employee_deductions.delete'
      ],
      'manager': [
        // View-only access for managers
        'settings.attendance.view',
        'settings.leaves.view',
        'settings.payroll.view',
        'settings.payroll_components.view',
        'settings.employee_allowances.view',
        'settings.employee_deductions.view'
      ]
    };

    // Add permissions to roles
    for (const [roleId, permissions] of Object.entries(rolePermissionUpdates)) {
      // Check if role exists
      const [roleCheck] = await connection.execute(
        'SELECT id, name FROM roles WHERE id = ?',
        [roleId]
      );

      if (roleCheck.length === 0) {
        console.log(`  ⚠️  Role ${roleId} not found, skipping...`);
        continue;
      }

      console.log(`\n🔄 Updating role: ${roleCheck[0].name} (${roleId})`);

      let addedCount = 0;
      let skippedCount = 0;

      for (const permKey of permissions) {
        const permissionId = permissionMap[permKey];

        if (!permissionId) {
          console.log(`    ⚠️  Permission ${permKey} not found`);
          continue;
        }

        // Check if role already has this permission
        const [existingRolePerm] = await connection.execute(
          'SELECT id FROM role_permissions WHERE role_id = ? AND permission_id = ?',
          [roleId, permissionId]
        );

        if (existingRolePerm.length > 0) {
          skippedCount++;
        } else {
          await connection.execute(`
            INSERT INTO role_permissions (id, role_id, permission_id, granted_at)
            VALUES (?, ?, ?, NOW())
          `, [uuidv4(), roleId, permissionId]);
          addedCount++;
        }
      }

      console.log(`    ✅ Added ${addedCount} permissions, skipped ${skippedCount} existing`);
    }

    // Display summary
    console.log('\n\n📊 Migration Summary:');
    console.log('='.repeat(70));

    // Group permissions by category for display
    const categories = {
      'Attendance Settings': [],
      'Leave Settings': [],
      'Payroll Settings': [],
      'Payroll Component Configuration': []
    };

    const categoryMapping = {
      'attendance': 'Attendance Settings',
      'leaves': 'Leave Settings',
      'payroll': 'Payroll Settings',
      'payroll_components': 'Payroll Component Configuration',
      'employee_allowances': 'Payroll Component Configuration',
      'employee_deductions': 'Payroll Component Configuration'
    };

    const [allSettingsPerms] = await connection.execute(`
      SELECT module, action, name, description
      FROM permissions
      WHERE module = 'settings' AND is_active = TRUE
      ORDER BY action
    `);

    allSettingsPerms.forEach(p => {
      const subCategory = p.action.split('.')[0];
      const category = categoryMapping[subCategory];
      if (category && categories[category]) {
        categories[category].push(p);
      }
    });

    console.log('\n✅ Settings Module Structure:');
    console.log('\nModule: Settings');

    Object.entries(categories).forEach(([category, perms]) => {
      if (perms.length > 0) {
        console.log(`\n  └─ ${category}:`);
        perms.forEach(p => {
          console.log(`     • ${p.action} - ${p.name}`);
        });
      }
    });

    console.log('\n' + '='.repeat(70));
    console.log('✅ Settings permissions migration completed successfully!');
    console.log(`📝 Total permissions added: ${allSettingsPerms.length}`);
    console.log('='.repeat(70));

    console.log('\n💡 Frontend Display Structure:');
    console.log('Main Module: Settings');
    console.log('  ├─ Attendance Settings');
    console.log('  │  ├─ View Attendance Settings');
    console.log('  │  └─ Edit Attendance Settings');
    console.log('  ├─ Leave Settings');
    console.log('  │  ├─ View Leave Settings');
    console.log('  │  └─ Edit Leave Settings');
    console.log('  ├─ Payroll Settings');
    console.log('  │  ├─ View Payroll Settings');
    console.log('  │  └─ Edit Payroll Settings');
    console.log('  └─ Payroll Component Configuration');
    console.log('     ├─ View/Add/Edit/Delete Payroll Components');
    console.log('     ├─ View/Add/Edit/Delete Employee Allowances');
    console.log('     └─ View/Add/Edit/Delete Employee Deductions');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
};

// Run migration if called directly
if (require.main === module) {
  updateSettingsPermissions()
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

module.exports = updateSettingsPermissions;
