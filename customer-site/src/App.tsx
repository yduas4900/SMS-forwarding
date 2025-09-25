import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import CustomerPage from './pages/CustomerPage';
import './App.css';

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<CustomerPage />} />
            <Route path="/link/:linkId" element={<CustomerPage />} />
            <Route path="/customer/:linkId" element={<CustomerPage />} />
            <Route path="/:linkId" element={<CustomerPage />} />
          </Routes>
        </div>
      </Router>
    </ConfigProvider>
  );
};

export default App;
