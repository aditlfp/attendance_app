import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, getDoc, doc, query, where, orderBy, limit, getDocs } from 'firebase/firestore'; // Added getDocs here
import { detectFaces, isFaceDetectionSupported } from '../services/faceDetection';
import { getFaceFeatures, compareAgainstTemplates, restoreTemplates } from '../services/faceRecognition';
import spamDetection from '../services/spamDetection';

function Attendance() {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [faceDetectionSupported, setFaceDetectionSupported] = useState(true);
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [lastAttendanceTime, setLastAttendanceTime] = useState(null);
  const { currentUser } = useAuth();

  const setCanvasDimensions = () => {
    if (overlayRef.current && videoRef.current) {
      const container = overlayRef.current.parentElement;
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      overlayRef.current.width = width;
      overlayRef.current.height = height;
    }
  };

  useEffect(() => {
    const initCamera = async () => {
      try {
        setError('');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          } 
        });
        setStream(stream);
        setCameraReady(true);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          videoRef.current.onloadedmetadata = () => {
            setCanvasDimensions();
            
            const detectLoop = async () => {
              if (videoRef.current && overlayRef.current && videoRef.current.readyState === 4) {
                try {
                  await detectFaces(videoRef.current, true, overlayRef.current);
                } catch (err) {
                  console.error('Face detection error:', err);
                  // Don't show this error to user as it might be temporary
                }
              }
              requestAnimationFrame(detectLoop);
            };
            detectLoop();
          };
        }
      } catch (err) {
        console.error('Camera error:', err);
        setError('Failed to access camera. Please ensure you have granted camera permissions.');
        setCameraReady(false);
      }
    };

    const checkFaceDetectionSupport = async () => {
      const supported = await isFaceDetectionSupported();
      setFaceDetectionSupported(supported);
      if (!supported) {
        setError('Your browser has limited face detection support. Accuracy may be reduced.');
      }
    };

    const loadModel = async () => {
      try {
        // Model is loaded lazily in detectFaces
        setModelLoading(false);
      } catch (err) {
        console.error('Error loading face recognition model:', err);
        setError('Failed to load face recognition model. Please refresh the page.');
      }
    };

    // Check for recent attendance
    const checkRecentAttendance = async () => {
      try {
        const attendanceRef = collection(db, 'attendance');
        const q = query(
          attendanceRef,
          where('userId', '==', currentUser.uid),
          orderBy('timestamp', 'desc'),
          limit(1)
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const lastDoc = querySnapshot.docs[0];
          const lastTime = new Date(lastDoc.data().timestamp);
          setLastAttendanceTime(lastTime);
          
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          if (lastTime > fiveMinutesAgo) {
            setError('You have already marked attendance within the last 5 minutes. Please wait before trying again.');
          }
        }
      } catch (err) {
        console.error('Error checking recent attendance:', err);
      }
    };

    // Update remaining attempts
    const updateRemainingAttempts = () => {
      setRemainingAttempts(spamDetection.getRemainingAttempts(currentUser.uid));
    };

    window.addEventListener('resize', setCanvasDimensions);
    
    updateRemainingAttempts();
    
    const interval = setInterval(updateRemainingAttempts, 1000);
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
      },
      (err) => {
        console.error('Location error:', err);
        setError('Failed to get location. Please ensure location services are enabled.');
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );

    checkFaceDetectionSupport();
    initCamera();
    loadModel();
    checkRecentAttendance();

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', setCanvasDimensions);
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const captureAttendance = async () => {
    if (!cameraReady || !videoRef.current || !captureCanvasRef.current || modelLoading) {
      setError(modelLoading ? 'Face detection system is still loading...' : 'Camera is not ready. Please wait...');
      return;
    }
    
    // Check for spam
    const spamCheck = spamDetection.checkForSpam(currentUser.uid, 'attendance');
    if (spamCheck.isSpam) {
      setError(spamCheck.reason);
      return;
    }
    
    // Check if last attendance was within 5 minutes
    if (lastAttendanceTime) {
      const fiveMinutesAgo = new Date(Date.now() - 1 * 60 * 1000);
      // if (lastAttendanceTime > fiveMinutesAgo) {
      //   setError('You have already marked attendance within the last 5 minutes. Please wait before trying again.');
      //   return;
      // }
    }
    
    setLoading(true);
    setError('');
    setProgress('Checking enrollment status...');
    const ctx = captureCanvasRef.current.getContext('2d');
    
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!userDoc.exists() || !userDoc.data().faceTemplates) {
        setError('You need to enroll your face first. Please go to the Enrollment page.');
        return;
      }

      setProgress('Detecting face...');
      let predictions;
      try {
        predictions = await detectFaces(videoRef.current);
      } catch (detectError) {
        console.error('Face detection error:', detectError);
        setError('Face detection failed. Please try again.');
        return;
      }
      
      if (predictions.length === 0) {
        setError('No face detected. Please position your face in the circle.');
        return;
      }
      if (predictions.length > 1) {
        setError('Multiple faces detected. Please ensure only your face is visible.');
        return;
      }

      setProgress('Extracting facial features...');
      const currentFeatures = await getFaceFeatures(videoRef.current);
      // console.log('Current Features (Attendance):', currentFeatures ? currentFeatures.slice(0, 10) : 'null', 'Length:', currentFeatures ? currentFeatures.length : 0);
      // Handle specific error cases
      if (currentFeatures && currentFeatures.error === 'TOO_DARK') {
        setError('Failed to extract facial features. Please try again with better lighting.');
        return;
      }
      
      if (currentFeatures && currentFeatures.error === 'POOR_POSITION') {
        setError('Face features could not be extracted. Please ensure your face is clearly visible and well-positioned in the circle.');
        return;
      }
      
      if (!currentFeatures || currentFeatures.length === 0) {
        // Generic error for other cases
        setError('Face verification failed. Please ensure your face is clearly visible and try again.');
        return;
      }

      
        setProgress('Verifying identity...');
        const flattenedTemplates = userDoc.data().faceTemplates;
        const storedTemplates = restoreTemplates(flattenedTemplates); // gives Float32Array[]

        const compareResult = compareAgainstTemplates(currentFeatures, storedTemplates, 0.6 /* threshold */);
        let similarity = compareResult.maxSimilarity ?? 0;
        let bestIndex = compareResult.bestIndex ?? -1;

        console.log('compareResult', compareResult);

        // Choose a reasonable required similarity (tune later). Using threshold 0.6 (common).
        const requiredSimilarity = 0.6; // you may increase to 0.65 or 0.7 if false-positives occur

        if (similarity < requiredSimilarity) {
          setError(`Face verification failed. No matching face found. (Similarity: ${(similarity*100).toFixed(1)}%)`);
          return;
        }

      setProgress('Capturing image...');
      const face = predictions[0];
      const topLeft = face.topLeft || [100, 100];
      const bottomRight = face.bottomRight || [300, 300];
      const startX = Math.max(0, topLeft[0] - 20);
      const startY = Math.max(0, topLeft[1] - 20);
      const width = bottomRight[0] - topLeft[0] + 40;
      const height = bottomRight[1] - topLeft[1] + 40;
      
      captureCanvasRef.current.width = width;
      captureCanvasRef.current.height = height;
      ctx.drawImage(
        videoRef.current,
        startX, startY, width, height,
        0, 0, width, height
      );
      const base64Image = captureCanvasRef.current.toDataURL('image/jpeg', 0.7);
      const sizeInBytes = Math.round((base64Image.length * 3) / 4);
      if (sizeInBytes > 900000) {
        setError('Image too large. Please try again with better lighting.');
        return;
      }

      setProgress('Saving attendance record...');
      await addDoc(collection(db, 'attendance'), {
        userId: currentUser.uid,
        timestamp: new Date().toISOString(),
        location: {
          lat: location.lat,
          lng: location.lng,
          accuracy: location.accuracy
        },
        faceImage: base64Image,
        faceCount: predictions.length,
        imageSize: sizeInBytes,
        similarity: similarity
      });

      setLastAttendanceTime(new Date());
      setProgress('');
      alert(`Attendance recorded successfully! (Face similarity: ${(similarity * 100).toFixed(1)}%)`);
    } catch (firebaseError) {
      console.error('Firebase error:', firebaseError);
      setError(`Failed to save attendance: ${firebaseError.message}`);
    } finally {
      setLoading(false);
      if (!error) setProgress('');
    }
  };

  return (
    <div className="attendance-container">
      <h2>Mark Attendance</h2>
      
      {!faceDetectionSupported && (
        <div className="warning-message">
          Your browser has limited face detection support. Accuracy may be reduced.
        </div>
      )}
      
      {modelLoading && (
        <div className="progress-message">
          Loading face detection system...
        </div>
      )}
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {progress && (
        <div className="progress-message">
          {progress}
        </div>
      )}
      
      <div className="attempts-info">
        <p>Remaining attempts: {remainingAttempts}</p>
      </div>
      
      <div className="camera-container">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
        />
        <canvas 
          ref={overlayRef} 
          className="face-overlay"
        />
        <div className="face-guide"></div>
      </div>
      <canvas 
        ref={captureCanvasRef} 
        style={{ display: 'none' }}
      />
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
        disabled={loading || !cameraReady || !location || modelLoading || remainingAttempts === 0}
        className="capture-btn"
      >
        {loading ? 'Processing...' : 'Mark Attendance'}
      </button>
    </div>
  );
}

export default Attendance;
