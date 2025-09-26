import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'antd/dist/reset.css';
import './App.css';

import CustomerPage from './pages/CustomerPage';

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <Router basename="/customer">
        <div className="App">
          <Routes>
            <Route path="/:linkId" element={<CustomerPage />} />
            <Route path="/" element={<CustomerPage />} />
          </Routes>
        </div>
      </Router>
    </ConfigProvider>
  );
};

export default App;
