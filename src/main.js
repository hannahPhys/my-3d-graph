import React, { useState } from 'react';
import Header from './header';
import App from './app';

const Main = () => {
    const [APIResponse, setAPIResponse] = useState('');
  
    const handleSearch = (text) => {
      setAPIResponse(text);
    };
  
    return (
      <>
        <Header onSearch={handleSearch} />
        <App APIResponse={APIResponse}/>
      </>
  );
};

export default Main;
