export default function VideoModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="video-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="video-modal-box">
        <button type="button" className="video-modal-close" onClick={onClose} aria-label="Close video">
          ×
        </button>
        <video controls autoPlay playsInline className="video-modal-player">
          <source src="/peoplehire-intro.mp4" type="video/mp4" />
        </video>
      </div>
    </div>
  );
}
