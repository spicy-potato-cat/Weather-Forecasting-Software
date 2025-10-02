import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import './login.css';

function SignupPage() {
    const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState({ loading: false, message: "", type: "" });
    const navigate = useNavigate();

    const validate = () => {
        const e = {};
        
        if (!form.name.trim()) {
            e.name = "Name is required";
        } else if (form.name.trim().length < 2) {
            e.name = "Name must be at least 2 characters";
        }
        
        if (!form.email.trim()) {
            e.email = "Email is required";
        } else if (!/^\S+@\S+\.\S+$/.test(form.email)) {
            e.email = "Invalid email format";
        }
        
        if (!form.password) {
            e.password = "Password is required";
        } else if (form.password.length < 6) {
            e.password = "Password must be at least 6 characters";
        }
        
        if (!form.confirmPassword) {
            e.confirmPassword = "Please confirm your password";
        } else if (form.password !== form.confirmPassword) {
            e.confirmPassword = "Passwords do not match";
        }
        
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleChange = (ev) => {
        const { name, value } = ev.target;
        setForm((f) => ({ ...f, [name]: value }));
        if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
        if (status.message) setStatus({ loading: false, message: "", type: "" });
    };

    const handleSubmit = async (ev) => {
        ev.preventDefault();
        
        if (!validate()) return;
        
        setStatus({ loading: true, message: "Creating account...", type: "info" });
        
        try {
            console.log('Attempting registration for:', form.email);
            
            const res = await fetch("http://localhost:5000/api/auth/register", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    name: form.name.trim(),
                    email: form.email.trim(),
                    password: form.password
                }),
            });
            
            const data = await res.json();
            console.log('Registration response:', data);
            
            if (!res.ok || !data.success) {
                throw new Error(data.message || "Registration failed. Please try again.");
            }
            
            if (!data.token) {
                throw new Error("Registration failed. No token received.");
            }
            
            // Store auth token
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            console.log('Registration successful');
            
            setStatus({ 
                loading: false, 
                message: "Account created successfully! Redirecting...", 
                type: "success" 
            });
            
            // Trigger storage event
            window.dispatchEvent(new Event('storage'));
            
            setTimeout(() => {
                navigate('/');
            }, 1000);
            
        } catch (err) {
            console.error('Registration error:', err);
            setStatus({ 
                loading: false, 
                message: err.message || "Registration failed. Please try again.", 
                type: "error" 
            });
        }
    };

    return (
        <div className="login-container">
            <form onSubmit={handleSubmit} className="login-card" noValidate>
                <h1 className="login-title">Create Account</h1>

                <label className="login-label">
                    <span className="login-label-text">Name</span>
                    <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="John Doe"
                        className={`login-input ${errors.name ? 'login-input-error' : ''}`}
                        autoComplete="name"
                        disabled={status.loading}
                    />
                    {errors.name && <span className="login-error">{errors.name}</span>}
                </label>

                <label className="login-label">
                    <span className="login-label-text">Email</span>
                    <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        className={`login-input ${errors.email ? 'login-input-error' : ''}`}
                        autoComplete="email"
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
                            autoComplete="new-password"
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

                <label className="login-label">
                    <span className="login-label-text">Confirm Password</span>
                    <div className="login-password-row">
                        <input
                            type={showConfirmPassword ? "text" : "password"}
                            name="confirmPassword"
                            value={form.confirmPassword}
                            onChange={handleChange}
                            placeholder="••••••••"
                            className={`login-input ${errors.confirmPassword ? 'login-input-error' : ''}`}
                            style={{ flex: 1 }}
                            autoComplete="new-password"
                            disabled={status.loading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword((s) => !s)}
                            className="login-toggle-btn"
                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                            disabled={status.loading}
                        >
                            {showConfirmPassword ? "Hide" : "Show"}
                        </button>
                    </div>
                    {errors.confirmPassword && <span className="login-error">{errors.confirmPassword}</span>}
                </label>

                <button 
                    type="submit" 
                    className="login-submit signup-submit" 
                    disabled={status.loading}
                >
                    {status.loading ? "Creating account..." : "Create Account"}
                </button>

                {status.message && (
                    <div className={`login-notice ${status.type === 'success' ? 'login-notice-success' : status.type === 'error' ? 'login-notice-error' : ''}`}>
                        {status.message}
                    </div>
                )}

                <div className="login-footer" style={{ justifyContent: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#c9f5e8' }}>Already have an account?</span>
                    <Link to="/login" className="login-link">Sign in</Link>
                </div>
            </form>
        </div>
    );
}

export default SignupPage;
