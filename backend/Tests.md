# Testing Backend Services

## 1. hMail Email Services

### Prerequisites

- PowerShell installed
- API server running locally (`http://localhost:5000`)
- Test account credentials (`newtest@aether.com` / `test123`)

---

### 1. Login and Obtain Token

```powershell
$loginResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"newtest@aether.com","password":"test123"}'
$token = $loginResponse.token
Write-Host "✅ Logged in as: newtest@aether.com"
```

---

### 2. Send Test Alert Email

```powershell
# Get token
$token = (Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@aether.com","password":"admin@123"}').token

# Send beautiful weather alert
Invoke-RestMethod -Uri "http://localhost:5000/api/email/simulate" `
  -Method POST `
  -Headers @{Authorization="Bearer $token"} `
  -ContentType "application/json" `
  -Body '{
    "to":"admin@aether.com",
    "subject":"Weather Alert: Heavy Rain Warning",
    "template":"weather_alert",
    "variables":{
      "severity":"WARNING",
      "hazard_type":"HEAVY RAIN",
      "location":"Mumbai, Maharashtra",
      "start_time":"2025-01-15 14:00 IST",
      "end_time":"2025-01-15 22:00 IST",
      "details":"Heavy rainfall is expected in Mumbai and surrounding areas. Rainfall intensity may reach 50-100mm in 6 hours. Flooding is possible in low-lying areas. Stay indoors and avoid waterlogged streets."
    }
  }'
```

---

### 3. Verify Email Delivery

- Check the inbox of `newtest@aether.com` for the test alert email.
- Confirm the subject and content match the test data.

---

### 4. Troubleshooting

- Ensure hMail service is running.
- Check API server logs for errors.
- Verify network connectivity between API and hMail server.

---

### Notes

- Update credentials and endpoints as needed for your environment.
- For automated testing, consider scripting inbox checks.

## Backend API Testing Guide

### Prerequisites

- **PostgreSQL** running on localhost:5432
- **hMail Server** running on localhost:25 (for email functionality)
- **Backend server** running on http://localhost:5000
- **Environment variables** configured in `backend/.env`

---

### 1. Authentication Tests

#### Register a New User

**Request:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@aether.com",
    "password": "test@123",
    "name": "John Doe"
  }'
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "testuser@aether.com",
    "name": "John Doe",
    "is_admin": false,
    "created_at": "2023-10-01T12:00:00Z",
    "last_login": null
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Notes:**
- New users receive a welcome email with account details.
- Passwords are hashed; no plaintext passwords are stored.

---

### 2. Admin User Management Guide

### Prerequisites

- PostgreSQL running on localhost:5432
- Backend server running on http://localhost:5000
- Admin account created and logged in
- PowerShell (Windows) or Bash (Linux/Mac)

---

### 2.1. Create Admin Account

Before using admin features, you need an admin account.

**Method 1: Via SQL (Recommended for first admin)**

```sql
-- Run in pgAdmin or psql
-- Create admin user with password: admin@123
INSERT INTO users (email, password, name, is_admin)
VALUES (
  'admin@aether.com',
  '$2b$10$rKZEK8GZ6YQ3kZ8fN0N3YuQJZ8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8',
  'System Administrator',
  TRUE
)
ON CONFLICT (email) DO UPDATE SET is_admin = TRUE;

-- Verify admin was created
SELECT id, email, name, is_admin FROM users WHERE email = 'admin@aether.com';
```

**Method 2: Generate Fresh Password Hash**

```bash
# Generate bcrypt hash for custom password
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('YourPassword123', 10).then(hash => console.log(hash));"

# Use the output in the SQL above
```

**Method 3: Promote Existing User to Admin**

```sql
-- Make existing user an admin
UPDATE users SET is_admin = TRUE WHERE email = 'user@example.com';
```

---

### 2.2. Login as Admin

**PowerShell:**
```powershell
# Login and save token
$adminLogin = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"admin@aether.com","password":"admin@123"}'

$adminToken = $adminLogin.token
$adminId = $adminLogin.user.id

Write-Host "✅ Logged in as: $($adminLogin.user.email)" -ForegroundColor Green
Write-Host "Admin ID: $adminId" -ForegroundColor Cyan
Write-Host "Token: $($adminToken.Substring(0,30))..." -ForegroundColor Yellow
```

**Bash (Linux/Mac):**
```bash
# Login and save token
ADMIN_LOGIN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aether.com","password":"admin@123"}')

ADMIN_TOKEN=$(echo $ADMIN_LOGIN | jq -r '.token')
ADMIN_ID=$(echo $ADMIN_LOGIN | jq -r '.user.id')

echo "✅ Logged in as admin"
echo "Token: ${ADMIN_TOKEN:0:30}..."
```

---

### 2.3. List All Users

Get a paginated list of all users in the system.

**PowerShell:**
```powershell
# List first 20 users (page 1)
$users = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users?page=1&limit=20" `
  -Headers @{Authorization="Bearer $adminToken"}

Write-Host "📋 Total Users: $($users.pagination.totalUsers)" -ForegroundColor Cyan
Write-Host "Page: $($users.pagination.currentPage) / $($users.pagination.totalPages)" -ForegroundColor Yellow

$users.users | ForEach-Object {
    $adminBadge = if ($_.is_admin) { " [ADMIN]" } else { "" }
    $lastLogin = if ($_.last_login) { $_.last_login.Substring(0,10) } else { "Never" }
    Write-Host "  - ID: $($_.id) | $($_.email) ($($_.name))$adminBadge | Last login: $lastLogin" -ForegroundColor White
}
```

**Bash:**
```bash
# List users
curl -X GET "http://localhost:5000/api/admin/users?page=1&limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

**With Search Filter:**
```powershell
# Search for users by email or name
$searchResults = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users?search=john" `
  -Headers @{Authorization="Bearer $adminToken"}

Write-Host "🔍 Search results for 'john': $($searchResults.users.Count) users" -ForegroundColor Cyan
$searchResults.users | ForEach-Object {
    Write-Host "  - $($_.email) ($($_.name))" -ForegroundColor White
}
```

---

### 2.4. View Single User Details

Get detailed information about a specific user.

**PowerShell:**
```powershell
# Get user by ID
$userId = 5
$user = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users/$userId" `
  -Headers @{Authorization="Bearer $adminToken"}

Write-Host "👤 User Details:" -ForegroundColor Cyan
Write-Host "  ID: $($user.user.id)" -ForegroundColor White
Write-Host "  Email: $($user.user.email)" -ForegroundColor White
Write-Host "  Name: $($user.user.name)" -ForegroundColor White
Write-Host "  Admin: $($user.user.is_admin)" -ForegroundColor $(if ($user.user.is_admin) { "Yellow" } else { "Gray" })
Write-Host "  Created: $($user.user.created_at)" -ForegroundColor Gray
Write-Host "  Last Login: $($user.user.last_login)" -ForegroundColor Gray
```

**Bash:**
```bash
USER_ID=5
curl -X GET "http://localhost:5000/api/admin/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

---

### 2.5. Create New User

Create a new user account (PostgreSQL + hMail).

**PowerShell:**
```powershell
# Create regular user
$newUser = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users" `
  -Method POST `
  -Headers @{Authorization="Bearer $adminToken"} `
  -ContentType "application/json" `
  -Body '{
    "email": "newuser@aether.com",
    "password": "newpass@123",
    "name": "Jane Smith",
    "is_admin": false
  }'

Write-Host "✅ User created successfully!" -ForegroundColor Green
Write-Host "  ID: $($newUser.user.id)" -ForegroundColor Cyan
Write-Host "  Email: $($newUser.user.email)" -ForegroundColor Cyan
Write-Host "  Name: $($newUser.user.name)" -ForegroundColor Cyan
```

**Create Admin User:**
```powershell
# Create user with admin privileges
$newAdmin = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users" `
  -Method POST `
  -Headers @{Authorization="Bearer $adminToken"} `
  -ContentType "application/json" `
  -Body '{
    "email": "moderator@aether.com",
    "password": "mod@123",
    "name": "Moderator Account",
    "is_admin": true
  }'

Write-Host "✅ Admin user created!" -ForegroundColor Green
```

**Bash:**
```bash
# Create user
curl -X POST http://localhost:5000/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@aether.com",
    "password": "newpass@123",
    "name": "Jane Smith",
    "is_admin": false
  }'
```

**Verification:**
1. Check PostgreSQL: `SELECT * FROM users WHERE email = 'newuser@aether.com';`
2. Check hMail Administrator → Domains → aether.com → Accounts
3. Verify folders exist: INBOX, Sent, Trash, Drafts, Spam, Junk

---

### 2.6. Update User Details

Modify user information (name, email, password, admin status).

**Update Name:**
```powershell
$userId = 10
Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users/$userId" `
  -Method PUT `
  -Headers @{Authorization="Bearer $adminToken"} `
  -ContentType "application/json" `
  -Body '{"name": "Jane Doe"}'

Write-Host "✅ User name updated" -ForegroundColor Green
```

**Update Email:**
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users/$userId" `
  -Method PUT `
  -Headers @{Authorization="Bearer $adminToken"} `
  -ContentType "application/json" `
  -Body '{"email": "jane.doe@aether.com"}'

Write-Host "✅ User email updated" -ForegroundColor Green
```

**Update Password:**
```powershell
# Update password (also updates hMail password)
Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users/$userId" `
  -Method PUT `
  -Headers @{Authorization="Bearer $adminToken"} `
  -ContentType "application/json" `
  -Body '{"password": "newsecurepass@123"}'

Write-Host "✅ Password updated (PostgreSQL + hMail)" -ForegroundColor Green
```

**Update Multiple Fields:**
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users/$userId" `
  -Method PUT `
  -Headers @{Authorization="Bearer $adminToken"} `
  -ContentType "application/json" `
  -Body '{
    "name": "Jane Doe Updated",
    "email": "jane.updated@aether.com",
    "password": "newpass456@",
    "is_admin": true
  }'

Write-Host "✅ User fully updated" -ForegroundColor Green
```

**Bash:**
```bash
USER_ID=10
curl -X PUT "http://localhost:5000/api/admin/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Jane Doe", "password": "newpass@123"}'
```

---

### 2.7. Toggle Admin Status

Promote or demote users to/from admin role.

**PowerShell:**
```powershell
$userId = 10

# Toggle admin status (if user is admin, demote; if not, promote)
$result = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users/$userId/toggle-admin" `
  -Method POST `
  -Headers @{Authorization="Bearer $adminToken"}

if ($result.user.is_admin) {
    Write-Host "✅ User promoted to admin" -ForegroundColor Green
} else {
    Write-Host "✅ User demoted from admin" -ForegroundColor Yellow
}

Write-Host "  Email: $($result.user.email)" -ForegroundColor Cyan
Write-Host "  Is Admin: $($result.user.is_admin)" -ForegroundColor $(if ($result.user.is_admin) { "Green" } else { "Gray" })
```

**Bash:**
```bash
USER_ID=10
curl -X POST "http://localhost:5000/api/admin/users/$USER_ID/toggle-admin" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Important Notes:**
- ❌ You cannot toggle your own admin status (self-protection)
- ✅ Toggling is instant and affects permissions immediately
- ⚠️ Demoting the last admin will leave the system without admin access

---

### 2.8. Delete User

Permanently delete a user from PostgreSQL and hMail.

**PowerShell:**
```powershell
$userId = 10

# Confirm deletion
Write-Host "⚠️ WARNING: This will permanently delete user ID $userId" -ForegroundColor Red
Write-Host "Press Enter to continue or Ctrl+C to cancel..."
Read-Host

# Delete user
Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users/$userId" `
  -Method DELETE `
  -Headers @{Authorization="Bearer $adminToken"}

Write-Host "✅ User deleted successfully" -ForegroundColor Green
Write-Host "  - PostgreSQL user record removed" -ForegroundColor Gray
Write-Host "  - hMail email account removed" -ForegroundColor Gray
Write-Host "  - All user data cascade deleted" -ForegroundColor Gray
```

**Bash:**
```bash
USER_ID=10
curl -X DELETE "http://localhost:5000/api/admin/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Verification:**
```sql
-- Check PostgreSQL
SELECT * FROM users WHERE id = 10;
-- Should return 0 rows

-- Check related data (should also be deleted)
SELECT * FROM user_preferences WHERE user_id = 10;
SELECT * FROM saved_locations WHERE user_id = 10;
SELECT * FROM alert_subscriptions WHERE user_id = 10;
```

**hMail Verification:**
1. Open hMail Administrator
2. Navigate to Domains → aether.com → Accounts
3. Verify user's email account is deleted
4. Check that folders (INBOX, Sent, etc.) are also removed

**Important Notes:**
- ❌ You cannot delete your own account (self-protection)
- ⚠️ Deletion is permanent and cannot be undone
- ✅ Cascade delete removes all user-related data
- ✅ hMail account is automatically deleted

---

### 2.9. Bulk User Management

Manage multiple users efficiently.

**Create Multiple Users:**
```powershell
# Array of users to create
$usersToCreate = @(
    @{email="user1@aether.com"; password="pass1@123"; name="User One"},
    @{email="user2@aether.com"; password="pass2@123"; name="User Two"},
    @{email="user3@aether.com"; password="pass3@123"; name="User Three"}
)

foreach ($userData in $usersToCreate) {
    try {
        $newUser = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users" `
          -Method POST `
          -Headers @{Authorization="Bearer $adminToken"} `
          -ContentType "application/json" `
          -Body ($userData | ConvertTo-Json)
        
        Write-Host "✅ Created: $($newUser.user.email)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to create $($userData.email): $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 500
}
```

**Delete Multiple Users:**
```powershell
# Array of user IDs to delete
$userIdsToDelete = @(15, 16, 17)

Write-Host "⚠️ WARNING: About to delete $($userIdsToDelete.Count) users" -ForegroundColor Red
Write-Host "Press Enter to continue or Ctrl+C to cancel..."
Read-Host

foreach ($userId in $userIdsToDelete) {
    try {
        Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users/$userId" `
          -Method DELETE `
          -Headers @{Authorization="Bearer $adminToken"}
        
        Write-Host "✅ Deleted user ID: $userId" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to delete user $userId: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 500
}
```

**Export User List to CSV:**
```powershell
# Get all users and export to CSV
$allUsers = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users?limit=1000" `
  -Headers @{Authorization="Bearer $adminToken"}

$allUsers.users | Select-Object id, email, name, is_admin, created_at, last_login | 
  Export-Csv -Path "users_export_$(Get-Date -Format 'yyyyMMdd_HHmmss').csv" -NoTypeInformation

Write-Host "✅ Exported $($allUsers.users.Count) users to CSV" -ForegroundColor Green
```

---

### 2.10. Database Direct Management (Advanced)

For advanced operations, use SQL directly.

**Bulk Grant Admin Privileges:**
```sql
-- Make all users with specific email domain admins
UPDATE users 
SET is_admin = TRUE 
WHERE email LIKE '%@admin.aether.com';

-- Verify
SELECT email, is_admin FROM users WHERE is_admin = TRUE;
```

**Reset All User Passwords:**
```sql
-- Generate hash for default password 'reset@123'
-- Use: node -e "const bcrypt = require('bcrypt'); bcrypt.hash('reset@123', 10).then(hash => console.log(hash));"

UPDATE users 
SET password = '$2b$10$GENERATED_HASH_HERE' 
WHERE is_admin = FALSE;

-- Notify users to change password on next login
```

**Cleanup Inactive Users:**
```sql
-- Find users who haven't logged in for 90 days
SELECT id, email, name, last_login 
FROM users 
WHERE last_login < NOW() - INTERVAL '90 days' 
  AND is_admin = FALSE;

-- Delete inactive users (backup first!)
DELETE FROM users 
WHERE last_login < NOW() - INTERVAL '90 days' 
  AND is_admin = FALSE;
```

**User Statistics:**
```sql
-- Get user statistics
SELECT 
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE is_admin = TRUE) as admin_count,
  COUNT(*) FILTER (WHERE is_admin = FALSE) as regular_users,
  COUNT(*) FILTER (WHERE last_login IS NULL) as never_logged_in,
  COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '7 days') as active_last_week
FROM users;
```

---

### 2.11. Security Best Practices

**Password Policy Enforcement:**
```sql
-- Add password requirements (example)
-- Minimum 8 characters, must contain uppercase, lowercase, number, special char

-- This should be enforced in application code, not database
-- See backend/routes/admin.js for validation
```

**Audit Logging:**
```sql
-- Create audit log table
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    admin_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    target_user_id INTEGER,
    target_user_email VARCHAR(255),
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_audit_admin ON admin_audit_log(admin_id);
CREATE INDEX idx_audit_action ON admin_audit_log(action);
CREATE INDEX idx_audit_created ON admin_audit_log(created_at);

-- View recent admin actions
SELECT 
  admin_email,
  action,
  target_user_email,
  created_at
FROM admin_audit_log
ORDER BY created_at DESC
LIMIT 50;
```

**Session Management:**
```sql
-- Find active sessions
SELECT 
  u.id,
  u.email,
  u.last_login,
  EXTRACT(EPOCH FROM (NOW() - u.last_login)) / 3600 as hours_since_login
FROM users u
WHERE u.last_login > NOW() - INTERVAL '24 hours'
ORDER BY u.last_login DESC;
```

---

### 2.12. Common Admin Tasks

**1. Reset User Password (User Forgot Password):**
```powershell
# Generate new temporary password
$tempPassword = "Temp$(Get-Random -Minimum 1000 -Maximum 9999)@"

$userId = 15
Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users/$userId" `
  -Method PUT `
  -Headers @{Authorization="Bearer $adminToken"} `
  -ContentType "application/json" `
  -Body "{`"password`":`"$tempPassword`"}"

Write-Host "✅ Password reset for user $userId" -ForegroundColor Green
Write-Host "Temporary password: $tempPassword" -ForegroundColor Yellow
Write-Host "⚠️ Send this to the user securely" -ForegroundColor Red
```

**2. Find Duplicate Accounts:**
```sql
-- Find users with similar emails
SELECT email, COUNT(*) 
FROM users 
GROUP BY email 
HAVING COUNT(*) > 1;

-- Find users with similar names
SELECT name, COUNT(*), array_agg(email) as emails
FROM users 
GROUP BY name 
HAVING COUNT(*) > 1;
```

**3. Migrate User to New Email:**
```powershell
$userId = 20
$oldEmail = "old@aether.com"
$newEmail = "new@aether.com"

# Update email in PostgreSQL
Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users/$userId" `
  -Method PUT `
  -Headers @{Authorization="Bearer $adminToken"} `
  -ContentType "application/json" `
  -Body "{`"email`":`"$newEmail`"}"

Write-Host "✅ User migrated from $oldEmail to $newEmail" -ForegroundColor Green
Write-Host "⚠️ Note: hMail account uses old email. Delete old account manually if needed." -ForegroundColor Yellow
```

**4. Emergency Admin Access Recovery:**
```sql
-- If locked out of admin account, create emergency admin via SQL
INSERT INTO users (email, password, name, is_admin)
VALUES (
  'emergency@aether.com',
  '$2b$10$rKZEK8GZ6YQ3kZ8fN0N3YuQJZ8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8', -- admin@123
  'Emergency Admin',
  TRUE
);
```

---

### 2.13. Testing & Verification Checklist

After admin operations, verify:

- [ ] **PostgreSQL**: User record exists/deleted with correct data
- [ ] **hMail**: Email account created/deleted with folders
- [ ] **Permissions**: Admin users can access admin endpoints
- [ ] **Regular users**: Cannot access admin endpoints (403 error)
- [ ] **Password changes**: New password works for login (PostgreSQL + hMail)
- [ ] **Cascade deletion**: Related data (preferences, locations) deleted
- [ ] **Email delivery**: Test email can be sent to created accounts
- [ ] **Session persistence**: User can login after updates

**Quick Verification Script:**
```powershell
# Verify user after creation
$userId = 25
$testPassword = "test@123"

# Check PostgreSQL
Write-Host "🔍 Checking PostgreSQL..." -ForegroundColor Cyan
$userCheck = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users/$userId" `
  -Headers @{Authorization="Bearer $adminToken"}
Write-Host "✅ User exists: $($userCheck.user.email)" -ForegroundColor Green

# Test login
Write-Host "🔐 Testing login..." -ForegroundColor Cyan
$testLogin = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body "{`"email`":`"$($userCheck.user.email)`",`"password`":`"$testPassword`"}"

if ($testLogin.success) {
    Write-Host "✅ Login successful" -ForegroundColor Green
} else {
    Write-Host "❌ Login failed" -ForegroundColor Red
}

# Test email send
Write-Host "📧 Testing email delivery..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "http://localhost:5000/api/email/simulate" `
  -Method POST -Headers @{Authorization="Bearer $($testLogin.token)"} `
  -ContentType "application/json" `
  -Body "{`"to`":`"$($userCheck.user.email)`",`"subject`":`"Test Email`"}"

Write-Host "✅ Verification complete" -ForegroundColor Green
```

---

## 3. Email & Alert Management

### Prerequisites

- **PostgreSQL** running on localhost:5432
- **hMail Server** running on localhost:25 (for email functionality)
- **Backend server** running on http://localhost:5000
- **Environment variables** configured in `backend/.env`

---

### 1. Email Template Management

#### List All Email Templates

**Request:**
```bash
curl -X GET http://localhost:5000/api/admin/email-templates \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response:**
```json
{
  "templates": [
    {
      "id": 1,
      "name": "weather_alert",
      "subject": "Weather Alert: {{severity}} {{hazard_type}} in {{location}}",
      "body": "<p>Dear User,</p><p>There is a {{severity}} {{hazard_type}} alert for {{location}} from {{start_time}} to {{end_time}}.</p><p>Details: {{details}}</p><p>Stay safe,<br/>Aether Team</p>",
      "created_at": "2023-10-01T12:00:00Z",
      "updated_at": "2023-10-01T12:00:00Z"
    }
  ]
}
```

**Notes:**
- Templates use Handlebars syntax for variables (e.g., `{{severity}}`).
- Commonly used variables are: `{{user.name}}`, `{{user.email}}`, `{{alert.details}}`.

---

### 2. Email Sending Limits

#### View Current Limits

**Request:**
```bash
curl -X GET http://localhost:5000/api/admin/email-limits \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response:**
```json
{
  "limits": {
    "max_emails_per_day": 500,
    "max_recipients_per_email": 50,
    "max_email_size_mb": 10
  }
}
```

**Notes:**
- Limits are configurable in `backend/.env`:
  - `EMAIL_MAX_PER_DAY`
  - `EMAIL_MAX_RECIPIENTS`
  - `EMAIL_MAX_SIZE_MB`
- Exceeding limits results in a `429 Too Many Requests` response.

---

### 3. Email Sending

#### Send Test Email

**Request:**
```bash
curl -X POST http://localhost:5000/api/email/simulate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "testuser@aether.com",
    "subject": "Test Email Subject",
    "template": "weather_alert",
    "variables": {
      "severity": "WARNING",
      "hazard_type": "HEAVY_RAIN",
      "location": "Mumbai",
      "start_time": "2025-01-15 14:00",
      "end_time": "2025-01-15 22:00",
      "details": "Heavy rainfall expected. Stay indoors and avoid waterlogged areas."
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Test email sent successfully."
}
```

**Notes:**
- Use valid email addresses for `to` and `from` fields.
- Check spam/junk folders if emails do not appear in inbox.

---

### 4. Alert Subscription Management

#### View All Subscriptions

**Request:**
```bash
curl -X GET http://localhost:5000/api/admin/alert-subscriptions \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response:**
```json
{
  "subscriptions": [
    {
      "id": 1,
      "user_id": 25,
      "email": "testuser@aether.com",
      "alert_type": "weather",
      "subscribed": true,
      "created_at": "2023-10-01T12:00:00Z"
    }
  ]
}
```

**Notes:**
- Subscriptions are linked to user accounts; ensure users have valid email addresses.
- Common alert types: `weather`, `news`, `promotion`.

---

### 5. System Health & Logs

#### Check System Health

**Request:**
```bash
curl -X GET http://localhost:5000/api/admin/health \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response:**
```json
{
  "status": "ok",
  "uptime": 123456,
  "timestamp": "2023-10-01T12:00:00Z"
}
```

**Notes:**
- `uptime` is in seconds.
- Check response time and error rates for monitoring.

---

### 6. Common Email Tasks

**1. Resend Welcome Email:**
```powershell
# Resend welcome email to new users
$newUsers = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users?filter=new" `
  -Headers @{Authorization="Bearer $adminToken"}

foreach ($user in $newUsers.users) {
    Invoke-RestMethod -Uri "http://localhost:5000/api/email/simulate" `
      -Method POST -Headers @{Authorization="Bearer $adminToken"} `
      -ContentType "application/json" `
      -Body "{`"to`":`"$($user.email)`",`"template`":`"welcome_email`"}"
    
    Write-Host "✅ Welcome email resent to $($user.email)" -ForegroundColor Green
    Start-Sleep -Milliseconds 500
}
```

**2. Notify Users of Password Change:**
```powershell
# Notify users via email about password change
$usersToNotify = @(10, 15, 20)

foreach ($userId in $usersToNotify) {
    $user = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users/$userId" `
      -Headers @{Authorization="Bearer $adminToken"}

    Invoke-RestMethod -Uri "http://localhost:5000/api/email/simulate" `
      -Method POST -Headers @{Authorization="Bearer $adminToken"} `
      -ContentType "application/json" `
      -Body "{`"to`":`"$($user.email)`",`"template`":`"password_change_notification`"}"
    
    Write-Host "✅ Notification email sent to $($user.email)" -ForegroundColor Green
    Start-Sleep -Milliseconds 500
}
```

**3. Alert Users of Inactive Account:**
```powershell
# Find and alert users with inactive accounts
$inactiveUsers = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/users?filter=inactive" `
  -Headers @{Authorization="Bearer $adminToken"}

foreach ($user in $inactiveUsers.users) {
    Invoke-RestMethod -Uri "http://localhost:5000/api/email/simulate" `
      -Method POST -Headers @{Authorization="Bearer $adminToken"} `
      -ContentType "application/json" `
      -Body "{`"to`":`"$($user.email)`",`"template`":`"inactive_account_alert`"}"
    
    Write-Host "✅ Inactivity alert sent to $($user.email)" -ForegroundColor Green
    Start-Sleep -Milliseconds 500
}
```

---
