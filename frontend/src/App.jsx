import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Landing from "./pages/Landing";
import LiveSession from "./pages/LiveSession";
import SessionHistoryList from "./pages/SessionHistoryList";
import SessionDetail from "./pages/SessionDetail";
import "./styles/global.css";

const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: "easeInOut" },
};

function Page({ children }) {
  return (
    <motion.div {...pageTransition} style={{ minHeight: "100vh" }}>
      {children}
    </motion.div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Landing />} />
        <Route path="/session" element={<LiveSession />} />
        <Route path="/history" element={<Page><SessionHistoryList /></Page>} />
        <Route path="/history/:id" element={<Page><SessionDetail /></Page>} />
      </Routes>
    </AnimatePresence>
  );
}
