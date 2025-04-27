import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="home">
      <h1>Utility Tools</h1>
      <div className="tools-list">
        <div className="tool-card">
          <h2>QR Code Generator</h2>
          <p>Generate QR codes from text input</p>
          <Link to="/qr-generator" className="tool-link">
            Open QR Generator
          </Link>
        </div>
        {/* More tools can be added here in the future */}
      </div>
    </div>
  );
};

export default Home;
