const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: '.env' });

/**
 * Migration Script: Add Holiday Permissions
 *
 * This script adds permissions for:
 * - Holidays module (view, create, edit, delete)
 */

const addHolidayPermissions = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('🔄 Starting holiday permissions migration...');
    console.log(`📡 Connected to database: ${process.env.DB_NAME} at ${process.env.DB_HOST}`);

    // Define the new permissions to add
    const newPermissions = [
      {
        module: 'holidays',
        action: 'view',
        name: 'View Holidays',
        description: 'View holiday calendar and list'
      },
      {
        module: 'holidays',
        action: 'create',
        name: 'Create Holidays',
        description: 'Add new holidays to the calendar'
      },
      {
        module: 'holidays',
        action: 'edit',
        name: 'Edit Holidays',
        description: 'Modify existing holidays'
      },
      {
        module: 'holidays',
        action: 'delete',
        name: 'Delete Holidays',
        description: 'Remove holidays from the calendar'
      }
    ];

    // Insert new permissions (IGNORE duplicates)
    console.log('\n📝 Adding new permissions...');
    const insertedPermissions = [];

    for (const perm of newPermissions) {
      // Check if permission already exists
      const [existing] = await connection.execute(
        'SELECT id, module, action FROM permissions WHERE module = ? AND action = ?',
        [perm.module, perm.action]
      );

      if (existing.length > 0) {
        console.log(`⚠️  Permission ${perm.module}.${perm.action} already exists, skipping...`);
        insertedPermissions.push(existing[0]);
      } else {
        const permId = uuidv4();
        await connection.execute(`
          INSERT INTO permissions (id, module, action, name, description, is_active)
          VALUES (?, ?, ?, ?, ?, TRUE)
        `, [permId, perm.module, perm.action, perm.name, perm.description]);

        console.log(`✅ Added permission: ${perm.module}.${perm.action} - ${perm.name}`);
        insertedPermissions.push({ id: permId, module: perm.module, action: perm.action });
      }
    }

    // Update system roles to include new permissions
    console.log('\n📋 Updating system roles with new permissions...');

    // Get all permission IDs for holidays module
    const [allPermissions] = await connection.execute(
      'SELECT id, module, action FROM permissions WHERE module = ? AND is_active = TRUE',
      ['holidays']
    );

    const permissionMap = {};
    allPermissions.forEach(p => {
      permissionMap[`${p.module}.${p.action}`] = p.id;
    });

    console.log('\n📊 Available permissions:', Object.keys(permissionMap));

    // Define which roles should get which permissions
    const rolePermissionUpdates = {
      'hr-admin': [
        'holidays.view',
        'holidays.create',
        'holidays.edit',
        'holidays.delete'
      ],
      'super-admin': [
        'holidays.view',
        'holidays.create',
        'holidays.edit',
        'holidays.delete'
      ],
      'manager': [
        'holidays.view'
      ],
      'employee-basic': [
        'holidays.view'
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
        console.log(`⚠️  Role ${roleId} not found, skipping...`);
        continue;
      }

      console.log(`\n🔄 Updating role: ${roleCheck[0].name} (${roleId})`);

      for (const permKey of permissions) {
        const permissionId = permissionMap[permKey];

        if (!permissionId) {
          console.log(`  ⚠️  Permission ${permKey} not found`);
          continue;
        }

        // Check if role already has this permission
        const [existingRolePerm] = await connection.execute(
          'SELECT id FROM role_permissions WHERE role_id = ? AND permission_id = ?',
          [roleId, permissionId]
        );

        if (existingRolePerm.length > 0) {
          console.log(`  ⏭️  ${permKey} already assigned to ${roleId}`);
        } else {
          await connection.execute(`
            INSERT INTO role_permissions (id, role_id, permission_id, granted_at)
            VALUES (?, ?, ?, NOW())
          `, [uuidv4(), roleId, permissionId]);

          console.log(`  ✅ Added ${permKey} to ${roleId}`);
        }
      }
    }

    // Display summary
    console.log('\n\n📊 Migration Summary:');
    console.log('='.repeat(50));

    const [holidaysPerms] = await connection.execute(`
      SELECT module, action, name, description
      FROM permissions
      WHERE module = 'holidays' AND is_active = TRUE
      ORDER BY action
    `);

    console.log('\n✅ Holiday Permissions:');
    holidaysPerms.forEach(p => {
      console.log(`   • ${p.module}.${p.action} - ${p.name}`);
      console.log(`     ${p.description}`);
    });

    console.log('\n✅ Holiday permissions migration completed successfully!');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
};

// Run migration if called directly
if (require.main === module) {
  addHolidayPermissions()
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

module.exports = addHolidayPermissions;
