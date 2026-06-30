import { Routes, Route, Navigate } from "react-router-dom";
import WorkspaceLayout from "./components/WorkspaceLayout.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";

import Login from "./screens/Login.jsx";
import GlobalDashboard from "./screens/GlobalDashboard.jsx";
import HRUpload from "./screens/HRUpload.jsx";
import JobSelector from "./screens/JobSelector.jsx";
import JobBuilder from "./screens/JobBuilder.jsx";
import Dashboard from "./screens/Dashboard.jsx";
import CandidateDetail from "./screens/CandidateDetail.jsx";
import InterviewScoring from "./screens/InterviewScoring.jsx";
import SuccessProfile from "./screens/SuccessProfile.jsx";
import CompareView from "./screens/CompareView.jsx";
import CandidatePortal from "./screens/CandidatePortal.jsx";

// Redirect to /login unless authenticated.
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// HR-facing app (wrapped in the workspace shell — sidebar + top bar).
function HRApp() {
  return (
    <WorkspaceLayout>
      <Routes>
        <Route path="/" element={<GlobalDashboard />} />
        <Route path="/upload" element={<HRUpload />} />
        <Route path="/jobs" element={<JobSelector />} />
        <Route path="/jobs/new" element={<JobBuilder />} />
        <Route path="/jobs/:jobId/dashboard" element={<Dashboard />} />
        <Route path="/jobs/:jobId/success-profile" element={<SuccessProfile />} />
        <Route
          path="/jobs/:jobId/candidate/:candidateId"
          element={<CandidateDetail />}
        />
        <Route
          path="/jobs/:jobId/candidate/:candidateId/interview"
          element={<InterviewScoring />}
        />
        <Route path="/jobs/:jobId/compare" element={<CompareView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </WorkspaceLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public candidate portal — no HR chrome, no auth */}
        <Route path="/apply/:token" element={<CandidatePortal />} />
        {/* Public login */}
        <Route path="/login" element={<Login />} />
        {/* Everything else is the protected HR console */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <HRApp />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
