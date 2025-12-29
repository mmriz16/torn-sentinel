/**
 * Alert Registry - Centralized Alert Definitions
 * Each alert has: key, emoji, title, cooldown, severity, api, conditions
 */

// Alert severity levels
export const SEVERITY = {
    ACTION: 'action',      // User should take action
    INFO: 'info',          // Informational
    WARNING: 'warning',    // Potential risk
};

// API selections for polling (v1 compatible)
export const API_GROUPS = {
    BARS: 'bars,cooldowns',
    TRAVEL: 'travel',
    EDUCATION: 'education',
    JOB: 'jobpoints',                  // v1: jobpoints instead of job
    PROFILE: 'basic',                  // v1: basic includes status
    FINANCIAL: 'money',                // v1: money_onhand
    MESSAGES: 'messages',              // New messages
    EVENTS: 'events',                  // New events
};

// Poll intervals in milliseconds
export const POLL_INTERVALS = {
    FAST: 60 * 1000,       // 60 seconds - bars, travel
    MEDIUM: 5 * 60 * 1000, // 5 minutes - education, financial
    SLOW: 10 * 60 * 1000,  // 10 minutes - job
};

/**
 * Alert Definitions
 * Each alert must have:
 * - key: unique identifier
 * - emoji: display emoji
 * - title: alert title
 * - cooldown: seconds before same alert can fire again
 * - severity: action/info/warning
 * - apiGroup: which API selection to use
 * - pollInterval: how often to check
 * - checkCondition: (prev, curr) => boolean - fires when returns true
 * - resetCondition: (prev, curr) => boolean - resets flag when returns true
 * - getMessage: (state) => string[] - bullet points for alert
 */
export const ALERTS = {
    // ═══════════════════════════════════════════════════════════════════
    // ⚡ RESOURCE & COOLDOWN ALERTS
    // ═══════════════════════════════════════════════════════════════════

    ENERGY_FULL: {
        key: 'ENERGY_FULL',
        emoji: '⚡',
        title: 'Energy Full!',
        cooldown: 600, // 10 min
        severity: SEVERITY.ACTION,
        apiGroup: API_GROUPS.BARS,
        pollInterval: POLL_INTERVALS.FAST,
        checkCondition: (prev, curr) => {
            // Trigger when energy reaches max (and wasn't max before)
            return curr.energy?.current >= curr.energy?.maximum &&
                (!prev.energy || prev.energy.current < prev.energy.maximum);
        },
        resetCondition: (prev, curr) => {
            // Reset when energy drops below max
            return curr.energy?.current < curr.energy?.maximum;
        },
        getMessage: (state) => [
            `Energy: **${state.energy?.current}/${state.energy?.maximum}**`,
            'Time to train or use energy!'
        ]
    },

    NERVE_FULL: {
        key: 'NERVE_FULL',
        emoji: '🧠',
        title: 'Nerve Full!',
        cooldown: 600, // 10 min
        severity: SEVERITY.ACTION,
        apiGroup: API_GROUPS.BARS,
        pollInterval: POLL_INTERVALS.FAST,
        checkCondition: (prev, curr) => {
            return curr.nerve?.current >= curr.nerve?.maximum &&
                (!prev.nerve || prev.nerve.current < prev.nerve.maximum);
        },
        resetCondition: (prev, curr) => {
            return curr.nerve?.current < curr.nerve?.maximum;
        },
        getMessage: (state) => [
            `Nerve: **${state.nerve?.current}/${state.nerve?.maximum}**`,
            'Time to commit some crimes!'
        ]
    },

    HAPPY_FULL: {
        key: 'HAPPY_FULL',
        emoji: '😊',
        title: 'Happy Full!',
        cooldown: 1800, // 30 min (happy takes longer to refill)
        severity: SEVERITY.INFO,
        apiGroup: API_GROUPS.BARS,
        pollInterval: POLL_INTERVALS.FAST,
        checkCondition: (prev, curr) => {
            return curr.happy?.current >= curr.happy?.maximum &&
                (!prev.happy || prev.happy.current < prev.happy.maximum);
        },
        resetCondition: (prev, curr) => {
            return curr.happy?.current < curr.happy?.maximum;
        },
        getMessage: (state) => [
            `Happy: **${state.happy?.current}/${state.happy?.maximum}**`,
            'Maximum happiness reached!'
        ]
    },

    LIFE_FULL: {
        key: 'LIFE_FULL',
        emoji: '❤️',
        title: 'Life Full!',
        cooldown: 600, // 10 min
        severity: SEVERITY.INFO,
        apiGroup: API_GROUPS.BARS,
        pollInterval: POLL_INTERVALS.FAST,
        checkCondition: (prev, curr) => {
            return curr.life?.current >= curr.life?.maximum &&
                (!prev.life || prev.life.current < prev.life.maximum);
        },
        resetCondition: (prev, curr) => {
            return curr.life?.current < curr.life?.maximum;
        },
        getMessage: (state) => [
            `Life: **${state.life?.current}/${state.life?.maximum}**`,
            'Fully healed and ready to fight!'
        ]
    },

    DRUG_READY: {
        key: 'DRUG_READY',
        emoji: '💊',
        title: 'Drug Cooldown Ready!',
        cooldown: 300, // 5 min
        severity: SEVERITY.ACTION,
        apiGroup: API_GROUPS.BARS,
        pollInterval: POLL_INTERVALS.FAST,
        checkCondition: (prev, curr) => {
            // Trigger when drug cooldown reaches 0 (was > 0 before)
            const currCd = curr.cooldowns?.drug || 0;
            const prevCd = prev.cooldowns?.drug || 0;
            return currCd === 0 && prevCd > 0;
        },
        resetCondition: (prev, curr) => {
            // Reset when drug cooldown starts again
            return (curr.cooldowns?.drug || 0) > 0;
        },
        getMessage: (state) => [
            'Drug cooldown is over!',
            'Ready to take another drug.'
        ]
    },

    BOOSTER_READY: {
        key: 'BOOSTER_READY',
        emoji: '💉',
        title: 'Booster Cooldown Ready!',
        cooldown: 300, // 5 min
        severity: SEVERITY.ACTION,
        apiGroup: API_GROUPS.BARS,
        pollInterval: POLL_INTERVALS.FAST,
        checkCondition: (prev, curr) => {
            const currCd = curr.cooldowns?.booster || 0;
            const prevCd = prev.cooldowns?.booster || 0;
            return currCd === 0 && prevCd > 0;
        },
        resetCondition: (prev, curr) => {
            return (curr.cooldowns?.booster || 0) > 0;
        },
        getMessage: (state) => [
            'Booster cooldown is over!',
            'Ready to use another booster.'
        ]
    },

    // ═══════════════════════════════════════════════════════════════════
    // ✈️ TRAVEL ALERTS
    // ═══════════════════════════════════════════════════════════════════

    TRAVEL_COMPLETED: {
        key: 'TRAVEL_COMPLETED',
        emoji: '✈️',
        title: 'Travel Completed!',
        cooldown: 60, // 1 min
        severity: SEVERITY.ACTION,
        apiGroup: API_GROUPS.TRAVEL,
        pollInterval: POLL_INTERVALS.FAST,
        checkCondition: (prev, curr) => {
            // Trigger when time_left reaches 0 (was > 0) AND destination is not Torn
            const prevTime = prev.travel?.time_left || 0;
            const currTime = curr.travel?.time_left || 0;
            const destination = curr.travel?.destination || '';
            // Arrived at foreign country (not returning to Torn)
            return prevTime > 0 && currTime === 0 && destination !== 'Torn';
        },
        resetCondition: (prev, curr) => {
            // Reset when starts traveling again (time_left > 0)
            return (curr.travel?.time_left || 0) > 0;
        },
        getMessage: (state) => {
            const destination = state.travel?.destination || 'destination';
            return [
                `Arrived at **${destination}**!`,
                'Check foreign stocks & perform actions.'
            ];
        }
    },

    TRAVEL_RETURNING: {
        key: 'TRAVEL_RETURNING',
        emoji: '🏠',
        title: 'Returned to Torn!',
        cooldown: 60, // 1 min
        severity: SEVERITY.INFO,
        apiGroup: API_GROUPS.TRAVEL,
        pollInterval: POLL_INTERVALS.FAST,
        checkCondition: (prev, curr) => {
            // Trigger when time_left reaches 0 AND destination is Torn
            const prevTime = prev.travel?.time_left || 0;
            const currTime = curr.travel?.time_left || 0;
            const destination = curr.travel?.destination || '';
            return prevTime > 0 && currTime === 0 && destination === 'Torn';
        },
        resetCondition: (prev, curr) => {
            return (curr.travel?.time_left || 0) > 0;
        },
        getMessage: (state) => [
            'Returned to **Torn City**!',
            'Sell your items on the market.'
        ]
    },

    TRAVEL_READY: {
        key: 'TRAVEL_READY',
        emoji: '🛫',
        title: 'Ready to Travel!',
        cooldown: 300, // 5 min
        severity: SEVERITY.INFO,
        apiGroup: API_GROUPS.TRAVEL,
        pollInterval: POLL_INTERVALS.FAST,
        checkCondition: (prev, curr) => {
            // Not currently traveling and time_left is 0
            const currTime = curr.travel?.time_left || 0;
            const prevTime = prev.travel?.time_left || 0;
            const destination = curr.travel?.destination || '';
            // Ready when in Torn and not traveling
            return currTime === 0 && prevTime > 0 && destination === 'Torn';
        },
        resetCondition: (prev, curr) => {
            return (curr.travel?.time_left || 0) > 0;
        },
        getMessage: (state) => [
            'Travel cooldown is over!',
            'Ready for your next trip.'
        ]
    },

    // ═══════════════════════════════════════════════════════════════════
    // 🎓 EDUCATION ALERTS
    // ═══════════════════════════════════════════════════════════════════

    EDUCATION_COMPLETED: {
        key: 'EDUCATION_COMPLETED',
        emoji: '🎓',
        title: 'Education Completed!',
        cooldown: 300, // 5 min
        severity: SEVERITY.ACTION,
        apiGroup: API_GROUPS.EDUCATION,
        pollInterval: POLL_INTERVALS.MEDIUM,
        checkCondition: (prev, curr) => {
            // Trigger when education_timeleft reaches 0 (was > 0)
            const currTime = curr.education_timeleft || 0;
            const prevTime = prev.education_timeleft || 0;
            return currTime === 0 && prevTime > 0;
        },
        resetCondition: (prev, curr) => {
            // Reset when new education starts
            return (curr.education_timeleft || 0) > 0;
        },
        getMessage: (state) => [
            'Education course completed!',
            'Start a new course to continue learning.'
        ]
    },

    // ═══════════════════════════════════════════════════════════════════
    // 🏢 JOB ALERTS
    // ═══════════════════════════════════════════════════════════════════

    JOB_POINTS_AVAILABLE: {
        key: 'JOB_POINTS_AVAILABLE',
        emoji: '💼',
        title: 'Job Points Available!',
        cooldown: 600, // 10 min
        severity: SEVERITY.ACTION,
        apiGroup: API_GROUPS.JOB,
        pollInterval: POLL_INTERVALS.SLOW,
        checkCondition: (prev, curr) => {
            const currPoints = curr.job?.company?.job_points || 0;
            const prevPoints = prev.job?.company?.job_points || 0;
            return currPoints > 0 && prevPoints === 0;
        },
        resetCondition: (prev, curr) => {
            return (curr.job?.company?.job_points || 0) === 0;
        },
        getMessage: (state) => {
            const points = state.job?.company?.job_points || 0;
            return [
                `Job points: **${points}** available`,
                'Use them before they expire!'
            ];
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // 🏥 STATUS ALERTS
    // ═══════════════════════════════════════════════════════════════════

    OUT_OF_HOSPITAL: {
        key: 'OUT_OF_HOSPITAL',
        emoji: '🏥',
        title: 'Out of Hospital!',
        cooldown: 60, // 1 min
        severity: SEVERITY.INFO,
        apiGroup: API_GROUPS.PROFILE,
        pollInterval: POLL_INTERVALS.FAST,
        checkCondition: (prev, curr) => {
            const prevStatus = prev.status?.state?.toLowerCase() || '';
            const currStatus = curr.status?.state?.toLowerCase() || '';
            return prevStatus === 'hospital' && currStatus === 'okay';
        },
        resetCondition: (prev, curr) => {
            const currStatus = curr.status?.state?.toLowerCase() || '';
            return currStatus === 'hospital';
        },
        getMessage: (state) => [
            'You are out of hospital!',
            'Back to normal activities.'
        ]
    },

    // ═══════════════════════════════════════════════════════════════════
    // 📉 FINANCIAL ALERTS (thresholds from config)
    // ═══════════════════════════════════════════════════════════════════

    CASH_DROP: {
        key: 'CASH_DROP',
        emoji: '📉',
        title: 'Cash Drop Alert!',
        cooldown: 600, // 10 min
        severity: SEVERITY.WARNING,
        apiGroup: API_GROUPS.FINANCIAL,
        pollInterval: POLL_INTERVALS.MEDIUM,
        checkCondition: (prev, curr, config) => {
            const threshold = config?.CASH_DROP_THRESHOLD || 500000;
            const prevCash = prev.money_onhand || 0;
            const currCash = curr.money_onhand || 0;
            const drop = prevCash - currCash;
            return drop >= threshold;
        },
        resetCondition: () => true, // Always reset after sending
        getMessage: (state, prev, config) => {
            const drop = (prev.money_onhand || 0) - (state.money_onhand || 0);
            return [
                `Cash dropped by **$${drop.toLocaleString()}**`,
                'Check for mugging or unexpected expenses.'
            ];
        }
    },

    UNPAID_FEES_INCREASED: {
        key: 'UNPAID_FEES_INCREASED',
        emoji: '💸',
        title: 'Unpaid Fees Alert!',
        cooldown: 600, // 10 min
        severity: SEVERITY.WARNING,
        apiGroup: API_GROUPS.FINANCIAL,
        pollInterval: POLL_INTERVALS.MEDIUM,
        checkCondition: (prev, curr, config) => {
            const minDelta = config?.UNPAID_FEES_DELTA_MIN || 100000;
            const prevFees = prev.unpaidfees || 0;
            const currFees = curr.unpaidfees || 0;
            const increase = currFees - prevFees;
            return increase >= minDelta;
        },
        resetCondition: () => true, // Always reset after sending
        getMessage: (state, prev) => {
            const increase = (state.unpaidfees || 0) - (prev.unpaidfees || 0);
            return [
                `Unpaid fees increased by **$${increase.toLocaleString()}**`,
                `Total unpaid: **$${(state.unpaidfees || 0).toLocaleString()}**`
            ];
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // 📬 MESSAGE ALERTS
    // ═══════════════════════════════════════════════════════════════════

    NEW_MESSAGE: {
        key: 'NEW_MESSAGE',
        emoji: '📬',
        title: 'New Message!',
        cooldown: 30, // 30 seconds (allow multiple messages)
        severity: SEVERITY.INFO,
        apiGroup: API_GROUPS.MESSAGES,
        pollInterval: POLL_INTERVALS.FAST,
        checkCondition: (prev, curr) => {
            // Get new unread messages
            const currMessages = curr.messages || {};
            const prevMessageIds = Object.keys(prev.messages || {});
            const currMessageIds = Object.keys(currMessages);

            // Find new messages that weren't in previous state
            const newMessages = currMessageIds.filter(id => !prevMessageIds.includes(id));
            return newMessages.length > 0;
        },
        resetCondition: () => true, // Always reset to allow multiple alerts
        getMessage: (state, prev) => {
            const currMessages = state.messages || {};
            const prevMessageIds = Object.keys(prev.messages || {});
            const currMessageIds = Object.keys(currMessages);

            // Find the newest message
            const newMessageIds = currMessageIds.filter(id => !prevMessageIds.includes(id));
            if (newMessageIds.length === 0) return ['New message received'];

            const newestId = newMessageIds[0];
            const msg = currMessages[newestId];
            const sender = msg?.name || 'Unknown';
            const title = msg?.title || 'No subject';

            return [
                `From: **${sender}**`,
                `Subject: ${title}`,
                newMessageIds.length > 1 ? `*+${newMessageIds.length - 1} more messages*` : ''
            ].filter(Boolean);
        },
        // Store message for extended embed
        getExtendedData: (state, prev) => {
            const currMessages = state.messages || {};
            const prevMessageIds = Object.keys(prev.messages || {});
            const currMessageIds = Object.keys(currMessages);
            const newMessageIds = currMessageIds.filter(id => !prevMessageIds.includes(id));

            if (newMessageIds.length === 0) return null;
            return currMessages[newMessageIds[0]];
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // 📋 EVENT ALERTS  
    // ═══════════════════════════════════════════════════════════════════

    NEW_EVENT: {
        key: 'NEW_EVENT',
        emoji: '📋',
        title: 'New Event!',
        cooldown: 30, // 30 seconds
        severity: SEVERITY.INFO,
        apiGroup: API_GROUPS.EVENTS,
        pollInterval: POLL_INTERVALS.FAST,
        checkCondition: (prev, curr) => {
            const currEvents = curr.events || {};
            const prevEventIds = Object.keys(prev.events || {});
            const currEventIds = Object.keys(currEvents);

            const newEvents = currEventIds.filter(id => !prevEventIds.includes(id));
            return newEvents.length > 0;
        },
        resetCondition: () => true,
        getMessage: (state, prev) => {
            const currEvents = state.events || {};
            const prevEventIds = Object.keys(prev.events || {});
            const currEventIds = Object.keys(currEvents);

            const newEventIds = currEventIds.filter(id => !prevEventIds.includes(id));
            if (newEventIds.length === 0) return ['New event occurred'];

            // Get up to 3 newest events
            const messages = [];
            for (const id of newEventIds.slice(0, 3)) {
                const evt = currEvents[id];
                // Clean HTML tags from event text
                const text = (evt?.event || '').replace(/<[^>]*>/g, '');
                if (text) messages.push(text.substring(0, 100));
            }

            if (newEventIds.length > 3) {
                messages.push(`*+${newEventIds.length - 3} more events*`);
            }

            return messages.length > 0 ? messages : ['New event occurred'];
        }
    },
};

/**
 * Get alerts by API group
 */
export function getAlertsByApiGroup(apiGroup) {
    return Object.values(ALERTS).filter(a => a.apiGroup === apiGroup);
}

/**
 * Get alerts by poll interval
 */
export function getAlertsByInterval(interval) {
    return Object.values(ALERTS).filter(a => a.pollInterval === interval);
}

/**
 * Get all unique API groups
 */
export function getAllApiGroups() {
    return [...new Set(Object.values(ALERTS).map(a => a.apiGroup))];
}
