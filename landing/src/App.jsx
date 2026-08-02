import { useState } from "react";
import Header from "./components/Header.jsx";
import HeroLeft from "./components/HeroLeft.jsx";
import CirclesVisualization from "./components/CirclesVisualization.jsx";
import LogoTicker from "./components/LogoTicker.jsx";
import VideoModal from "./components/VideoModal.jsx";
import "./App.css";

export default function App() {
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <div className="app">
      <Header onOpenVideo={() => setVideoOpen(true)} />
      <main className="hero">
        <HeroLeft onOpenVideo={() => setVideoOpen(true)} />
        <CirclesVisualization />
      </main>
      <LogoTicker />
      <VideoModal open={videoOpen} onClose={() => setVideoOpen(false)} />
    </div>
  );
}
