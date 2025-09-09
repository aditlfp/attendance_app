import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [enrolled, setEnrolled] = useState(false);
  
  useEffect(() => {
      const checkEnrollment = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists() && userDoc.data().enrolledAt) {
          setEnrolled(true);
        }
      } catch (err) {
        console.error('Error checking enrollment:', err);
      }
    };

    checkEnrollment();
  }, [currentUser, db]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const navigateToEnrollment = () => {
    navigate('/enrollment');
  };

  const navigateToAttendance = () => {
    navigate('/');
  };

  const navigateToHistory = () => {
    navigate('/history');
  };

  // Determine which tab is active based on current path
  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/enrollment') return 'enrollment';
    if (path === '/history') return 'history';
    return 'attendance'; // Default or root path
  };

  const activeTab = getActiveTab();

  return (
    <div className="dashboard">
      <header>
        <h1>Attendance System</h1>
        <div className="user-info">
          <span>{currentUser?.email}</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>
      
      <div className="dashboard-nav">
        <button 
          onClick={navigateToEnrollment}
          className={activeTab === 'enrollment' ? 'active' : ''}
        >
          Face Enrollment
        </button>
        <button 
          onClick={navigateToAttendance}
          className={activeTab === 'attendance' ? 'active' : ''}
          disabled={!enrolled}
        >
          Mark Attendance
        </button>
        <button 
          onClick={navigateToHistory}
          className={activeTab === 'history' ? 'active' : ''}
        >
          Attendance History
        </button>
      </div>
      
      <main>
        <Outlet />
      </main>
      
      {!enrolled && activeTab !== 'enrollment' && (
        <div className="enrollment-reminder">
          <p>Please enroll your face first before marking attendance</p>
        </div>
      )}
    </div>
  );
}

export default Dashboard;