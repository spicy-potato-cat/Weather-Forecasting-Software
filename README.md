# Weather Forecasting Software - Backend API

Backend server for the Weather Forecasting Software application.

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn

## Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your configuration:
   - Database credentials
   - JWT secret
   - OpenWeather API key
   - etc.

## Database Setup

Create a PostgreSQL database and update the connection details in `.env`:

```sql
CREATE DATABASE weather_forecast_db;
```

## Running the Server

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

The server will start on `http://localhost:5000` (or the port specified in `.env`).

## API Endpoints

### Health Check
- `GET /api/health` - Server health status

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### User
- `GET /api/user/profile` - Get user profile (protected)
- `PUT /api/user/profile` - Update user profile (protected)

### Weather
- `GET /api/weather/current?lat=<lat>&lon=<lon>` - Get current weather
- `GET /api/weather/forecast?lat=<lat>&lon=<lon>` - Get weather forecast

## Project Structure

```
backend/
├── config/
│   └── database.js       # Database configuration
├── middleware/
│   ├── auth.js          # Authentication middleware
│   └── errorHandler.js  # Global error handler
├── routes/
│   ├── auth.js          # Authentication routes
│   ├── user.js          # User routes
│   └── weather.js       # Weather routes
├── .env.example         # Environment variables template
├── .gitignore          # Git ignore file
├── package.json        # Dependencies and scripts
├── README.md          # This file
└── server.js          # Main server file
```

## Environment Variables

See `.env.example` for all required environment variables.
