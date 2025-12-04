'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { POLICIES } from '@/lib/policies';
import { Clock, AlertCircle, CheckCircle2, GripVertical } from 'lucide-react';

interface BusySlot {
    start: string; // HH:MM format
    end: string;
}

interface TimeRangePickerProps {
    date: string; // YYYY-MM-DD
    busySlots: BusySlot[];
    workingHours: { start: string; end: string }; // HH:MM format
    onSelect: (start: Date, end: Date) => void;
    resourceId: string;
    isGroupBooking?: boolean;
}

export default function TimeRangePicker({
    date,
    busySlots,
    workingHours,
    onSelect,
    isGroupBooking = false,
}: TimeRangePickerProps) {
    const [selectedStart, setSelectedStart] = useState<number | null>(null);
    const [selectedEnd, setSelectedEnd] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState<'start' | 'end' | 'move' | null>(null);
    const [dragStartX, setDragStartX] = useState<number>(0);
    const [initialRange, setInitialRange] = useState<{ start: number; end: number } | null>(null);
    const [hoverMinutes, setHoverMinutes] = useState<number | null>(null);
    const [hoverHandle, setHoverHandle] = useState<'start' | 'end' | null>(null);
    const [isCurrentSelectionValid, setIsCurrentSelectionValid] = useState<boolean>(true);
    const timelineRef = useRef<HTMLDivElement>(null);
    const onSelectRef = useRef(onSelect);

    // Keep onSelectRef up to date
    useEffect(() => {
        onSelectRef.current = onSelect;
    }, [onSelect]);

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

    // Get current time in minutes for "now" line
    const now = new Date();
    // Get current IST time
    const istOffset = 5.5 * 60; // IST is UTC+5:30
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const currentMinutes = (utcMinutes + istOffset) % (24 * 60);

    // Check if date is today in IST
    const todayIST = new Date(now.getTime() + (istOffset - now.getTimezoneOffset()) * 60000)
        .toISOString().split('T')[0];
    const isToday = date === todayIST;

    // Calculate the earliest bookable time
    const getEarliestBookableTime = (): number => {
        if (!isToday) return workStart;

        // Add grace period for network latency (2 minutes)
        const gracePeriod = 2;
        const earliestTime = Math.ceil((currentMinutes + gracePeriod) / 5) * 5; // Round up to nearest 5 minutes

        return Math.max(earliestTime, workStart);
    };

    // Calculate position percentage
    const getPosition = (minutes: number): number => {
        return ((minutes - workStart) / totalMinutes) * 100;
    };

    // Get minutes from position
    const getMinutesFromPosition = (percent: number): number => {
        return workStart + (percent / 100) * totalMinutes;
    };

    // Check if a specific minute is in a busy slot
    const isInBusySlot = (minute: number): boolean => {
        for (const slot of busySlots) {
            const slotStart = parseTime(slot.start);
            const slotEnd = parseTime(slot.end);
            if (minute >= slotStart && minute < slotEnd) {
                return true;
            }
        }
        return false;
    };

    // Check if a range overlaps with busy slots or past time
    const isRangeValid = useCallback((start: number, end: number): boolean => {
        // Check within working hours
        if (start < workStart || end > workEnd) {
            return false;
        }

        // Check minimum duration
        if (end - start < POLICIES.MIN_BOOKING_DURATION_MINUTES) {
            return false;
        }

        // Check maximum duration
        if (end - start > POLICIES.MAX_BOOKING_DURATION_MINUTES) {
            return false;
        }

        // Check if in past
        const earliestTime = getEarliestBookableTime();
        if (start < earliestTime) {
            return false;
        }

        // Check overlap with busy slots
        for (const slot of busySlots) {
            const slotStart = parseTime(slot.start);
            const slotEnd = parseTime(slot.end);

            if (start < slotEnd && end > slotStart) {
                return false; // Overlap detected
            }
        }

        return true;
    }, [busySlots, isToday, currentMinutes, workStart, workEnd]);

    // Adjust range to nearest valid configuration
    const adjustToValidRange = (
        start: number,
        end: number,
        dragType: 'start' | 'end' | 'move' | null
    ): { start: number; end: number } | null => {
        // Priority 1: If valid as-is, return immediately
        if (isRangeValid(start, end)) {
            return { start, end };
        }

        const minDuration = POLICIES.MIN_BOOKING_DURATION_MINUTES;
        const maxDuration = POLICIES.MAX_BOOKING_DURATION_MINUTES;
        const currentDuration = end - start;

        // Priority 2: Based on drag type, preserve the user's intent
        if (dragType === 'end') {
            // User was adjusting end handle - keep start COMPLETELY FIXED, find nearest valid end
            // Search in expanding circles from the dragged position
            for (let offset = 0; offset <= 120; offset += 5) {
                // Try moving end down (shrinking)
                const newEnd1 = end - offset;
                if (newEnd1 - start >= minDuration && newEnd1 - start <= maxDuration) {
                    if (isRangeValid(start, newEnd1)) {
                        return { start, end: newEnd1 };
                    }
                }

                // Try moving end up (growing)  
                if (offset > 0) {
                    const newEnd2 = end + offset;
                    if (newEnd2 - start >= minDuration && newEnd2 - start <= maxDuration) {
                        if (isRangeValid(start, newEnd2)) {
                            return { start, end: newEnd2 };
                        }
                    }
                }
            }
        } else if (dragType === 'start') {
            // User was adjusting start handle - keep end COMPLETELY FIXED, find nearest valid start
            // Search in expanding circles from the dragged position
            for (let offset = 0; offset <= 120; offset += 5) {
                // Try moving start up (shrinking)
                const newStart1 = start + offset;
                if (end - newStart1 >= minDuration && end - newStart1 <= maxDuration) {
                    if (isRangeValid(newStart1, end)) {
                        return { start: newStart1, end };
                    }
                }

                // Try moving start down (growing)
                if (offset > 0) {
                    const newStart2 = start - offset;
                    if (end - newStart2 >= minDuration && end - newStart2 <= maxDuration) {
                        if (isRangeValid(newStart2, end)) {
                            return { start: newStart2, end };
                        }
                    }
                }
            }
        } else if (dragType === 'move') {
            // User was moving the entire selection - try to keep duration COMPLETELY FIXED first
            // Search in expanding circles from the dragged position
            for (let offset = 0; offset <= 120; offset += 5) {
                // Try shifting right
                if (offset === 0) {
                    if (isRangeValid(start, end)) {
                        return { start, end };
                    }
                } else {
                    const newStart1 = start + offset;
                    const newEnd1 = end + offset;
                    if (isRangeValid(newStart1, newEnd1)) {
                        return { start: newStart1, end: newEnd1 };
                    }

                    // Try shifting left
                    const newStart2 = start - offset;
                    const newEnd2 = end - offset;
                    if (isRangeValid(newStart2, newEnd2)) {
                        return { start: newStart2, end: newEnd2 };
                    }
                }
            }

            // If can't shift with same duration, try small duration adjustments while shifting
            for (let durationAdjust = 5; durationAdjust <= 30; durationAdjust += 5) {
                // Try slightly smaller duration
                const shorterDuration = currentDuration - durationAdjust;
                if (shorterDuration >= minDuration) {
                    for (let offset = 0; offset <= 60; offset += 5) {
                        if (offset === 0) {
                            if (isRangeValid(start, start + shorterDuration)) {
                                return { start, end: start + shorterDuration };
                            }
                        } else {
                            if (isRangeValid(start + offset, start + offset + shorterDuration)) {
                                return { start: start + offset, end: start + offset + shorterDuration };
                            }
                            if (isRangeValid(start - offset, start - offset + shorterDuration)) {
                                return { start: start - offset, end: start - offset + shorterDuration };
                            }
                        }
                    }
                }

                // Try slightly larger duration
                const longerDuration = currentDuration + durationAdjust;
                if (longerDuration <= maxDuration) {
                    for (let offset = 0; offset <= 60; offset += 5) {
                        if (offset === 0) {
                            if (isRangeValid(start, start + longerDuration)) {
                                return { start, end: start + longerDuration };
                            }
                        } else {
                            if (isRangeValid(start + offset, start + offset + longerDuration)) {
                                return { start: start + offset, end: start + offset + longerDuration };
                            }
                            if (isRangeValid(start - offset, start - offset + longerDuration)) {
                                return { start: start - offset, end: start - offset + longerDuration };
                            }
                        }
                    }
                }
            }
        }

        // Priority 3: Last resort - search for ANY valid slot near the current position
        // Try to maintain SOME aspect of the user's selection
        // Start with current duration and search outward
        for (let durationChange = 0; durationChange <= Math.max(Math.abs(currentDuration - minDuration), Math.abs(maxDuration - currentDuration)); durationChange += 5) {
            // Try current duration ± change
            const durations = durationChange === 0 ? [currentDuration] : [currentDuration - durationChange, currentDuration + durationChange];

            for (const testDuration of durations) {
                if (testDuration < minDuration || testDuration > maxDuration) continue;

                // Try different start positions around the original start
                for (let startOffset = 0; startOffset <= 120; startOffset += 5) {
                    const testStarts = startOffset === 0 ? [start] : [start + startOffset, start - startOffset];

                    for (const testStart of testStarts) {
                        const testEnd = testStart + testDuration;
                        if (isRangeValid(testStart, testEnd)) {
                            return { start: testStart, end: testEnd };
                        }
                    }
                }
            }
        }

        return null; // Revert to initialRange
    };

    // Find the next available slot starting from a given minute
    const findNextAvailableSlot = (fromMinute: number): { start: number; end: number } | null => {
        const earliestTime = getEarliestBookableTime();
        let searchStart = Math.max(fromMinute, earliestTime);

        // Round up to nearest 5 minutes
        searchStart = Math.ceil(searchStart / 5) * 5;

        // Try to find a 30-minute slot
        while (searchStart + 30 <= workEnd) {
            if (isRangeValid(searchStart, searchStart + 30)) {
                return { start: searchStart, end: searchStart + 30 };
            }
            searchStart += 5;
        }

        // If no 30-min slot, try minimum duration
        searchStart = Math.max(fromMinute, earliestTime);
        searchStart = Math.ceil(searchStart / 5) * 5;

        while (searchStart + POLICIES.MIN_BOOKING_DURATION_MINUTES <= workEnd) {
            if (isRangeValid(searchStart, searchStart + POLICIES.MIN_BOOKING_DURATION_MINUTES)) {
                return { start: searchStart, end: searchStart + POLICIES.MIN_BOOKING_DURATION_MINUTES };
            }
            searchStart += 5;
        }

        return null;
    };

    // Auto-select first available slot on mount
    useEffect(() => {
        if (selectedStart === null && selectedEnd === null) {
            const slot = findNextAvailableSlot(workStart);
            if (slot) {
                setSelectedStart(slot.start);
                setSelectedEnd(slot.end);
                setIsCurrentSelectionValid(true);
            }
        }
    }, [date, busySlots]);

    // Handle timeline click to set initial selection
    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!timelineRef.current || isDragging) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickPercent = (clickX / rect.width) * 100;
        const clickMinutes = getMinutesFromPosition(clickPercent);

        // Round to nearest 5 minutes
        const roundedMinutes = Math.round(clickMinutes / 5) * 5;

        // Set initial selection (30 minutes by default, or max available)
        let proposedEnd = Math.min(roundedMinutes + 30, workEnd);

        // Check if selection is valid, if not try to find valid end
        if (!isRangeValid(roundedMinutes, proposedEnd)) {
            // Try to find a valid range starting from clicked position
            for (let duration = 30; duration >= POLICIES.MIN_BOOKING_DURATION_MINUTES; duration -= 5) {
                proposedEnd = roundedMinutes + duration;
                if (isRangeValid(roundedMinutes, proposedEnd)) {
                    break;
                }
            }
        }

        if (isRangeValid(roundedMinutes, proposedEnd)) {
            setSelectedStart(roundedMinutes);
            setSelectedEnd(proposedEnd);
            setIsCurrentSelectionValid(true);
        }
    };

    // Handle mouse move for hover effect
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!timelineRef.current) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mousePercent = Math.max(0, Math.min(100, (mouseX / rect.width) * 100));
        const mouseMinutes = Math.round(getMinutesFromPosition(mousePercent) / 5) * 5;

        setHoverMinutes(mouseMinutes);
    };

    const handleMouseLeave = () => {
        setHoverMinutes(null);
    };

    // Handle drag start
    const handleMouseDown = (handle: 'start' | 'end' | 'move') => (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsDragging(handle);
        setDragStartX(e.clientX);
        if (selectedStart !== null && selectedEnd !== null) {
            setInitialRange({ start: selectedStart, end: selectedEnd });
        }
    };

    // Handle touch start
    const handleTouchStart = (handle: 'start' | 'end' | 'move') => (e: React.TouchEvent) => {
        e.stopPropagation();
        setIsDragging(handle);
        setDragStartX(e.touches[0].clientX);
        if (selectedStart !== null && selectedEnd !== null) {
            setInitialRange({ start: selectedStart, end: selectedEnd });
        }
    };

    // Handle dragging - FIXED: Allow temporary invalid states
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !timelineRef.current) return;

            const rect = timelineRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mousePercent = Math.max(0, Math.min(100, (mouseX / rect.width) * 100));
            const mouseMinutes = Math.round(getMinutesFromPosition(mousePercent) / 5) * 5;

            if (isDragging === 'start' && selectedEnd !== null) {
                const newStart = Math.max(workStart, Math.min(mouseMinutes, selectedEnd - POLICIES.MIN_BOOKING_DURATION_MINUTES));
                setSelectedStart(newStart);
                setIsCurrentSelectionValid(isRangeValid(newStart, selectedEnd));
            } else if (isDragging === 'end' && selectedStart !== null) {
                const newEnd = Math.min(workEnd, Math.max(mouseMinutes, selectedStart + POLICIES.MIN_BOOKING_DURATION_MINUTES));
                setSelectedEnd(newEnd);
                setIsCurrentSelectionValid(isRangeValid(selectedStart, newEnd));
            } else if (isDragging === 'move' && initialRange) {
                const deltaX = e.clientX - dragStartX;
                const deltaPercent = (deltaX / rect.width) * 100;
                const deltaMinutes = Math.round((deltaPercent / 100) * totalMinutes / 5) * 5;

                const newStart = initialRange.start + deltaMinutes;
                const newEnd = initialRange.end + deltaMinutes;

                // Allow movement even if temporarily invalid
                if (newStart >= workStart && newEnd <= workEnd) {
                    setSelectedStart(newStart);
                    setSelectedEnd(newEnd);
                    setIsCurrentSelectionValid(isRangeValid(newStart, newEnd));
                }
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging || !timelineRef.current) return;

            const rect = timelineRef.current.getBoundingClientRect();
            const touchX = e.touches[0].clientX - rect.left;
            const touchPercent = Math.max(0, Math.min(100, (touchX / rect.width) * 100));
            const touchMinutes = Math.round(getMinutesFromPosition(touchPercent) / 5) * 5;

            if (isDragging === 'start' && selectedEnd !== null) {
                const newStart = Math.max(workStart, Math.min(touchMinutes, selectedEnd - POLICIES.MIN_BOOKING_DURATION_MINUTES));
                setSelectedStart(newStart);
                setIsCurrentSelectionValid(isRangeValid(newStart, selectedEnd));
            } else if (isDragging === 'end' && selectedStart !== null) {
                const newEnd = Math.min(workEnd, Math.max(touchMinutes, selectedStart + POLICIES.MIN_BOOKING_DURATION_MINUTES));
                setSelectedEnd(newEnd);
                setIsCurrentSelectionValid(isRangeValid(selectedStart, newEnd));
            } else if (isDragging === 'move' && initialRange) {
                const deltaX = e.touches[0].clientX - dragStartX;
                const deltaPercent = (deltaX / rect.width) * 100;
                const deltaMinutes = Math.round((deltaPercent / 100) * totalMinutes / 5) * 5;

                const newStart = initialRange.start + deltaMinutes;
                const newEnd = initialRange.end + deltaMinutes;

                if (newStart >= workStart && newEnd <= workEnd) {
                    setSelectedStart(newStart);
                    setSelectedEnd(newEnd);
                    setIsCurrentSelectionValid(isRangeValid(newStart, newEnd));
                }
            }
        };

        const handleMouseUp = () => {
            // Store drag type before clearing it
            const dragType = isDragging;

            // FIXED: Snap to valid range on release if invalid
            if (selectedStart !== null && selectedEnd !== null && !isCurrentSelectionValid) {
                const adjusted = adjustToValidRange(selectedStart, selectedEnd, dragType);
                if (adjusted) {
                    setSelectedStart(adjusted.start);
                    setSelectedEnd(adjusted.end);
                    setIsCurrentSelectionValid(true);
                } else if (initialRange) {
                    // Revert to previous valid state
                    setSelectedStart(initialRange.start);
                    setSelectedEnd(initialRange.end);
                    setIsCurrentSelectionValid(true);
                }
            }
            setIsDragging(null);
            setInitialRange(null);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleTouchMove);
            window.addEventListener('touchend', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [isDragging, selectedStart, selectedEnd, workStart, workEnd, totalMinutes, isRangeValid, dragStartX, initialRange, isCurrentSelectionValid]);

    // Notify parent when selection changes (only if valid)
    useEffect(() => {
        if (selectedStart !== null && selectedEnd !== null && isCurrentSelectionValid) {
            const startDate = new Date(`${date}T${formatTimeHHMM(selectedStart)}:00+05:30`);
            const endDate = new Date(`${date}T${formatTimeHHMM(selectedEnd)}:00+05:30`);
            onSelectRef.current(startDate, endDate);
        }
    }, [selectedStart, selectedEnd, date, isCurrentSelectionValid]);

    const selectedDuration = selectedStart !== null && selectedEnd !== null ? selectedEnd - selectedStart : 0;

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

    // Generate 30-minute markers
    const halfHourMarkers = [];
    for (let hour = Math.ceil(workStart / 60); hour <= Math.floor(workEnd / 60); hour++) {
        const minutes = hour * 60 + 30;
        if (minutes >= workStart && minutes <= workEnd) {
            halfHourMarkers.push({
                minutes,
                position: getPosition(minutes),
            });
        }
    }

    const earliestBookable = getEarliestBookableTime();

    return (
        <div className="space-y-6">
            <style jsx>{`
                @keyframes shimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.5); }
                    50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.8); }
                }
                @keyframes ripple {
                    0% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(1.5); opacity: 0; }
                }
                .shimmer-effect {
                    background: linear-gradient(
                        90deg,
                        rgba(59, 130, 246, 0.8) 0%,
                        rgba(96, 165, 250, 1) 50%,
                        rgba(59, 130, 246, 0.8) 100%
                    );
                    background-size: 200% 100%;
                    animation: shimmer 2s linear infinite;
                }
                .pulse-glow {
                    animation: pulse-glow 2s ease-in-out infinite;
                }
            `}</style>

            {/* Header with legend */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-accent-blue" />
                    <span className="font-semibold text-text-main">Select Your Time</span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-emerald-500 to-emerald-400"></div>
                        <span className="text-text-muted">Available</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-red-500 to-rose-400"></div>
                        <span className="text-text-muted">Booked</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-gray-600"></div>
                        <span className="text-text-muted">Past</span>
                    </div>
                </div>
            </div>

            {/* Timeline Container */}
            <div className="relative">
                {/* Hour markers above timeline */}
                <div className="relative h-6 mb-2">
                    {hourMarkers.map((marker, i) => (
                        <div
                            key={i}
                            className="absolute transform -translate-x-1/2 text-xs text-text-muted font-medium"
                            style={{ left: `${marker.position}%` }}
                        >
                            {marker.label}
                        </div>
                    ))}
                </div>

                {/* Main Timeline */}
                <div
                    ref={timelineRef}
                    className={`relative h-24 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300
                        ${isDragging ? 'ring-2 ring-accent-blue ring-offset-2 ring-offset-bg-dark scale-[1.01]' : ''}
                        bg-gradient-to-b from-gray-800/50 to-gray-900/50 border border-white/5
                        hover:border-white/10`}
                    style={{
                        backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 49px, rgba(255,255,255,0.02) 49px, rgba(255,255,255,0.02) 50px)',
                    }}
                    onClick={handleTimelineClick}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                >
                    {/* Available time background (green gradient) */}
                    <div
                        className="absolute inset-0 bg-gradient-to-r from-emerald-600/30 via-emerald-500/20 to-emerald-600/30"
                        style={{
                            left: isToday ? `${getPosition(earliestBookable)}%` : '0%',
                        }}
                    />

                    {/* Past time overlay (dark with stripes) */}
                    {isToday && earliestBookable > workStart && (
                        <div
                            className="absolute top-0 bottom-0 left-0 bg-gray-800/90"
                            style={{
                                width: `${getPosition(earliestBookable)}%`,
                                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.1) 4px, rgba(0,0,0,0.1) 8px)'
                            }}
                        >
                            <div className="absolute inset-0 flex items-center justify-center">
                                {getPosition(earliestBookable) > 15 && (
                                    <span className="text-xs text-gray-500 font-medium">Past</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Busy slots */}
                    {busySlots.map((slot, index) => {
                        const slotStart = parseTime(slot.start);
                        const slotEnd = parseTime(slot.end);
                        const left = getPosition(slotStart);
                        const width = getPosition(slotEnd) - left;

                        return (
                            <div
                                key={index}
                                className="absolute top-0 bottom-0 bg-gradient-to-b from-red-500/80 to-rose-600/80 border-x border-red-400/30"
                                style={{ left: `${left}%`, width: `${width}%` }}
                            >
                                <div
                                    className="absolute inset-0"
                                    style={{
                                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 6px)'
                                    }}
                                />
                                {width > 8 && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-[10px] text-white/90 font-medium px-1 truncate">Booked</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Hour grid lines */}
                    {hourMarkers.map((marker, i) => (
                        <div
                            key={i}
                            className="absolute top-0 bottom-0 w-px bg-white/10"
                            style={{ left: `${marker.position}%` }}
                        />
                    ))}

                    {/* 30-minute markers */}
                    {halfHourMarkers.map((marker, i) => (
                        <div
                            key={i}
                            className="absolute top-0 bottom-0 w-px bg-white/5"
                            style={{ left: `${marker.position}%` }}
                        />
                    ))}

                    {/* Hover indicator */}
                    {hoverMinutes !== null && !isDragging && (
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-accent-blue/50 pointer-events-none transition-all duration-75"
                            style={{ left: `${getPosition(hoverMinutes)}%` }}
                        />
                    )}

                    {/* Current time indicator */}
                    {isToday && currentMinutes >= workStart && currentMinutes <= workEnd && (
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-20"
                            style={{ left: `${getPosition(currentMinutes)}%` }}
                        >
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-yellow-400">
                                <div className="absolute inset-0 rounded-full bg-yellow-400 animate-ping opacity-75" style={{ animation: 'ripple 2s infinite' }}></div>
                            </div>
                            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-yellow-400 font-bold whitespace-nowrap bg-gray-900/80 px-1.5 py-0.5 rounded">
                                Now
                            </div>
                        </div>
                    )}

                    {/* Selection */}
                    {selectedStart !== null && selectedEnd !== null && (
                        <div
                            className={`absolute top-1 bottom-1 cursor-move z-10 transition-all duration-150 rounded-xl
                                ${isCurrentSelectionValid
                                    ? 'bg-gradient-to-r from-accent-blue/40 via-accent-blue/30 to-accent-blue/40 border-2 border-accent-blue shadow-lg shadow-accent-blue/20'
                                    : 'bg-gradient-to-r from-amber-500/40 via-amber-400/30 to-amber-500/40 border-2 border-amber-500 shadow-lg shadow-amber-500/20'
                                }
                                ${isDragging ? 'pulse-glow' : ''}`}
                            style={{
                                left: `${getPosition(selectedStart)}%`,
                                width: `${getPosition(selectedEnd) - getPosition(selectedStart)}%`,
                                backdropFilter: 'blur(4px)',
                            }}
                            onMouseDown={handleMouseDown('move')}
                            onTouchStart={handleTouchStart('move')}
                        >
                            {/* Glassmorphism overlay */}
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

                            {/* Time display inside selection */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className={`text-xs font-bold drop-shadow-lg ${isCurrentSelectionValid ? 'text-white' : 'text-amber-100'}`}>
                                    {formatTime12(selectedStart)} - {formatTime12(selectedEnd)}
                                </span>
                            </div>

                            {/* Start handle */}
                            <div
                                className={`absolute top-1/2 -translate-y-1/2 -left-4 w-8 h-16 rounded-lg cursor-ew-resize 
                                    transition-all duration-200 flex items-center justify-center border border-white/20
                                    ${hoverHandle === 'start' ? 'scale-110' : 'scale-100'}
                                    ${isDragging === 'start' ? 'shimmer-effect scale-110' : isCurrentSelectionValid
                                        ? 'bg-gradient-to-b from-accent-blue to-blue-600 hover:from-blue-400 hover:to-accent-blue shadow-lg shadow-accent-blue/40'
                                        : 'bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/40'
                                    }`}
                                onMouseDown={handleMouseDown('start')}
                                onTouchStart={handleTouchStart('start')}
                                onMouseEnter={() => setHoverHandle('start')}
                                onMouseLeave={() => setHoverHandle(null)}
                            >
                                <GripVertical className="w-4 h-4 text-white/90" />
                            </div>

                            {/* End handle */}
                            <div
                                className={`absolute top-1/2 -translate-y-1/2 -right-4 w-8 h-16 rounded-lg cursor-ew-resize 
                                    transition-all duration-200 flex items-center justify-center border border-white/20
                                    ${hoverHandle === 'end' ? 'scale-110' : 'scale-100'}
                                    ${isDragging === 'end' ? 'shimmer-effect scale-110' : isCurrentSelectionValid
                                        ? 'bg-gradient-to-b from-accent-blue to-blue-600 hover:from-blue-400 hover:to-accent-blue shadow-lg shadow-accent-blue/40'
                                        : 'bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/40'
                                    }`}
                                onMouseDown={handleMouseDown('end')}
                                onTouchStart={handleTouchStart('end')}
                                onMouseEnter={() => setHoverHandle('end')}
                                onMouseLeave={() => setHoverHandle(null)}
                            >
                                <GripVertical className="w-4 h-4 text-white/90" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Tick marks below timeline */}
                <div className="relative h-2 mt-1">
                    {hourMarkers.map((marker, i) => (
                        <div
                            key={i}
                            className="absolute top-0 w-px h-2 bg-white/20"
                            style={{ left: `${marker.position}%` }}
                        />
                    ))}
                    {halfHourMarkers.map((marker, i) => (
                        <div
                            key={`half-${i}`}
                            className="absolute top-0 w-px h-1 bg-white/10"
                            style={{ left: `${marker.position}%` }}
                        />
                    ))}
                </div>
            </div>

            {/* Selection info card */}
            {selectedStart !== null && selectedEnd !== null ? (
                <div className={`rounded-2xl p-5 backdrop-blur-sm border transition-all duration-300
                    ${isCurrentSelectionValid
                        ? 'bg-gradient-to-r from-accent-blue/10 via-accent-blue/5 to-transparent border-accent-blue/30'
                        : 'bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border-amber-500/30'
                    }`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isCurrentSelectionValid ? 'bg-accent-blue/20' : 'bg-amber-500/20'}`}>
                                {isCurrentSelectionValid ? (
                                    <CheckCircle2 className="w-6 h-6 text-accent-blue" />
                                ) : (
                                    <AlertCircle className="w-6 h-6 text-amber-500" />
                                )}
                            </div>
                            <div>
                                <p className="text-sm text-text-muted">{isCurrentSelectionValid ? 'Selected Time' : 'Adjusting Selection...'}</p>
                                <p className="text-xl font-bold text-text-main">
                                    {formatTime12(selectedStart)} – {formatTime12(selectedEnd)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-center">
                                <p className="text-xs text-text-muted uppercase tracking-wider">Duration</p>
                                <p className={`text-2xl font-bold ${isCurrentSelectionValid ? 'text-accent-blue' : 'text-amber-500'}`}>
                                    {selectedDuration >= 60
                                        ? `${Math.floor(selectedDuration / 60)}h ${selectedDuration % 60 > 0 ? `${selectedDuration % 60}m` : ''}`
                                        : `${selectedDuration}m`
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                    {!isCurrentSelectionValid && (
                        <div className="mt-3 pt-3 border-t border-amber-500/20">
                            <p className="text-xs text-amber-400">⚠️ Release to snap to nearest valid time slot</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                        <p className="text-sm text-amber-200">
                            Click on the timeline to select a time slot, or there may be no available slots for this date.
                        </p>
                    </div>
                </div>
            )}

            {/* Booking rules */}
            <div className="bg-white/5 rounded-xl p-4 space-y-2 backdrop-blur-sm">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Booking Rules</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-text-muted">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-blue"></div>
                        <span>Min duration: <span className="text-text-main font-medium">{POLICIES.MIN_BOOKING_DURATION_MINUTES} minutes</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-blue"></div>
                        <span>Max duration: <span className="text-text-main font-medium">{POLICIES.MAX_BOOKING_DURATION_MINUTES / 60} hours</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-blue"></div>
                        <span>Available: <span className="text-text-main font-medium">{formatTime12(workStart)} – {formatTime12(workEnd)}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-blue"></div>
                        <span>Drag handles to adjust time</span>
                    </div>
                </div>
                {isGroupBooking && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="flex items-center gap-2 text-amber-400">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm">Group bookings require 1 hour advance notice</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
