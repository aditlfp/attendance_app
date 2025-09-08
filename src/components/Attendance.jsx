import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { storage, db } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { detectFaces } from '../services/faceDetection';

function Attendance() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();

  useEffect(() => {
    // Initialize camera
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 } 
        });
        setStream(stream);
        videoRef.current.srcObject = stream;
      } catch (err) {
        console.error('Camera error:', err);
      }
    };

    // Get location (low accuracy for battery saving)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
      },
      (err) => console.error('Location error:', err),
      { enableHighAccuracy: false, timeout: 10000 }
    );

    initCamera();

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const captureAttendance = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setLoading(true);
    const ctx = canvasRef.current.getContext('2d');
    
    try {
      // Detect faces
      const predictions = await detectFaces(videoRef.current);
      
      if (predictions.length === 0) {
        alert('No face detected!');
        return;
      }

      // Capture only face region (saves storage)
      const face = predictions[0];
      const startX = Math.max(0, face.topLeft[0] - 20);
      const startY = Math.max(0, face.topLeft[1] - 20);
      const width = face.bottomRight[0] - face.topLeft[0] + 40;
      const height = face.bottomRight[1] - face.topLeft[1] + 40;
      
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      ctx.drawImage(
        videoRef.current,
        startX, startY, width, height,
        0, 0, width, height
      );

      // Compress image before upload
      canvasRef.current.toBlob(async (blob) => {
        try {
          // Upload to Firebase Storage
          const storageRef = ref(
            storage, 
            `attendance/${currentUser.uid}/${Date.now()}.jpg`
          );
          await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
          const imageUrl = await getDownloadURL(storageRef);

          // Save minimal data to Firestore
          await addDoc(collection(db, 'attendance'), {
            userId: currentUser.uid,
            timestamp: new Date().toISOString(),
            location: {
              lat: location.lat,
              lng: location.lng,
              accuracy: location.accuracy
            },
            imageUrl, // Store reference instead of full image
            faceCount: predictions.length
          });

          alert('Attendance recorded successfully!');
        } catch (error) {
          console.error('Firebase error:', error);
          alert('Failed to record attendance');
        } finally {
          setLoading(false);
        }
      }, 'image/jpeg', 0.7); // 70% quality compression
    } catch (error) {
      console.error('Detection error:', error);
      alert('Failed to detect faces');
      setLoading(false);
    }
  };

  return (
    <div className="attendance-container">
      <h2>Mark Attendance</h2>
      
      <div className="camera-container">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          width="640" 
          height="480"
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      <div className="location-info">
        <h3>Location:</h3>
        {location ? (
          <p>
            Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
            <br />
            Accuracy: ±{Math.round(location.accuracy)}m
          </p>
        ) : (
          <p>Getting location...</p>
        )}
      </div>

      <button 
        onClick={captureAttendance} 
        disabled={loading}
        className="capture-btn"
      >
        {loading ? 'Processing...' : 'Mark Attendance'}
      </button>
    </div>
  );
}

export default Attendance;