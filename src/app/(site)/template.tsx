"use client";

import { motion } from "framer-motion";
import { EASE } from "@/components/motion";

/** Re-runs on every navigation inside the public site, so each page eases in. */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
      {children}
    </motion.div>
  );
}
