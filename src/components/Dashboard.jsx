import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

function Dashboard() {
  const { currentUser } = useAuth();

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="dashboard">
      <header>
        <h1>Attendance System</h1>
        <div className="user-info">
          <span>{currentUser?.email}</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default Dashboard;