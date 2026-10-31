"use client";

import { motion } from "framer-motion";

/** Fade only: a transform here would break the sticky save bar on the edit pages. */
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      {children}
    </motion.div>
  );
}
