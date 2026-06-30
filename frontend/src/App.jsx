import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";

import Login from "./screens/Login.jsx";
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

// HR-facing app (wrapped in the shared Layout with PeopleQuest header).
function HRApp() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/jobs" replace />} />
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
        <Route path="*" element={<Navigate to="/jobs" replace />} />
      </Routes>
    </Layout>
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
