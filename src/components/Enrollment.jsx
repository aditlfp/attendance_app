import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { detectFaces } from '../services/faceDetection';
import { getFaceFeatures, flattenTemplates } from '../services/faceRecognition';
import spamDetection from '../services/spamDetection';
import { useNavigate } from 'react-router-dom';

function Enrollment() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const navigate = useNavigate();
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [samples, setSamples] = useState([]);
  const [currentSample, setCurrentSample] = useState(0);
  const [instructions, setInstructions] = useState('Look straight at the camera');
  const [cameraReady, setCameraReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const { currentUser } = useAuth();

  const SAMPLES_REQUIRED = 5;
  const sampleInstructions = [
    'Look straight at the camera',
    'Turn your face slightly to the left',
    'Turn your face slightly to the right',
    'Tilt your head up slightly',
    'Tilt your head down slightly'
  ];

  useEffect(() => {
    const checkEnrollment = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists() && userDoc.data().faceTemplates) {
          setEnrolled(true);
        }
      } catch (err) {
        console.error('Error checking enrollment:', err);
      }
    };

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

    const loadModel = async () => {
      try {
        const { loadModel } = await import('../services/faceRecognition');
        await loadModel();
        setModelLoading(false);
      } catch (err) {
        setModelLoading(false);
        console.error('Error loading face recognition model:', err);
        setError('Failed to load face recognition model. Please refresh the page.');
      }
    };

    // Update remaining attempts
    const updateRemainingAttempts = () => {
      setRemainingAttempts(spamDetection.getRemainingAttempts(currentUser.uid));
    };

    window.addEventListener('resize', setCanvasDimensions);
    
    // Initial update
    updateRemainingAttempts();
    
    // Update remaining attempts every second
    const interval = setInterval(updateRemainingAttempts, 1000);
    
    checkEnrollment();
    initCamera();
    loadModel();

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', setCanvasDimensions);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [currentUser, db]);

  const setCanvasDimensions = () => {
    if (overlayRef.current && videoRef.current) {
      const container = overlayRef.current.parentElement;
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      overlayRef.current.width = width;
      overlayRef.current.height = height;
    }
  };

const captureSample = async () => {
  if (!cameraReady || !videoRef.current || modelLoading) {
    setError(modelLoading ? 'Face recognition model is still loading...' : 'Camera is not ready. Please wait...');
    return;
  }

  const spamCheck = spamDetection.checkForSpam(currentUser.uid, 'enrollment');
  if (spamCheck.isSpam) { setError(spamCheck.reason); return; }

  setLoading(true);
  setError('');
  setProgress(`Capturing sample ${currentSample + 1} of ${SAMPLES_REQUIRED}...`);

  try {
    const predictions = await detectFaces(videoRef.current);
    if (!predictions || predictions.length === 0) { setError('No face detected.'); return; }
    if (predictions.length > 1) { setError('Multiple faces detected.'); return; }

    const descriptor = await getFaceFeatures(videoRef.current);
    if (!descriptor || descriptor.error) {
      if (descriptor?.error === 'TOO_DARK') setError('Too dark. Improve lighting.');
      else setError('Failed to extract facial features. Try again.');
      return;
    }

    const newSamples = [...samples, descriptor];
    setSamples(newSamples);

    if (newSamples.length < SAMPLES_REQUIRED) {
      setCurrentSample(currentSample + 1);
      setInstructions(sampleInstructions[currentSample + 1]);
      setProgress(`Please capture sample ${currentSample + 2} of ${SAMPLES_REQUIRED}`);
    } else {
      setProgress('Storing enrollment data...');
      const flattenedTemplates = flattenTemplates(newSamples);
      await setDoc(doc(db, 'users', currentUser.uid), {
        faceTemplates: flattenedTemplates,
        enrolledAt: new Date().toISOString()
      }, { merge: true });
      setEnrolled(true);
      setProgress('');
      alert('Face enrolled successfully!');
      navigate('/');
    }
  } catch (err) {
    console.error('Enrollment error:', err);
    setError('Failed to enroll face: ' + (err?.message || err));
  } finally {
    setLoading(false);
  }
};

  const resetEnrollment = () => {
    setSamples([]);
    setCurrentSample(0);
    setInstructions(sampleInstructions[0]);
    setError('');
    setProgress('');
  };


  return (
    <>
    {enrolled ? (
      <div className="success-message">
          <p>Your face has been enrolled successfully!</p>
          <p>You can now mark your attendance.</p>
      </div>
    ) : (
      <div className="enrollment-container">
        <h2>Face Enrollment</h2>
        
        {modelLoading && (
          <div className="progress-message">
            Loading face recognition model...
          </div>
        )}
          <>
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
            
            <div className="current-instruction">
              <h3>{instructions}</h3>
            </div>
            
            <div className="enrollment-progress">
              <p>Sample {currentSample + 1} of {SAMPLES_REQUIRED}</p>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${(currentSample / SAMPLES_REQUIRED) * 100}%` }}
                ></div>
              </div>
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
              ref={canvasRef} 
              style={{ display: 'none' }}
            />
            
            <div className="button-container">
              <button 
                onClick={captureSample} 
                disabled={loading || !cameraReady || modelLoading || remainingAttempts === 0}
                className="enroll-btn"
              >
                {loading ? 'Processing...' : `Capture Sample ${currentSample + 1}`}
              </button>
              
              <button 
                onClick={resetEnrollment}
                className="reset-btn"
              >
                Reset
              </button>
            </div>
            
            <div className="instructions">
              <h3>Instructions:</h3>
              <ul>
                <li>Position your face inside the circle</li>
                <li>Ensure good lighting on your face</li>
                <li>Keep a neutral expression</li>
                <li>Follow the on-screen instructions for each sample</li>
                <li>Make sure only your face is visible</li>
              </ul>
            </div>
          </>
      </div>
    )}
    </>
  );
}

export default Enrollment;