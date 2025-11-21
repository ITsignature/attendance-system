const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

/**
 * Migration Script: Delete Old Payroll Permissions
 *
 * This script removes deprecated payroll permissions:
 * - payroll.process (Process Payroll)
 * - payroll.reports (Payroll Reports)
 *
 * Note: payroll.edit is kept as it's still used for components/allowances/deductions
 */

const deleteOldPayrollPermissions = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('🔄 Starting deletion of old payroll permissions...');
    console.log(`📡 Connected to database: ${process.env.DB_NAME} at ${process.env.DB_HOST}`);

    // Define permissions to delete
    const permissionsToDelete = ['process', 'reports'];

    // Get the permission IDs
    const [permissions] = await connection.execute(`
      SELECT id, module, action, name
      FROM permissions
      WHERE module = 'payroll' AND action IN (?, ?)
    `, permissionsToDelete);

    if (permissions.length === 0) {
      console.log('ℹ️  No old permissions found. They may have already been deleted.');
      return;
    }

    console.log('\n📋 Permissions to delete:');
    permissions.forEach(p => {
      console.log(`   • ${p.name} (${p.module}.${p.action})`);
    });

    // Start transaction
    await connection.beginTransaction();

    let totalRolePermissionsDeleted = 0;

    for (const perm of permissions) {
      // First, delete role_permissions assignments
      console.log(`\n🗑️  Deleting role assignments for: ${perm.name}`);

      const [rolePerms] = await connection.execute(`
        SELECT rp.id, r.name as role_name
        FROM role_permissions rp
        JOIN roles r ON rp.role_id = r.id
        WHERE rp.permission_id = ?
      `, [perm.id]);

      if (rolePerms.length > 0) {
        console.log(`   Found ${rolePerms.length} role assignment(s):`);
        rolePerms.forEach(rp => {
          console.log(`   - ${rp.role_name}`);
        });

        const [deleteResult] = await connection.execute(`
          DELETE FROM role_permissions
          WHERE permission_id = ?
        `, [perm.id]);

        totalRolePermissionsDeleted += deleteResult.affectedRows;
        console.log(`   ✅ Deleted ${deleteResult.affectedRows} role assignment(s)`);
      } else {
        console.log(`   ℹ️  No role assignments found`);
      }

      // Then delete the permission itself
      const [permDeleteResult] = await connection.execute(`
        DELETE FROM permissions
        WHERE id = ?
      `, [perm.id]);

      console.log(`   ✅ Deleted permission: ${perm.name}`);
    }

    // Commit transaction
    await connection.commit();

    // Display summary
    console.log('\n\n📊 Deletion Summary:');
    console.log('='.repeat(50));
    console.log(`✅ Deleted ${permissions.length} permission(s)`);
    console.log(`✅ Deleted ${totalRolePermissionsDeleted} role assignment(s)`);

    // Show remaining payroll permissions
    const [remainingPerms] = await connection.execute(`
      SELECT module, action, name
      FROM permissions
      WHERE module = 'payroll' AND is_active = TRUE
      ORDER BY action
    `);

    console.log('\n✅ Remaining Payroll Permissions:');
    remainingPerms.forEach(p => {
      console.log(`   • ${p.module}.${p.action} - ${p.name}`);
    });

    console.log('\n✅ Old payroll permissions deleted successfully!');
    console.log('='.repeat(50));

  } catch (error) {
    await connection.rollback();
    console.error('\n❌ Deletion failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
};

// Run deletion if called directly
if (require.main === module) {
  deleteOldPayrollPermissions()
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

module.exports = deleteOldPayrollPermissions;
