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
Invoke-RestMethod -Uri "http://localhost:5000/api/email/simulate" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body '{"to":"newtest@aether.com","subject":"Weather Alert: Heavy Rain Warning","template":"weather_alert","variables":{"severity":"WARNING","hazard_type":"HEAVY_RAIN","location":"Mumbai","start_time":"2025-01-15 14:00","end_time":"2025-01-15 22:00","details":"Heavy rainfall expected. Stay indoors and avoid waterlogged areas."}}'
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
