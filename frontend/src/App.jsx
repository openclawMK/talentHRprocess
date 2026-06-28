import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";

import JobSelector from "./screens/JobSelector.jsx";
import JobBuilder from "./screens/JobBuilder.jsx";
import CVUpload from "./screens/CVUpload.jsx";
import Dashboard from "./screens/Dashboard.jsx";
import CandidateDetail from "./screens/CandidateDetail.jsx";
import InterviewQuestions from "./screens/InterviewQuestions.jsx";
import InterviewScoring from "./screens/InterviewScoring.jsx";
import OceanQuestionnaire from "./screens/OceanQuestionnaire.jsx";
import CompareView from "./screens/CompareView.jsx";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/jobs" replace />} />
        <Route path="/jobs" element={<JobSelector />} />
        <Route path="/jobs/new" element={<JobBuilder />} />
        <Route path="/jobs/:jobId/upload" element={<CVUpload />} />
        <Route path="/jobs/:jobId/dashboard" element={<Dashboard />} />
        <Route
          path="/jobs/:jobId/candidate/:candidateId"
          element={<CandidateDetail />}
        />
        <Route
          path="/jobs/:jobId/candidate/:candidateId/questions"
          element={<InterviewQuestions />}
        />
        <Route
          path="/jobs/:jobId/candidate/:candidateId/interview"
          element={<InterviewScoring />}
        />
        <Route
          path="/jobs/:jobId/candidate/:candidateId/ocean"
          element={<OceanQuestionnaire />}
        />
        <Route path="/jobs/:jobId/compare" element={<CompareView />} />
        <Route path="*" element={<Navigate to="/jobs" replace />} />
      </Routes>
    </Layout>
  );
}
