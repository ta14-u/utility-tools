import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import "./App.css";
import Home from './pages/Home';
import QRCodeGenerator from './pages/QRCodeGenerator';

function App() {
  return (
    <Router basename="/utility-tools">
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/qr-generator" element={<QRCodeGenerator />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
