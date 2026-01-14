import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Dashboard } from './views/Dashboard';
import { Credentials } from './views/Credentials';
import { Stores } from './views/Stores';
import { Setup } from './views/Setup';
import { SetupExperience } from './views/SetupExperience'; // v3.2 Nexus Engine
import { Logs } from './views/Logs';
import { Tools } from './views/Tools';
import { Chats } from './views/Chats'; // v3.3 Chat Module
import { YCloudSettings } from './views/YCloudSettings'; // v3.3 Settings Module
import { MetaSettings } from './views/MetaSettings'; // v3.3 Settings Module
import { Analytics } from './views/Analytics'; // v3.3 Analytics Module
import { MagicOnboarding } from './views/MagicOnboarding'; // v3.4 Magic Module
import { BusinessForge } from './views/BusinessForge'; // Negrocio Module
import { Agents } from './views/Agents'; // v3.5 Agents Module
import { Console } from './views/Console';
import { Handoff } from './views/Handoff';
import Login from './views/auth/Login';
import Register from './views/auth/Register';
import VerifyEmail from './views/auth/VerifyEmail';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-white">
        <svg className="animate-spin h-8 w-8 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify" element={<VerifyEmail />} />

          {/* Protected Routes */}
          <Route path="/*" element={
            <RequireAuth>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/setup" element={<Setup />} />
                  <Route path="/nexus-setup" element={<SetupExperience />} />
                  <Route path="/magic" element={<MagicOnboarding />} />
                  <Route path="/forge" element={<BusinessForge />} />
                  <Route path="/stores" element={<Stores />} />
                  <Route path="/agents" element={<Agents />} />
                  <Route path="/logs" element={<Logs />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/credentials" element={<Credentials />} />
                  <Route path="/settings/ycloud" element={<YCloudSettings />} />
                  <Route path="/settings/meta" element={<MetaSettings />} />
                  <Route path="/settings" element={<YCloudSettings />} />
                  <Route path="/chats" element={<Chats />} />
                  <Route path="/tools" element={<Tools />} />
                  <Route path="/console" element={<Console />} />
                  <Route path="/handoff" element={<Handoff />} />
                  {/* Catch all redirect to dashboard */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </RequireAuth>
          } />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
