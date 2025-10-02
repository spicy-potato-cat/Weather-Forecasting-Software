// src/login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import './login.css';

function LoginPage() {
    const [form, setForm] = useState({ email: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState({ loading: false, message: "" });
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
    };

    const handleSubmit = async (ev) => {
        ev.preventDefault();
        if (!validate()) return;
        setStatus({ loading: true, message: "" });
        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error("Invalid credentials");
            
            // Store auth token (in a real app, get this from response)
            const mockToken = 'mock_auth_token_' + Date.now();
            localStorage.setItem('authToken', mockToken);
            localStorage.setItem('user', JSON.stringify({ email: form.email }));
            
            setStatus({ loading: false, message: "Logged in successfully." });
            
            // Redirect to home after 1 second
            setTimeout(() => {
                navigate('/');
            }, 1000);
        } catch (err) {
            setStatus({ loading: false, message: err.message || "Login failed" });
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
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            className="login-toggle-btn"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? "Hide" : "Show"}
                        </button>
                    </div>
                    {errors.password && <span className="login-error">{errors.password}</span>}
                </label>

                <button type="submit" className="login-submit" disabled={status.loading}>
                    {status.loading ? "Signing in..." : "Sign in"}
                </button>

                {status.message && <div className="login-notice">{status.message}</div>}

                <div className="login-footer">
                    <a href="/forgot" className="login-link">Forgot password?</a>
                    <a href="/signup" className="login-link">Create account</a>
                </div>
            </form>
        </div>
    );
}

export default LoginPage;