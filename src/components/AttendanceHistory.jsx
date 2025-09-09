import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

function AttendanceHistory() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true);
        const q = query(
          collection(db, 'attendance'),
          where('userId', '==', currentUser.uid),
          orderBy('timestamp', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const recordsData = [];
        querySnapshot.forEach((doc) => {
          recordsData.push({ id: doc.id, ...doc.data() });
        });
        setRecords(recordsData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching records:', err);
        setError('Failed to load attendance records.');
        setLoading(false);
      }
    };

    fetchRecords();
  }, [currentUser, db]);

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatLocation = (location) => {
    if (!location) return 'N/A';
    return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
  };

  if (loading) {
    return <div className="loading">Loading attendance records...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (records.length === 0) {
    return <div className="no-records">No attendance records found.</div>;
  }

  return (
    <div className="attendance-history">
      <h2>Attendance History</h2>
      <div className="records-container">
        {records.map((record) => (
          <div key={record.id} className="record-card">
            <div className="record-header">
              <span className="record-date">{formatDate(record.timestamp)}</span>
              <span className="record-similarity">
                Similarity: {(record.similarity * 100).toFixed(1)}%
              </span>
            </div>
            <div className="record-content">
              <div className="record-image">
                <img 
                  src={record.faceImage} 
                  alt="Attendance" 
                />
              </div>
              <div className="record-details">
                <div className="detail-row">
                  <span className="detail-label">Location:</span>
                  <span className="detail-value">{formatLocation(record.location)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Accuracy:</span>
                  <span className="detail-value">
                    ±{Math.round(record.location.accuracy)}m
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Image Size:</span>
                  <span className="detail-value">
                    {(record.imageSize / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AttendanceHistory;