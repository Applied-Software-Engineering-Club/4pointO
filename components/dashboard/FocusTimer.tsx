"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

const duration = 25 * 60;
export function FocusTimer({ studyMode, onStudyMode }: { studyMode: boolean; onStudyMode: () => void }) {
  const [remaining, setRemaining] = useState(duration);
  const [running, setRunning] = useState(false);
  const deadline = useRef(0);
  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) setRunning(false);
    }, 250);
    return () => window.clearInterval(interval);
  }, [running]);
  function toggle() {
    if (running) {
      setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
      setRunning(false);
    } else {
      const seconds = remaining || duration;
      setRemaining(seconds);
      deadline.current = Date.now() + seconds * 1000;
      setRunning(true);
    }
  }
  return <>
    <div className="card-heading"><span className="eyebrow">One thing at a time</span><Icon name="timer" /></div>
    <h2>Make room for deep work.</h2>
    <div className="timer-line"><span className="timer-value" role="timer" aria-label="Focus time remaining">{String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}</span><span className="timer-status" role="status">{remaining === 0 ? "Session complete. Take a break." : running ? "Focusing. You’ve got this." : "A little focus goes a long way."}</span></div>
    <div className="focus-actions"><button className="button timer-start" onClick={toggle}><Icon name={running ? "pause" : "play"} />{running ? "Pause" : remaining === duration ? "Start focus" : remaining === 0 ? "Start again" : "Resume"}</button><button className="icon-button" aria-label="Reset focus timer" onClick={() => { setRunning(false); setRemaining(duration); }}><Icon name="reset" /></button><button className="text-button focus-mode" onClick={onStudyMode}>{studyMode ? "Exit study mode" : "Study mode"}<Icon name="arrow" /></button></div>
  </>;
}
