import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/nexus-setup" element={<SetupExperience />} />
          <Route path="/magic" element={<MagicOnboarding />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/credentials" element={<Credentials />} />
          <Route path="/ycloud" element={<YCloudSettings />} />
          <Route path="/whatsapp-meta" element={<MetaSettings />} />
          <Route path="/chats" element={<Chats />} />
          <Route path="/tools" element={<Tools />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
