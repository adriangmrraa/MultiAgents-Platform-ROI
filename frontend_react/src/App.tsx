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
import { Agents } from './views/Agents'; // v3.5 Agents Module
import { Console } from './views/Console';
import { Handoff } from './views/Handoff';

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
          <Route path="/agents" element={<Agents />} /> {/* Added missing route */}
          <Route path="/logs" element={<Logs />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/credentials" element={<Credentials />} />
          <Route path="/settings/ycloud" element={<YCloudSettings />} /> {/* Fixed path */}
          <Route path="/settings/meta" element={<MetaSettings />} /> {/* Fixed path */}
          <Route path="/settings" element={<YCloudSettings />} /> {/* Footer link fallback */}
          <Route path="/chats" element={<Chats />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/console" element={<Console />} />
          <Route path="/handoff" element={<Handoff />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
