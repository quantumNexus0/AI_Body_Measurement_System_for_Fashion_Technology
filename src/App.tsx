import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import MeasurementCapture from './components/MeasurementCapture';
import Results from './components/Results';
import './index.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-teal-50 selection:bg-teal-200 selection:text-teal-900">
        <Header />
        <main className="container mx-auto px-4 py-6 sm:py-10 lg:py-12">
          <Routes>
            <Route path="/" element={<MeasurementCapture />} />
            <Route path="/results" element={<Results />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;