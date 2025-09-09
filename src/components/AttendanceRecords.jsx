import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

function AttendanceRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const q = query(
          collection(db, 'attendance'),
          where('userId', '==', currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        const recordsData = [];
        querySnapshot.forEach((doc) => {
          recordsData.push({ id: doc.id, ...doc.data() });
        });
        setRecords(recordsData);
      } catch (error) {
        console.error('Error fetching records:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [currentUser]);

  if (loading) return <div>Loading records...</div>;

  return (
    <div className="records-container">
      <h3>Your Attendance Records</h3>
      {records.length === 0 ? (
        <p>No attendance records found.</p>
      ) : (
        <div className="records-grid">
          {records.map((record) => (
            <div key={record.id} className="record-card">
              <img 
                src={record.faceImage} 
                alt="Attendance" 
                style={{ 
                  width: '100px', 
                  height: '100px', 
                  objectFit: 'cover',
                  borderRadius: '4px'
                }} 
              />
              <div className="record-details">
                <p><strong>Date:</strong> {new Date(record.timestamp).toLocaleString()}</p>
                <p><strong>Location:</strong> {record.location.lat.toFixed(4)}, {record.location.lng.toFixed(4)}</p>
                <p><strong>Accuracy:</strong> ±{Math.round(record.location.accuracy)}m</p>
                <p><strong>Image Size:</strong> {(record.imageSize / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AttendanceRecords;