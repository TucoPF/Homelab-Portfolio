# Power Usage Analysis

**Date:** mardi 10 mars 2026

## 🔋 Battery Health
* **Health/Capacity:** 85.9% of original design capacity (~71.3 Wh / ~83.0 Wh).
* **Charge Cycles:** 45 cycles.

## ⚙️ Power Management Configuration
* **Daemons:** None active (`tlp`, `power-profiles-daemon`, `auto-cpufreq`, `thermald`, and `tuned` are all inactive). Relying entirely on the Linux kernel's default power management.
* **CPU Driver:** Native Intel driver (`intel_pstate`).
* **CPU Governor:** `powersave` (dynamically scales down to save power when idle, boosts to maximum performance when needed).
* **Sleep State:** `s2idle` (Modern Standby / Suspend-to-Idle).

## ⚡ Power Usage Breakdown (Active Use unplugged for 15 minutes)
* **Average Power Draw:** ~17.1 Watts
* **Minimum Draw:** 5.3 W 
* **Maximum Peak:** 26.3 W
* **Typical Range:** 13W to 25W during active use.

## 🔋 Estimated Battery Life
Given a battery capacity of ~71.3 Wh:
* **Active Use (~17.1W continuous average):** ~4 hours and 10 minutes.
* **Lighter Tasks (10W-13W range):** ~5.5 to 7 hours.

**Conclusion:** 
The system is running efficiently on the default kernel power management. Dropping to 5.3W shows correct low-power idle states, and spiking to 26W shows the `powersave` governor and `intel_pstate` driver are working correctly to provide bursts of performance when needed.
