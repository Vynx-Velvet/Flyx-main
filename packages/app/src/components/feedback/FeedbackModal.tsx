'use client';
export function FeedbackModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return <div style={{position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.8)'}} onClick={onClose}><div style={{background:'#141420',borderRadius:12,padding:24,maxWidth:500}} onClick={e=>e.stopPropagation()}><h2 style={{color:'#fff'}}>Feedback</h2><button onClick={onClose} style={{marginTop:12,padding:'8px 16px',background:'#6366f1',border:'none',borderRadius:6,color:'#fff',cursor:'pointer'}}>Close</button></div></div>;
}
