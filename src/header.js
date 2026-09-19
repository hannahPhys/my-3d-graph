import React, { useState } from 'react'
import './header.css';
import icon from './utilities/icon.png'

const ASK_URL = process.env.NODE_ENV === 'production' ? '/api/ask' : 'http://127.0.0.1:5000/chatbot';

const Header = ({ onSearch }) => {
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (event) => {
        setIsSearching(true);
        // Prevents the default form submission behavior
        event.preventDefault();

        const input_text = event.target.elements.search.value;
        console.log('ask chatbox api: ', input_text)
        try {
            const response = await fetch(ASK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ input_text }),
            });

            if (!response.ok) {
                setIsSearching(false);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('received chatbox api response: ', data)
            onSearch(data); //send results to parent so app can select node
            setIsSearching(false);

        } catch (error) {
            console.error("Fetching error:", error);
            setIsSearching(false);
        }
    };


    return (
        <form className="header" onSubmit={handleSearch}>
            <input
                type="search"
                placeholder="Ask..."
                className="search-input"
                name="search"
            />
           <img className={`search-icon ${isSearching ? 'spin' : ''}`} src={icon} alt='quantum icon' width='30px'></img>
        </form>
    );
};

export default Header;
