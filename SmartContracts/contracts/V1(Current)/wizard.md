Let me explore GTO Wizard's actual interface and dig into their constraints. I'll navigate to their site and research their solve limits, hand history flow, and how the practice/review system actually works.Browser isn't connected, but I can do this thoroughly via web research. Let me dig deep into GTO Wizard's actual mechanics.Now I have a very thorough picture. Here's what I found about GTO Wizard's actual mechanics and constraints — and critically, how this reshapes the OpenClaw design.

---

## How GTO Wizard Actually Works (and Where OpenClaw Plugs In)

**GTO Wizard has three fundamentally different data flows**, and they each have different implications for OpenClaw:

### 1. Pre-solved Solution Library (Study Mode)
This is their core product — more than 10 million pre-solved situations stored server-side. When you browse a spot in Study mode, GTO Wizard fetches the solution from their servers and renders it in your browser. The solution includes: range matrices, action frequencies, EVs per hand, board texture data, and aggregated reports across 1,755 flops. These are **not computed in real-time** — they were solved offline using traditional CFR solvers and uploaded to their database.

This is the data OpenClaw would capture most easily — it's already being sent to your browser.

### 2. GTO Wizard AI (Custom Solving — Elite Only)
GTO Wizard AI can accurately solve any poker spot in seconds, powered by the Ruse AI team they acquired. This is their neural-net solver that computes solutions on-demand. You can modify ranges, stack/pot sizes, actions, and bet sizes. The Elite tier offers unlimited exclusive access to GTO Wizard AI custom solves. As of this month, they've launched a new **Ultra tier** at $289/month annual or $359/month which is the only tier with access to the new multiway preflop solver.

Custom solves consume server compute. This is where rate limiting would bite hardest.

### 3. Hand History Analyzer (Upload → Compare to GTO)
You upload hand history files from poker sites. The Analyzer works by comparing your hand history to a presolved solution from preflop to turn; the river is calculated using the exact board state. GTO Wizard matches your bet sizes to the closest available sizes in their solution library. The output: EV loss per action, GTO score, blunder/inaccuracy/correct classification.

Upload limits are hard-capped by tier: **50 hands/month (Starter), 100,000 hands/month (Premium), 150,000 hands/month (Elite)**.

---

## The Actual Constraints That Matter for OpenClaw

### Constraint 1: Rate Limiting & Anti-RTA Throttling

This is the one I underestimated in the PRD. GTO Wizard has built-in delays that get slower and slower when a player looks up spots too fast, as well as limits to how many solutions can be looked up in a day. The software detects when a customer is using the app in the way a cheater would compared to somebody studying. GTO Wizard also locks people out of their accounts and eventually bans them when they try to access too many hands in a short space of time.

This is their **anti-RTA (Real Time Assistance) system** and it's a direct constraint on OpenClaw. Even though OpenClaw is passive (capturing what you're already viewing), if you're studying heavily and the extension is silently requesting additional data or causing you to browse faster, the throttling kicks in. The system monitors:

- Speed of solution lookups (progressive slowdown)
- Volume of solutions accessed per day (hard daily cap, exact number not public)
- Behavioral pattern analysis (study patterns vs. cheater patterns)
- Account lockout → eventual ban for persistent violations

**Impact on OpenClaw:** The extension can only capture what you're naturally viewing at human pace. It can't pre-fetch related solutions, can't batch-request data, and can't run in the background generating additional API calls. If you study 50 hands in a session, OpenClaw captures 50 hands — there's no way to programmatically expand that without triggering anti-RTA.

### Constraint 2: The Analyzer's Bet Size Matching Problem

This is subtle but important. Bet sizes are matched to the closest available size within the solutions. However, discrepancies can still occur. When GTO Wizard analyzes your hand history, it maps your actual bet sizes to the nearest pre-solved sizes. If you bet 75% pot and they have solutions for 66% and 100%, it picks 66%. This means the EV loss calculation is approximate, not exact.

For OpenClaw, this means the "mistakes" you're drilling on might partly be artifacts of bet size approximation rather than genuine strategic errors. At NL1000 where bet sizing precision matters enormously, this is a real noise source.

**The river is the exception** — the river is calculated using the exact board state (stacks/sizes/etc), meaning river analysis is more precise.

### Constraint 3: Multiway Spots Are Unsolved

The Analyzer will ignore certain hands for which we don't have solutions – such as multiway postflop spots. At NL1000 6-max, a significant chunk of your hands will be multiway (limped pots, 3-bet pots with a caller, etc). These hands simply return no analysis. OpenClaw can capture them but has nothing to generate drills from — the solver data doesn't exist.

Postflop solving is now available for 3 players, but only via the AI solver (Elite/Ultra). The pre-solved library remains heads-up only postflop.

### Constraint 4: No Structured Data Export

You can view the performance of previous Trainer sessions. Click the dropdown of any session to see EV losses, GTOW score, and more. All this data exists — EV loss per hand, per action, per session, GTO score trends — but it lives exclusively inside GTO Wizard's web app. There's no CSV export, no JSON API, no webhook. The feature request for export has been sitting unfulfilled on their feedback board.

The **only** export is a screenshot image of a single hand to share with friends.

### Constraint 5: Table Wizard Changes the Game

This is actually the biggest opportunity I found. GTO Wizard recently launched **Table Wizard**, a free desktop app that automatically saves and uploads your hand histories for advanced analysis in GTO Wizard. It's a table manager with hotkeys, bet sliders, and — critically — **auto-upload**. Turn on Auto-Upload and your hands queue into the Analyzer as you play. When the session ends, open Analyzer and start reviewing.

This means GTO Wizard is already solving the hand-capture pipeline for you. Table Wizard sends hands to GTO Wizard → GTO Wizard analyzes them against pre-solved solutions → results appear in Analyzer.

**What this means for OpenClaw:** Instead of capturing data from the Study/Practice modes, OpenClaw could focus on capturing the Analyzer results after Table Wizard auto-uploads your session. The Analyzer page has the richest structured data (EV loss per hand, per street, per action, blunder classifications). This is the most valuable data source.

### Constraint 6: Tier-Gated Features

The features you'd need for OpenClaw to work well are scattered across tiers:

| Feature | Free | Starter ($39/mo) | Premium ($69/mo) | Elite ($129/mo) | Ultra ($229+/mo) |
|---|---|---|---|---|---|
| Postflop solutions | 1/day | 13 depths | All depths | All depths | All depths |
| Practice hands | 10/day | Unlimited (100bb only) | Unlimited (all depths) | Unlimited | Unlimited |
| Hand history uploads | 5/month | 50/month | 100,000/month | 150,000/month | 150,000/month |
| AI custom solves | No | No | No | Unlimited | Unlimited |
| Multiway preflop solver | 10bb max free test | No | No | No | Yes |
| Aggregated reports | Basic | Basic | All | All | All |
| GTO Reports (leak analysis) | No | No | Premium | Premium | Premium |

At NL1000, you'd want at minimum **Premium** ($69/mo) for the 100k hand upload limit and all stack depths, or **Elite** ($129/mo) for AI custom solves that give you exact solutions for your actual bet sizes rather than nearest-match approximations.

### Constraint 7: Behavioral Detection Is Getting Smarter

GTO Wizard partners with GGPoker, ACR, WPT Global, and iPoker for anti-cheating. They have a security team headed by Marc-Antoine Provost, the co-founder of Ruse. Their Fair Play Check tool lets players check if opponents were looking up solutions during a game. Their GTO Reports feature is actively used to detect cheaters at poker rooms.

This means they're investing heavily in usage pattern analysis. A browser extension that intercepts their API responses creates an anomalous client-side behavior pattern. While they can't easily detect a passive DOM reader, they could detect anomalous patterns in solution access if the extension triggers additional data loading.

---

## How This Reshapes the OpenClaw Design

The smart move is to **work with GTO Wizard's existing pipeline** rather than fighting it:

**Revised flow:** You play poker → Table Wizard auto-uploads hands → GTO Wizard Analyzer processes them → **OpenClaw's Chrome extension captures the Analyzer page results** (EV losses, blunder classifications, hand details) → feeds them into the FSRS scheduler → sends to Claude Opus 4.6 for interpretation → delivers drills via Telegram.

This approach is better because the Analyzer page contains the most structured, highest-value data, it's already processed/solved by GTO Wizard's servers (no additional compute), and you're just reading a results page rather than intercepting solver API calls, which is a much smaller detection surface.

The key constraint is that **you can only capture what GTO Wizard has already solved for you** — you can't expand the analysis, re-solve with different bet sizes, or generate solutions for multiway spots that GTO Wizard skipped. OpenClaw becomes a study scheduling and coaching interpretation layer on top of GTO Wizard's output, not a replacement for it.