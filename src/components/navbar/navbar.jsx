import React, { useState } from "react";
import PropTypes from "prop-types";
import Logo from '/Logo.svg'
import "./NavBar.css";


// src/components/NavBar.jsx

/**
 * Navigation Bar
 */
export default function NavBar({ title = "Weather Forecasting", onSearch, onMenuToggle }) {
    const [query, setQuery] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        if (onSearch) onSearch(query.trim());
    };

    return (
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

                <button
                    className="menu-btn"
                    aria-label="Open navigation menu"
                    onClick={() => onMenuToggle && onMenuToggle()}
                >
                    <span className="menu-icon" aria-hidden="true">&#9776;</span>
                </button>
            </div>
        </nav>
    );
}

NavBar.propTypes = {
    title: PropTypes.string,
    onSearch: PropTypes.func,
    onMenuToggle: PropTypes.func,
};