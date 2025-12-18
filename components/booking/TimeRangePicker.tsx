'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { POLICIES } from '@/lib/policies';
import { AlertCircle, CheckCircle2, ChevronDown, Zap, Clock, Sparkles } from 'lucide-react';

interface BusySlot {
    start: string; // HH:MM format
    end: string;
}

interface TimeRangePickerProps {
    date: string; // YYYY-MM-DD
    busySlots: BusySlot[];
    workingHours: { start: string; end: string }; // HH:MM format
    onSelect: (start: Date, end: Date) => void;
    isGroupBooking?: boolean;
}

// Duration options in minutes
const DURATION_OPTIONS = [
    { label: '15 min', value: 15, icon: '⚡' },
    { label: '30 min', value: 30, icon: '🕐' },
    { label: '45 min', value: 45, icon: '🕑' },
    { label: '1 hour', value: 60, icon: '⏰' },
    { label: '1.5 hours', value: 90, icon: '🕒' },
    { label: '2 hours', value: 120, icon: '🕓' },
];

// Get current IST time in minutes since midnight
function getISTCurrentTimeMinutes(): number {
    const now = new Date();
    const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(istString);
    return istDate.getHours() * 60 + istDate.getMinutes();
}

// Get today's date in IST as YYYY-MM-DD
function getISTTodayString(): string {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    return formatter.format(now);
}

export default function TimeRangePicker({
    date,
    busySlots,
    workingHours,
    onSelect,
    isGroupBooking = false,
}: TimeRangePickerProps) {
    const [selectedStartTime, setSelectedStartTime] = useState<number | null>(null);
    const [selectedDuration, setSelectedDuration] = useState<number>(30);
    const [showStartDropdown, setShowStartDropdown] = useState(false);
    const [showDurationDropdown, setShowDurationDropdown] = useState(false);
    const [noSlotsAvailable, setNoSlotsAvailable] = useState<boolean>(false);

    // Reset selection when date changes
    useEffect(() => {
        setSelectedStartTime(null);
        setNoSlotsAvailable(false);
    }, [date]);

    const startDropdownRef = useRef<HTMLDivElement>(null);
    const durationDropdownRef = useRef<HTMLDivElement>(null);
    const onSelectRef = useRef(onSelect);

    // Keep onSelectRef up to date
    useEffect(() => {
        onSelectRef.current = onSelect;
    }, [onSelect]);

    // State for current time that updates periodically
    const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number>(getISTCurrentTimeMinutes);

    // Update current time every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTimeMinutes(getISTCurrentTimeMinutes());
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (startDropdownRef.current && !startDropdownRef.current.contains(event.target as Node)) {
                setShowStartDropdown(false);
            }
            if (durationDropdownRef.current && !durationDropdownRef.current.contains(event.target as Node)) {
                setShowDurationDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Convert HH:MM to minutes since midnight
    const parseTime = (timeStr: string): number => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };

    // Convert minutes since midnight to HH:MM in 12-hour format
    const formatTime12 = (minutes: number): string => {
        const hours24 = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const hours12 = hours24 % 12 || 12;
        const ampm = hours24 < 12 ? 'AM' : 'PM';
        return `${hours12}:${mins.toString().padStart(2, '0')} ${ampm}`;
    };

    // Convert minutes to HH:MM format
    const formatTimeHHMM = (minutes: number): string => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    const workStart = parseTime(workingHours.start);
    const workEnd = parseTime(workingHours.end);
    const totalMinutes = workEnd - workStart;

    // Check if date is today in IST - using the same function as the page
    const isToday = useMemo(() => {
        const todayIST = getISTTodayString();
        return date === todayIST;
    }, [date]);

    // Calculate the earliest bookable time - returns workEnd + 1 if past working hours
    const earliestBookableTime = useMemo(() => {
        if (!isToday) return workStart;

        // Add grace period for network latency (2 minutes)
        const gracePeriod = 2;
        const earliestTime = Math.ceil((currentTimeMinutes + gracePeriod) / 15) * 15;

        // If current time is past working hours, return a value > workEnd to indicate no slots
        if (earliestTime >= workEnd) {
            return workEnd + 1; // No slots available
        }

        return Math.max(earliestTime, workStart);
    }, [isToday, currentTimeMinutes, workStart, workEnd]);

    // Calculate position percentage for timeline
    const getPosition = (minutes: number): number => {
        return ((minutes - workStart) / totalMinutes) * 100;
    };

    // Check if a range overlaps with busy slots or past time
    const isRangeValid = (start: number, end: number): boolean => {
        if (start < workStart || end > workEnd) return false;
        if (end - start < POLICIES.MIN_BOOKING_DURATION_MINUTES) return false;
        if (end - start > POLICIES.MAX_BOOKING_DURATION_MINUTES) return false;

        // If earliest bookable time is past working hours, no slots are valid
        if (earliestBookableTime > workEnd) return false;
        if (start < earliestBookableTime) return false;

        for (const slot of busySlots) {
            const slotStart = parseTime(slot.start);
            const slotEnd = parseTime(slot.end);
            if (start < slotEnd && end > slotStart) return false;
        }

        return true;
    };

    // Generate available start times (15-minute increments)
    const availableStartTimes = useMemo(() => {
        const times: number[] = [];

        // If no slots available (past working hours), return empty
        if (earliestBookableTime > workEnd) {
            return times;
        }

        for (let t = earliestBookableTime; t <= workEnd - POLICIES.MIN_BOOKING_DURATION_MINUTES; t += 15) {
            // Check if at least minimum duration is available from this start time
            let isValid = true;
            const end = t + POLICIES.MIN_BOOKING_DURATION_MINUTES;

            // Check against busy slots
            for (const slot of busySlots) {
                const slotStart = parseTime(slot.start);
                const slotEnd = parseTime(slot.end);
                if (t < slotEnd && end > slotStart) {
                    isValid = false;
                    break;
                }
            }

            if (isValid) {
                times.push(t);
            }
        }

        return times;
    }, [date, busySlots, earliestBookableTime, workEnd]);

    // Get available durations for the selected start time
    const availableDurations = useMemo(() => {
        if (selectedStartTime === null) return DURATION_OPTIONS;

        return DURATION_OPTIONS.filter(option => {
            const end = selectedStartTime + option.value;
            return end <= workEnd && isRangeValid(selectedStartTime, end);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStartTime, busySlots, workEnd, earliestBookableTime]);

    // Generate quick slots (pre-computed available time ranges)
    const quickSlots = useMemo(() => {
        const slots: Array<{ start: number; end: number }> = [];

        // If no slots available, return empty
        if (earliestBookableTime > workEnd) {
            return slots;
        }

        // Find gaps between busy slots
        const sortedBusy = [...busySlots]
            .map(s => ({ start: parseTime(s.start), end: parseTime(s.end) }))
            .sort((a, b) => a.start - b.start);

        let searchStart = earliestBookableTime;

        // Add the end of working hours as a virtual busy slot
        const busyWithEnd = [...sortedBusy, { start: workEnd, end: workEnd }];

        for (const busy of busyWithEnd) {
            // Found a gap
            if (searchStart < busy.start) {
                // Try to fit slots in this gap
                let slotStart = searchStart;
                while (slotStart + 30 <= busy.start && slots.length < 6) {
                    // Default to 30-minute slots, but adjust if less time available
                    let slotDuration = 30;
                    if (slotStart + 60 <= busy.start) {
                        slotDuration = 60; // Prefer 1-hour slots if space allows
                    }

                    // Direct validation
                    const end = slotStart + slotDuration;
                    if (end <= workEnd && end - slotStart >= POLICIES.MIN_BOOKING_DURATION_MINUTES) {
                        let isValid = true;
                        for (const s of busySlots) {
                            const sStart = parseTime(s.start);
                            const sEnd = parseTime(s.end);
                            if (slotStart < sEnd && end > sStart) {
                                isValid = false;
                                break;
                            }
                        }
                        if (isValid) {
                            slots.push({ start: slotStart, end });
                        }
                    }
                    slotStart += slotDuration;
                }
            }
            searchStart = Math.max(searchStart, busy.end);
        }

        return slots.slice(0, 6); // Max 6 quick slots
    }, [date, busySlots, earliestBookableTime, workEnd]);

    // Auto-select first available slot on mount
    useEffect(() => {
        if (availableStartTimes.length > 0 && selectedStartTime === null) {
            const firstStart = availableStartTimes[0];
            setSelectedStartTime(firstStart);

            // Find best duration for this start time
            const validDurations = DURATION_OPTIONS.filter(d => isRangeValid(firstStart, firstStart + d.value));
            if (validDurations.length > 0) {
                // Prefer 30 min or closest available
                const preferred = validDurations.find(d => d.value === 30) || validDurations[0];
                setSelectedDuration(preferred.value);
            }
            setNoSlotsAvailable(false);
        } else if (availableStartTimes.length === 0) {
            setNoSlotsAvailable(true);
            setSelectedStartTime(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [availableStartTimes]);

    // When duration changes, validate and adjust if needed
    useEffect(() => {
        if (selectedStartTime !== null) {
            if (!isRangeValid(selectedStartTime, selectedStartTime + selectedDuration)) {
                // Find first valid duration
                const validDuration = availableDurations[0];
                if (validDuration) {
                    setSelectedDuration(validDuration.value);
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStartTime, selectedDuration, availableDurations]);

    // Notify parent when selection changes
    useEffect(() => {
        if (selectedStartTime !== null && isRangeValid(selectedStartTime, selectedStartTime + selectedDuration)) {
            const startDate = new Date(`${date}T${formatTimeHHMM(selectedStartTime)}:00+05:30`);
            const endDate = new Date(`${date}T${formatTimeHHMM(selectedStartTime + selectedDuration)}:00+05:30`);
            onSelectRef.current(startDate, endDate);
        }
    }, [selectedStartTime, selectedDuration, date]);

    // Select a quick slot
    const handleQuickSlotSelect = (start: number, end: number) => {
        setSelectedStartTime(start);
        setSelectedDuration(end - start);
    };

    // Generate hour markers
    const hourMarkers = [];
    for (let hour = Math.ceil(workStart / 60); hour <= Math.floor(workEnd / 60); hour++) {
        const minutes = hour * 60;
        if (minutes >= workStart && minutes <= workEnd) {
            hourMarkers.push({
                minutes,
                position: getPosition(minutes),
                label: formatTime12(minutes).replace(':00 ', ' '),
            });
        }
    }

    const selectedEnd = selectedStartTime !== null ? selectedStartTime + selectedDuration : null;
    const isCurrentSelectionValid = selectedStartTime !== null && selectedEnd !== null && isRangeValid(selectedStartTime, selectedEnd);

    // For timeline display, cap at workEnd
    const timelineEarliestBookable = Math.min(earliestBookableTime, workEnd);

    return (
        <div className="space-y-5">
            {/* Modern Timeline */}
            <div className="relative">
                {/* Timeline Container with glass effect */}
                <div className="relative bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-black/92 rounded-2xl p-5 border border-white/[0.06] backdrop-blur-xl shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-white">Availability</h3>
                                <p className="text-xs text-slate-400">{formatTime12(workStart)} – {formatTime12(workEnd)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
                            {/* Mobile: Simplified legend */}
                            <div className="flex sm:hidden items-center gap-3 text-[10px]">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400"></span>Free</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400"></span>Busy</span>
                            </div>
                            {/* Desktop: Full legend */}
                            <div className="hidden sm:flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                                <span className="text-xs text-slate-400">Available</span>
                            </div>
                            <div className="hidden sm:flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                                <span className="text-xs text-slate-400">Booked</span>
                            </div>
                            <div className="hidden sm:flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                                <span className="text-xs text-slate-400">Past</span>
                            </div>
                        </div>
                    </div>

                    {/* Hour labels */}
                    <div className="relative h-6 mb-2 mx-1">
                        {hourMarkers.filter((_, i) => i % 2 === 0 || hourMarkers.length <= 7).map((marker, i) => (
                            <div
                                key={i}
                                className="absolute transform -translate-x-1/2"
                                style={{ left: `${marker.position}%` }}
                            >
                                <span className="text-xs font-medium text-slate-500">{marker.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Main Timeline - Rectangular Bar */}
                    <div className="relative h-12 rounded-sm bg-slate-900/60 border border-slate-800/60 overflow-hidden">
                        {/* Available zone - Solid green */}
                        {earliestBookableTime <= workEnd && (
                            <div
                                className="absolute inset-y-0 bg-green-600/50 transition-all duration-500"
                                style={{
                                    left: isToday ? `${getPosition(timelineEarliestBookable)}%` : '0%',
                                    right: '0%',
                                    borderLeft: isToday ? '2px solid rgb(34, 197, 94)' : 'none',
                                }}
                            />
                        )}

                        {/* Past time zone */}
                        {isToday && (
                            <div
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-slate-950/85 via-slate-900/80 to-slate-900/60"
                                style={{ width: earliestBookableTime > workEnd ? '100%' : `${getPosition(timelineEarliestBookable)}%` }}
                            >
                                <div className="absolute inset-0" style={{
                                    backgroundImage: 'repeating-linear-gradient(60deg, transparent, transparent 4px, rgba(100,116,139,0.12) 4px, rgba(100,116,139,0.12) 8px)'
                                }} />
                            </div>
                        )}

                        {/* Busy slots - Solid red */}
                        {busySlots.map((slot, index) => {
                            const slotStart = parseTime(slot.start);
                            const slotEnd = parseTime(slot.end);
                            const left = getPosition(slotStart);
                            const width = getPosition(slotEnd) - left;
                            return (
                                <div
                                    key={index}
                                    className="absolute inset-y-1 rounded-sm bg-red-500/70 border border-red-400"
                                    style={{ left: `${left}%`, width: `${width}%` }}
                                />
                            );
                        })}

                        {/* Hour grid lines */}
                        {hourMarkers.map((marker, i) => (
                            <div key={i} className="absolute inset-y-0" style={{ left: `${marker.position}%` }}>
                                <div className="w-px h-full bg-slate-700/40" />
                            </div>
                        ))}

                        {/* Current time indicator */}
                        {isToday && currentTimeMinutes >= workStart && currentTimeMinutes <= workEnd && (
                            <div className="absolute inset-y-0 z-20" style={{ left: `${getPosition(currentTimeMinutes)}%` }}>
                                <div className="absolute inset-y-0 w-0.5 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.7)]" />
                                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
                                    <span className="text-[9px] font-bold text-amber-400 bg-slate-900/90 px-1.5 py-0.5 rounded-sm">NOW</span>
                                </div>
                            </div>
                        )}

                        {/* Selected Range */}
                        {selectedStartTime !== null && selectedEnd !== null && (
                            <div
                                className={`absolute inset-y-1 rounded-sm transition-all duration-300 z-10 ${isCurrentSelectionValid
                                    ? 'bg-gradient-to-r from-cyan-500/28 via-blue-500/24 to-cyan-500/28 border-2 border-cyan-400/55 shadow-[0_0_14px_rgba(34,211,238,0.2)]'
                                    : 'bg-gradient-to-r from-amber-500/30 via-orange-500/24 to-amber-500/30 border-2 border-amber-400/55'
                                    }`}
                                style={{
                                    left: `${getPosition(selectedStartTime)}%`,
                                    width: `${getPosition(selectedEnd) - getPosition(selectedStartTime)}%`,
                                }}
                            >
                                {isCurrentSelectionValid && (
                                    <div className="absolute inset-0 rounded-sm overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent animate-shimmer" />
                                    </div>
                                )}
                                {/* Time labels on selection */}
                                <div className="absolute inset-x-0 -bottom-5 flex justify-between px-0.5">
                                    <span className="text-[8px] font-bold text-cyan-300 bg-slate-950/90 px-1 rounded-sm">{formatTime12(selectedStartTime).replace(' ', '')}</span>
                                    <span className="text-[8px] font-bold text-cyan-300 bg-slate-950/90 px-1 rounded-sm">{formatTime12(selectedEnd).replace(' ', '')}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Timeline ticks */}
                    <div className="relative h-2 mt-1 mx-1">
                        {hourMarkers.map((marker, i) => (
                            <div key={i} className="absolute top-0 w-px h-1.5 bg-slate-700" style={{ left: `${marker.position}%` }} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Time Selection Controls - Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Start Time Dropdown */}
                <div className="relative" ref={startDropdownRef}>
                    <label className="block text-xs font-semibold text-text-muted/80 mb-2 uppercase tracking-wide">
                        Start Time
                    </label>
                    <button
                        onClick={() => setShowStartDropdown(!showStartDropdown)}
                        disabled={noSlotsAvailable}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border backdrop-blur-sm transition-all duration-300 group ${showStartDropdown
                            ? 'bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                            : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20'
                            } ${noSlotsAvailable ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Clock className={`w-4 h-4 ${selectedStartTime !== null ? 'text-blue-400' : 'text-text-muted/50'}`} />
                            <span className={`font-semibold ${selectedStartTime !== null ? 'text-text-main' : 'text-text-muted/60'}`}>
                                {selectedStartTime !== null ? formatTime12(selectedStartTime) : 'Select...'}
                            </span>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-text-muted/50 transition-transform duration-300 ${showStartDropdown ? 'rotate-180 text-blue-400' : 'group-hover:text-text-muted'}`} />
                    </button>

                    {showStartDropdown && availableStartTimes.length > 0 && (
                        <div className="absolute z-50 w-full mt-2 py-1 bg-gray-900/95 border border-white/10 rounded-xl shadow-2xl max-h-52 overflow-y-auto backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                            {availableStartTimes.map((time, i) => (
                                <button
                                    key={time}
                                    onClick={() => {
                                        setSelectedStartTime(time);
                                        setShowStartDropdown(false);
                                    }}
                                    className={`w-full px-4 py-2 text-left transition-all duration-150 flex items-center justify-between ${selectedStartTime === time
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : 'text-text-main hover:bg-white/5'
                                        } ${i === 0 ? 'rounded-t-lg' : ''} ${i === availableStartTimes.length - 1 ? 'rounded-b-lg' : ''}`}
                                >
                                    <span className="font-medium">{formatTime12(time)}</span>
                                    {selectedStartTime === time && (
                                        <CheckCircle2 className="w-4 h-4 text-blue-400" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Duration Dropdown */}
                <div className="relative" ref={durationDropdownRef}>
                    <label className="block text-xs font-semibold text-text-muted/80 mb-2 uppercase tracking-wide">
                        Duration
                    </label>
                    <button
                        onClick={() => setShowDurationDropdown(!showDurationDropdown)}
                        disabled={noSlotsAvailable || selectedStartTime === null}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border backdrop-blur-sm transition-all duration-300 group ${showDurationDropdown
                            ? 'bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                            : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20'
                            } ${(noSlotsAvailable || selectedStartTime === null) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-base">{DURATION_OPTIONS.find(d => d.value === selectedDuration)?.icon || '🕐'}</span>
                            <span className="font-semibold text-text-main">
                                {DURATION_OPTIONS.find(d => d.value === selectedDuration)?.label || `${selectedDuration} min`}
                            </span>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-text-muted/50 transition-transform duration-300 ${showDurationDropdown ? 'rotate-180 text-purple-400' : 'group-hover:text-text-muted'}`} />
                    </button>

                    {showDurationDropdown && (
                        <div className="absolute z-50 w-full mt-2 py-1 bg-gray-900/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                            {availableDurations.length > 0 ? availableDurations.map((option, i) => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        setSelectedDuration(option.value);
                                        setShowDurationDropdown(false);
                                    }}
                                    className={`w-full px-4 py-2 text-left transition-all duration-150 flex items-center justify-between ${selectedDuration === option.value
                                        ? 'bg-purple-500/20 text-purple-400'
                                        : 'text-text-main hover:bg-white/5'
                                        } ${i === 0 ? 'rounded-t-lg' : ''} ${i === availableDurations.length - 1 ? 'rounded-b-lg' : ''}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span>{option.icon}</span>
                                        <span className="font-medium">{option.label}</span>
                                    </div>
                                    {selectedDuration === option.value && (
                                        <CheckCircle2 className="w-4 h-4 text-purple-400" />
                                    )}
                                </button>
                            )) : (
                                <div className="px-4 py-3 text-text-muted/60 text-sm text-center">
                                    No durations available
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Slots - Horizontal scroll with pills */}
            {quickSlots.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-400" />
                        <span className="text-sm font-semibold text-text-muted/80 uppercase tracking-wide">Quick Pick</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 sm:flex-wrap scrollbar-hide">
                        {quickSlots.map((slot, i) => {
                            const isSelected = selectedStartTime === slot.start && selectedDuration === (slot.end - slot.start);
                            return (
                                <button
                                    key={i}
                                    onClick={() => handleQuickSlotSelect(slot.start, slot.end)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${isSelected
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 scale-105'
                                        : 'bg-white/[0.03] text-text-main border border-white/10 hover:bg-white/[0.08] hover:border-amber-500/30 hover:text-amber-400'
                                        }`}
                                >
                                    {formatTime12(slot.start)} – {formatTime12(slot.end)}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Selection Summary Card */}
            {selectedStartTime !== null && selectedEnd !== null ? (
                <div className={`relative overflow-hidden rounded-2xl p-4 transition-all duration-500 ${isCurrentSelectionValid
                    ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20'
                    : 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20'
                    }`}>
                    {/* Subtle glow effect */}
                    <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl ${isCurrentSelectionValid ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                        }`} />

                    <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isCurrentSelectionValid
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-amber-500/20 text-amber-400'
                                }`}>
                                {isCurrentSelectionValid ? (
                                    <Sparkles className="w-6 h-6" />
                                ) : (
                                    <AlertCircle className="w-6 h-6" />
                                )}
                            </div>
                            <div>
                                <p className="text-xs text-text-muted/70 uppercase tracking-wide font-semibold">
                                    {isCurrentSelectionValid ? 'Your Booking' : 'Invalid Time'}
                                </p>
                                <p className="text-xl font-bold text-text-main">
                                    {formatTime12(selectedStartTime)} – {formatTime12(selectedEnd)}
                                </p>
                            </div>
                        </div>
                        <div className="text-left sm:text-right">
                            <p className="text-xs text-text-muted/70 uppercase tracking-wide font-semibold">Duration</p>
                            <p className={`text-3xl font-black ${isCurrentSelectionValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {selectedDuration >= 60
                                    ? `${Math.floor(selectedDuration / 60)}h${selectedDuration % 60 > 0 ? ` ${selectedDuration % 60}m` : ''}`
                                    : `${selectedDuration}m`
                                }
                            </p>
                        </div>
                    </div>
                </div>
            ) : noSlotsAvailable ? (
                <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent border border-red-500/20">
                    <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl bg-red-500/10" />
                    <div className="relative flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/20 text-red-400">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm text-red-300 font-semibold">No available slots</p>
                            <p className="text-xs text-red-400/60 mt-0.5">
                                {isToday
                                    ? 'Working hours have ended. Try a different date.'
                                    : 'All slots are booked. Try another date.'
                                }
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl p-4 bg-gradient-to-br from-gray-500/10 to-transparent border border-white/5 text-center">
                    <p className="text-sm text-text-muted/60">
                        Select a start time and duration above
                    </p>
                </div>
            )}

            {/* Booking Rules - Modern Pills */}
            <div className="flex flex-wrap items-center justify-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-slate-800/80 to-slate-900/80 border border-slate-700/50 backdrop-blur-sm">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6l4 2" /></svg>
                    </div>
                    <span className="text-xs font-medium text-slate-300">Min <span className="text-emerald-400 font-semibold">{POLICIES.MIN_BOOKING_DURATION_MINUTES}m</span></span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-slate-800/80 to-slate-900/80 border border-slate-700/50 backdrop-blur-sm">
                    <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <span className="text-xs font-medium text-slate-300">Max <span className="text-blue-400 font-semibold">{POLICIES.MAX_BOOKING_DURATION_MINUTES / 60}h</span></span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-slate-800/80 to-slate-900/80 border border-slate-700/50 backdrop-blur-sm">
                    <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center">
                        <svg className="w-3 h-3 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <span className="text-xs font-medium text-slate-300">Hours <span className="text-violet-400 font-semibold">{formatTime12(workStart).replace(':00 ', '')} – {formatTime12(workEnd).replace(':00 ', '')}</span></span>
                </div>
                {isGroupBooking && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 backdrop-blur-sm">
                        <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        </div>
                        <span className="text-xs font-medium text-amber-300">{POLICIES.GROUP_BOOKING_CUTOFF_MINUTES}m advance notice</span>
                    </div>
                )}
            </div>
        </div>
    );
}
