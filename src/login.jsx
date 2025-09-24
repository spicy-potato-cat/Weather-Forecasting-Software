// src/login.jsx
import { useState } from "react";

function LoginPage() {
    const [form, setForm] = useState({ email: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState({ loading: false, message: "" });

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
            // Replace with your API endpoint
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error("Invalid credentials");
            setStatus({ loading: false, message: "Logged in successfully." });
            // Navigate or store tokens here
        } catch (err) {
            setStatus({ loading: false, message: err.message || "Login failed" });
        }
    };

    return (
        <div style={styles.container}>
            <form onSubmit={handleSubmit} style={styles.card} noValidate>
                <h1 style={styles.title}>Sign in</h1>

                <label style={styles.label}>
                    Email
                    <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        style={{ ...styles.input, ...(errors.email ? styles.inputError : {}) }}
                        autoComplete="username"
                    />
                    {errors.email && <span style={styles.error}>{errors.email}</span>}
                </label>

                <label style={styles.label}>
                    Password
                    <div style={styles.passwordRow}>
                        <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            value={form.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            style={{ ...styles.input, flex: 1, ...(errors.password ? styles.inputError : {}) }}
                            autoComplete="current-password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            style={styles.toggleBtn}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? "Hide" : "Show"}
                        </button>
                    </div>
                    {errors.password && <span style={styles.error}>{errors.password}</span>}
                </label>

                <button type="submit" style={styles.submit} disabled={status.loading}>
                    {status.loading ? "Signing in..." : "Sign in"}
                </button>

                {status.message && <div style={styles.notice}>{status.message}</div>}

                <div style={styles.footer}>
                    <a href="/forgot" style={styles.link}>Forgot password?</a>
                    <a href="/signup" style={styles.link}>Create account</a>
                </div>
            </form>
        </div>
    );
}

const styles = {
    container: {
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(135deg, #f6f8fc 0%, #eef1f6 100%)",
        padding: 16,
    },
    card: {
        width: "100%",
        maxWidth: 380,
        background: "#fff",
        padding: 24,
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        display: "grid",
        gap: 12,
    },
    title: { margin: 0, fontSize: 24 },
    label: { display: "grid", gap: 6, fontSize: 14 },
    input: {
        padding: "10px 12px",
        border: "1px solid #cfd8e3",
        borderRadius: 8,
        outline: "none",
        fontSize: 14,
    },
    inputError: { borderColor: "#e11d48", background: "#fff1f2" },
    error: { color: "#e11d48", fontSize: 12 },
    passwordRow: { display: "flex", gap: 8, alignItems: "center" },
    toggleBtn: {
        border: "1px solid #cfd8e3",
        background: "#f8fafc",
        padding: "10px 12px",
        borderRadius: 8,
        cursor: "pointer",
    },
    submit: {
        marginTop: 8,
        padding: "12px 14px",
        background: "#2563eb",
        color: "#fff",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        fontWeight: 600,
    },
    notice: {
        marginTop: 4,
        padding: "10px 12px",
        background: "#f1f5f9",
        borderRadius: 8,
        fontSize: 14,
    },
    footer: {
        marginTop: 6,
        display: "flex",
        justifyContent: "space-between",
        fontSize: 14,
    },
    link: { color: "#2563eb", textDecoration: "none" },
};

export default LoginPage;