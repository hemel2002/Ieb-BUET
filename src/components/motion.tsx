"use client";

import { MotionConfig, motion, type Variants } from "framer-motion";

export const EASE = [0.22, 1, 0.36, 1] as const;

/** Honours the visitor's "reduce motion" setting for every animation underneath it. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Seconds to wait before the animation starts. */
  delay?: number;
  /** Distance in px the block travels while fading in. */
  y?: number;
  /** Slide in from the side instead of from below (px, negative = from the left). */
  x?: number;
  /** Animate on mount rather than when scrolled into view; use for what is visible on load. */
  immediate?: boolean;
};

/** Fades and lifts a block in, once, as it scrolls into view. */
export function Reveal({ children, className, delay = 0, y = 16, x = 0, immediate }: RevealProps) {
  const from = { opacity: 0, y, x };
  const to = { opacity: 1, y: 0, x: 0 };
  const transition = { duration: 0.5, delay, ease: EASE };
  return immediate ? (
    <motion.div className={className} initial={from} animate={to} transition={transition}>
      {children}
    </motion.div>
  ) : (
    <motion.div
      className={className}
      initial={from}
      whileInView={to}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

type StaggerListProps = {
  children: React.ReactNode;
  className?: string;
  as?: "ul" | "ol";
};

/** A list whose items rise in one after another when it scrolls into view. */
export function StaggerList({ children, className, as = "ul" }: StaggerListProps) {
  const Tag = as === "ol" ? motion.ol : motion.ul;
  return (
    <Tag
      className={className}
      variants={listVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -6% 0px" }}
    >
      {children}
    </Tag>
  );
}

/** Direct child of StaggerList. `lift` raises the item slightly under a mouse pointer. */
export function StaggerItem({ children, className, lift }: { children: React.ReactNode; className?: string; lift?: boolean }) {
  return (
    <motion.li
      className={className}
      variants={itemVariants}
      whileHover={lift ? { y: -3, transition: { duration: 0.18 } } : undefined}
    >
      {children}
    </motion.li>
  );
}

/** Emoji used as decoration: sized with the text and hidden from screen readers. */
export function Emoji({ children, className = "" }: { children: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`emoji ${className}`}>
      {children}
    </span>
  );
}

/** Gently bobs its child, for a single friendly accent such as the emoji on an empty state. */
export function Float({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.span
      className={`inline-block ${className ?? ""}`}
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.span>
  );
}
