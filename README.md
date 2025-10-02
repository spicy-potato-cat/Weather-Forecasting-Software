# Weather Forecasting Software

A modern, full-stack weather forecasting application with real-time wind visualization, interactive maps, and user authentication.

## Features

- 🌤️ Real-time weather data from OpenWeather API
- 🌍 Interactive map with live wind particle visualization
- 👤 User authentication (login/signup)
- 📊 Multiple weather layers (wind, temperature, precipitation, clouds)
- 🗺️ Embedded and full-screen map views
- 🎨 Modern glassmorphism UI design

## Tech Stack

### Frontend
- React 19 with Vite
- OpenLayers for map rendering
- React Router for navigation
- CSS3 with glassmorphism effects

### Backend
- Node.js with Express
- PostgreSQL database
- JWT authentication
- bcrypt for password hashing

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- OpenWeather API key (free tier)

### Check if PostgreSQL is running

**Windows:**
```bash
sc query postgresql-x64-14
# or
pg_isready
```

**Linux:**
```bash
sudo systemctl status postgresql
# or
pg_isready
```

**macOS:**
```bash
brew services list | grep postgresql
# or
pg_isready
```

### Start PostgreSQL

**Windows:**
```bash
net start postgresql-x64-14
```

**Linux:**
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql  # Start on boot
```

**macOS:**
```bash
brew services start postgresql
```

## Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd Weather-Forecasting-Software
```

### 2. Frontend Setup
```bash
# Install dependencies
npm install

# Create .env.local file
echo "VITE_OPENWEATHER_API_KEY=your_api_key_here" > .env.local

# Start development server
npm run dev
```

### 3. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Setup database (if postgres user has no password)
psql -U postgres -c "CREATE DATABASE weather_forecast_db;"
psql -U postgres -d weather_forecast_db -f database.sql

# If postgres has a password, use:
# psql -U postgres -W -c "CREATE DATABASE weather_forecast_db;"

# Create .env file from example
cp .env.example .env

# Edit .env file (important: set correct credentials)
# For postgres user with no password, use:
DB_USER=postgres
DB_PASSWORD=

# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copy the output and paste it as JWT_SECRET in .env

# Start backend server
npm run dev
```

## Environment Variables

### Frontend (.env.local)
```env
VITE_OPENWEATHER_API_KEY=your_openweather_api_key
```

### Backend (.env)
```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=weather_forecast_db
DB_USER=postgres
DB_PASSWORD=                      # Leave empty if no password
JWT_SECRET=<generate_secure_random_string>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
OPENWEATHER_API_KEY=your_openweather_api_key
```

**⚠️ Security Notes:**
- Never commit `.env` files to git
- Never expose database credentials in frontend code
- Use strong JWT secrets in production
- Change default postgres user password in production

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/logout` - Sign out

### User
- `GET /api/user/profile` - Get user profile (protected)
- `PUT /api/user/profile` - Update profile (protected)

### Weather
- `GET /api/weather/current?lat=<lat>&lon=<lon>` - Current weather
- `GET /api/weather/forecast?lat=<lat>&lon=<lon>` - Weather forecast

## Usage

1. **Create an account** at `/signup`
2. **Sign in** at `/login`
3. **View dashboard** with embedded weather map at `/`
4. **Explore full map** at `/live-map` with toggleable layers
5. **Pan and zoom** the map to see wind patterns in different regions

## Project Structure

```
Weather-Forecasting-Software/
├── src/                    # Frontend source
│   ├── components/        # React components
│   ├── lib/              # Utility functions
│   ├── liveMap.jsx       # Embedded map component
│   ├── liveMapPage.jsx   # Full-screen map page
│   ├── login.jsx         # Login page
│   ├── signup.jsx        # Signup page
│   └── App.jsx           # Main app component
├── backend/               # Backend source
│   ├── config/           # Database configuration
│   ├── middleware/       # Express middleware
│   ├── routes/           # API routes
│   ├── database.sql      # Database schema
│   └── server.js         # Express server
└── public/               # Static assets
```

## License

MIT

## Contributing

Pull requests are welcome! For major changes, please open an issue first.

## Troubleshooting

### Database Connection Issues

**Error: "role [username] does not exist"**
```bash
# Check existing roles
psql -U postgres -c "\du"

# Use the correct username (usually 'postgres')
```

**Error: "database does not exist"**
```bash
# Create the database
psql -U postgres -c "CREATE DATABASE weather_forecast_db;"
```

**Error: "connection refused"**
- PostgreSQL is not running
- Check and start the service (see above)

**Error: "password authentication failed"**
- Check DB_USER and DB_PASSWORD in .env
- For no password, leave DB_PASSWORD empty
