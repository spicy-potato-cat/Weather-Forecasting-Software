import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import Logo from '/cloud-white-icon.png';
import "./NavBar.css";


/**
 * Navigation Bar
 */
export default function NavBar({ title = "Aether", onSearch }) {
    const [query, setQuery] = useState("");
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const menuRef = useRef(null);
    const navigate = useNavigate();

    // Check if user is logged in (check localStorage, sessionStorage, or auth token)
    useEffect(() => {
        // Check for auth token or user session
        const checkAuthStatus = () => {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const user = localStorage.getItem('user');
            setIsLoggedIn(!!(token || user));
        };
        
        checkAuthStatus();
        
        // Listen for auth changes (e.g., from login page)
        window.addEventListener('storage', checkAuthStatus);
        return () => window.removeEventListener('storage', checkAuthStatus);
    }, []);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };

        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (onSearch) onSearch(query.trim());
    };

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const handleProfileClick = () => {
        setIsMenuOpen(false);
        if (isLoggedIn) {
            navigate('/profile');
        } else {
            navigate('/login');
        }
    };

    const handleLogout = () => {
        // Clear auth data
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        sessionStorage.removeItem('authToken');
        setIsLoggedIn(false);
        setIsMenuOpen(false);
        navigate('/');
    };

    return (
        <div>
            <>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=Mozilla+Headline:wght@200..700&display=swap" rel="stylesheet" />
            </>
            <nav className="navbar">
                <div className="navbar-left">
                    <img src={Logo} alt="Logo" className="site-logo" />
                    <span className="site-title">{title}</span>
                </div>

                <div className="navbar-right">
                    <form className="search-section" onSubmit={handleSubmit}>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search for a location..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            aria-label="Search location"
                        />
                        <button type="submit" className="search-btn">Search</button>
                    </form>

                    <div className="menu-container" ref={menuRef}>
                        <button
                            className="menu-btn"
                            aria-label="Open navigation menu"
                            onClick={toggleMenu}
                        >
                            <span className="menu-icon" aria-hidden="true">&#9776;</span>
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                            <div className="menu-dropdown">
                                <div className="menu-header">
                                    <span className="menu-title">Menu</span>
                                </div>
                                
                                <div className="menu-items">
                                    <button 
                                        className="menu-item"
                                        onClick={handleProfileClick}
                                    >
                                        <span className="menu-item-icon">
                                            {isLoggedIn ? '👤' : '👤'}
                                        </span>
                                        <span className="menu-item-text">
                                            {isLoggedIn ? 'My Profile' : 'Login'}
                                        </span>
                                    </button>

                                    {isLoggedIn && (
                                        <>
                                            <button 
                                                className="menu-item"
                                                onClick={() => {
                                                    setIsMenuOpen(false);
                                                    navigate('/settings');
                                                }}
                                            >
                                                <span className="menu-item-icon">⚙️</span>
                                                <span className="menu-item-text">Settings</span>
                                            </button>

                                            <div className="menu-divider"></div>

                                            <button 
                                                className="menu-item menu-item-danger"
                                                onClick={handleLogout}
                                            >
                                                <span className="menu-item-icon">🚪</span>
                                                <span className="menu-item-text">Logout</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </nav>
        </div>
    );
}

NavBar.propTypes = {
    title: PropTypes.string,
    onSearch: PropTypes.func,
};