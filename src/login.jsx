// src/login.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import './login.css';

function LoginPage() {
    const [form, setForm] = useState({ email: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState({ loading: false, message: "", type: "" });
    const navigate = useNavigate();

    const validate = () => {
        const e = {};
        if (!form.email.trim()) e.email = "Email is required";
        else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Invalid email";
        if (!form.password) e.password = "Password is required";
        else if (form.password.length < 6) e.password = "Min 6 characters";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleChange = (ev) => {
        const { name, value } = ev.target;
        setForm((f) => ({ ...f, [name]: value }));
        if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
        // Clear status message when user starts typing
        if (status.message) setStatus({ loading: false, message: "", type: "" });
    };

    const handleSubmit = async (ev) => {
        ev.preventDefault();
        
        // Client-side validation
        if (!validate()) return;
        
        setStatus({ loading: true, message: "Signing in...", type: "info" });
        
        try {
            console.log('Attempting login for:', form.email);
            
            // Connect to backend API
            const res = await fetch("http://localhost:5000/api/auth/login", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    email: form.email.trim(),
                    password: form.password
                }),
            });
            
            const data = await res.json();
            console.log('Login response:', data);
            
            // Check if request was successful
            if (!res.ok || !data.success) {
                throw new Error(data.message || "Login failed. Please check your credentials.");
            }
            
            // Verify we received a token
            if (!data.token) {
                throw new Error("Authentication failed. No token received.");
            }
            
            // Store auth token from backend response
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            console.log('Login successful, token stored');
            
            setStatus({ 
                loading: false, 
                message: "Login successful! Redirecting...", 
                type: "success" 
            });
            
            // Trigger storage event for navbar
            window.dispatchEvent(new Event('storage'));
            
            // Redirect to home after 1 second
            setTimeout(() => {
                navigate('/');
            }, 1000);
            
        } catch (err) {
            console.error('Login error:', err);
            setStatus({ 
                loading: false, 
                message: err.message || "Login failed. Please try again.", 
                type: "error" 
            });
        }
    };

    return (
        <div className="login-container">
            <form onSubmit={handleSubmit} className="login-card" noValidate>
                <h1 className="login-title">Sign in</h1>

                <label className="login-label">
                    <span className="login-label-text">Email</span>
                    <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        className={`login-input ${errors.email ? 'login-input-error' : ''}`}
                        autoComplete="username"
                        disabled={status.loading}
                    />
                    {errors.email && <span className="login-error">{errors.email}</span>}
                </label>

                <label className="login-label">
                    <span className="login-label-text">Password</span>
                    <div className="login-password-row">
                        <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            value={form.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            className={`login-input ${errors.password ? 'login-input-error' : ''}`}
                            style={{ flex: 1 }}
                            autoComplete="current-password"
                            disabled={status.loading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            className="login-toggle-btn"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            disabled={status.loading}
                        >
                            {showPassword ? "Hide" : "Show"}
                        </button>
                    </div>
                    {errors.password && <span className="login-error">{errors.password}</span>}
                </label>

                <button type="submit" className="login-submit" disabled={status.loading}>
                    {status.loading ? "Signing in..." : "Sign in"}
                </button>

                {status.message && (
                    <div className={`login-notice ${status.type === 'success' ? 'login-notice-success' : status.type === 'error' ? 'login-notice-error' : ''}`}>
                        {status.message}
                    </div>
                )}

                <div className="login-footer">
                    <a href="/forgot" className="login-link">Forgot password?</a>
                    <Link to="/signup" className="login-link">Create account</Link>
                </div>
            </form>
        </div>
    );
}

export default LoginPage;