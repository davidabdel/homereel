"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Images, Gauge, Users, PlayCircle } from "lucide-react";

const steps = [
  {
    step: 1,
    title: "Upload the photos",
    desc: "The ones already on your listing. One photo becomes one shot.",
    Icon: Images,
  },
  {
    step: 2,
    title: "Standard or High Definition",
    desc: "Two buttons. The credit total updates before you commit.",
    Icon: Gauge,
  },
  {
    step: 3,
    title: "Add a family",
    desc: "Choose which living spaces get people. Never bathrooms, never exteriors.",
    Icon: Users,
  },
  {
    step: 4,
    title: "Generate and approve",
    desc: "Every shot comes back beside the photo it came from.",
    Icon: PlayCircle,
  },
];

export default function HowItWorks() {
  const reduceMotion = useReducedMotion();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.08,
        delayChildren: reduceMotion ? 0 : 0.1,
      },
    },
  } as const;

  const item = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
  } as const;

  return (
    <section className="w-full px-4 md:px-6 lg:px-8 py-14 md:py-20 bg-transparent">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white mb-6">
          How it works
        </h2>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
        >
          {steps.map(({ step, title, desc, Icon }) => (
            <motion.div
              key={step}
              variants={item}
              whileHover={{ scale: reduceMotion ? 1 : 1.03 }}
              className="group relative rounded-2xl p-[1px] transition-transform"
            >
              {/* Gradient ring */}
              <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_20%_0%,rgba(99,102,241,0.5),transparent_40%),radial-gradient(circle_at_80%_100%,rgba(56,189,248,0.4),transparent_40%)] blur-[2px] opacity-60 group-hover:opacity-90 transition-opacity" />
              {/* Card */}
              <div className="relative rounded-2xl h-full bg-zinc-900/70 border border-white/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] px-5 py-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs uppercase tracking-wide text-zinc-400">Step {step}</span>
                  <Icon className="w-5 h-5 text-zinc-300 opacity-90" aria-hidden />
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-white mb-1">{title}</h3>
                <p className="text-sm text-zinc-400">{desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        
      </div>
    </section>
  );
}
