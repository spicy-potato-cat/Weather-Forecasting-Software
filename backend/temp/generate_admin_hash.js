import bcrypt from 'bcrypt';

const password = 'admin@123';

bcrypt.hash(password, 10).then(hash => {
  console.log('\n📋 Copy this hash into your SQL:\n');
  console.log(hash);
  console.log('\n📝 Full SQL command:\n');
  console.log(`INSERT INTO users (email, password, name, is_admin)
VALUES (
  'admin@aether.com',
  '${hash}',
  'System Administrator',
  TRUE
)
ON CONFLICT (email) DO UPDATE 
SET password = '${hash}', is_admin = TRUE;`);
  console.log('\n');
});