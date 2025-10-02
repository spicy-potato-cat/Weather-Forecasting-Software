# PostgreSQL Server Check Guide

## Quick Check Commands

### Check if PostgreSQL is Running

**Windows:**
```bash
# Method 1: Service Control
sc query postgresql-x64-14

# Method 2: PostgreSQL utility
pg_isready

# Method 3: Check Services GUI
services.msc
# Look for "postgresql-x64-14" or similar
```

**Linux (Ubuntu/Debian):**
```bash
# Check status
sudo systemctl status postgresql

# Or use pg_isready
pg_isready -U postgres
```

**macOS:**
```bash
# If installed via Homebrew
brew services list | grep postgresql

# Or use pg_isready
pg_isready
```

---

## Start PostgreSQL Server

### Windows

**Method 1: Command Line**
```bash
net start postgresql-x64-14
```

**Method 2: Services GUI**
1. Press `Win + R`
2. Type `services.msc` and press Enter
3. Find "postgresql-x64-14" (or your version)
4. Right-click → Start

**Method 3: PowerShell (as Admin)**
```powershell
Start-Service postgresql-x64-14
```

### Linux

```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Enable auto-start on boot
sudo systemctl enable postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### macOS

```bash
# If installed via Homebrew
brew services start postgresql

# Start manually (doesn't auto-start on boot)
pg_ctl -D /usr/local/var/postgres start
```

---

## Stop PostgreSQL Server

### Windows
```bash
net stop postgresql-x64-14
```

### Linux
```bash
sudo systemctl stop postgresql
```

### macOS
```bash
brew services stop postgresql
# or
pg_ctl -D /usr/local/var/postgres stop
```

---

## Connect to PostgreSQL

### Using psql (Command Line)

**No password (default after fresh install):**
```bash
psql -U postgres
```

**With password:**
```bash
psql -U postgres -W
# You'll be prompted for password
```

**Connect to specific database:**
```bash
psql -U postgres -d weather_forecast_db
```

### Common psql Commands

Once connected:
```sql
-- List all databases
\l

-- List all users/roles
\du

-- Connect to a database
\c weather_forecast_db

-- List tables
\dt

-- Exit
\q
```

---

## Troubleshooting

### "pg_isready: command not found"

Add PostgreSQL bin to PATH:

**Windows:**
```
C:\Program Files\PostgreSQL\14\bin
```

**Linux/macOS:**
```bash
export PATH="/usr/lib/postgresql/14/bin:$PATH"
# Add to ~/.bashrc or ~/.zshrc for permanent
```

### Port 5432 Already in Use

Check what's using the port:

**Windows:**
```bash
netstat -ano | findstr :5432
```

**Linux/macOS:**
```bash
sudo lsof -i :5432
# or
sudo netstat -nlp | grep 5432
```

### Reset postgres User Password

**Windows/Linux/macOS:**
```bash
# As superuser, connect to postgres
sudo -u postgres psql

# In psql console:
ALTER USER postgres PASSWORD 'new_password';
\q
```

---

## Create Database and User (Production Setup)

```bash
# Connect as postgres
psql -U postgres

# In psql:
CREATE DATABASE weather_forecast_db;
CREATE USER weather_app WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE weather_forecast_db TO weather_app;
\q
```

Update `.env`:
```env
DB_USER=weather_app
DB_PASSWORD=secure_password_here
```
