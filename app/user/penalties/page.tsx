import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/config';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { Booking, BookingStatus } from '@/models/Booking';
import { Penalty } from '@/models/Penalty';
import { POLICIES, canUserBook } from '@/lib/policies';
import { getNow, getStartOfDay } from '@/lib/timezone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, StatCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatDate, formatDateTime } from '@/lib/utils';
import { AlertTriangle, Ban, BookOpen, CheckCircle2, Clock, Info, Shield } from 'lucide-react';

function formatUserPoints(value: number): string {
  const userPoints = value / 4;
  const formatted = Number.isInteger(userPoints)
    ? userPoints.toFixed(0)
    : userPoints.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted} ${userPoints === 1 ? 'pt' : 'pts'}`;
}

function buildBookingLimit(label: string, value: string, helper?: string) {
  return { label, value, helper };
}

export default async function PenaltyGuidePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }

  await connectDB();

  const user = await User.findById(session.user.id).lean();
  if (!user) {
    redirect('/login');
  }

  const now = getNow();
  const isSuspended = user.suspendedUntil && new Date(user.suspendedUntil) > now;
  const isBlocked = user.blocked;
  const suspensionLevel = user.suspensionLevel ?? 0;
  const levelLabel =
    ['Level 0 • Fresh', 'Level 1 • Probation', 'Level 2 • Final warning'][suspensionLevel] ||
    'Current level';
  const thresholds = [
    POLICIES.PENALTY_THRESHOLD_LEVEL_0,
    POLICIES.PENALTY_THRESHOLD_LEVEL_1,
    POLICIES.PENALTY_THRESHOLD_LEVEL_2,
  ];
  const suspensions = [POLICIES.SUSPENSION_DURATION_LEVEL_0, POLICIES.SUSPENSION_DURATION_LEVEL_1];
  const currentThreshold = thresholds[suspensionLevel] ?? POLICIES.PENALTY_THRESHOLD_LEVEL_0;
  const nextOutcome =
    suspensionLevel >= 2
      ? 'Permanent block'
      : `${suspensions[suspensionLevel] ?? POLICIES.SUSPENSION_DURATION_LEVEL_0} day suspension`;

  const bookingStatuses: BookingStatus[] = ['PENDING', 'CONFIRMED', 'CHECKED_IN'];

  const [facilityActive, roomActive, equipmentActive, libraryActive] = await Promise.all([
    Booking.countDocuments({ userId: user._id, kind: 'FACILITY', status: { $in: bookingStatuses } }),
    Booking.countDocuments({ userId: user._id, kind: 'ROOM', status: { $in: bookingStatuses } }),
    Booking.countDocuments({ userId: user._id, kind: 'EQUIPMENT', status: { $in: bookingStatuses } }),
    Booking.countDocuments({ userId: user._id, kind: 'LIBRARY', status: { $in: bookingStatuses } }),
  ]);

  const activeTotal = facilityActive + roomActive + equipmentActive + libraryActive;

  const nowIST = getNow();
  const monthStart = getStartOfDay(new Date(nowIST.getFullYear(), nowIST.getMonth(), 1));
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  const monthlyBookings = await Booking.find({
    userId: user._id,
    start: { $gte: monthStart, $lt: monthEnd },
    status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED'] },
  })
    .select('kind start end')
    .lean();

  let facilityHoursUsed = 0;
  let roomHoursUsed = 0;
  let equipmentBorrows = 0;

  monthlyBookings.forEach((booking) => {
    const hours =
      (new Date(booking.end).getTime() - new Date(booking.start).getTime()) / (1000 * 60 * 60);

    if (booking.kind === 'FACILITY') {
      facilityHoursUsed += hours;
    }
    if (booking.kind === 'ROOM') {
      roomHoursUsed += hours;
    }
    if (booking.kind === 'EQUIPMENT') {
      equipmentBorrows += 1;
    }
  });

  const recentPenalties = await Penalty.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  const activePenaltyCount = await Penalty.countDocuments({
    userId: user._id,
    waivedBy: null,
    served: false,
  });

  const bookingLimits = [
    buildBookingLimit(
      'Total active bookings',
      `${activeTotal}/${POLICIES.MAX_TOTAL_ACTIVE_BOOKINGS}`,
      'Across all resource types'
    ),
    buildBookingLimit(
      'Facilities',
      `${facilityActive}/${POLICIES.MAX_ACTIVE_FACILITIES}`,
      'Active facility bookings at once'
    ),
    buildBookingLimit(
      'Rooms',
      `${roomActive}/${POLICIES.MAX_ACTIVE_ROOMS}`,
      'Active room bookings at once'
    ),
    buildBookingLimit(
      'Equipment items',
      `${equipmentActive}/${POLICIES.MAX_ACTIVE_EQUIPMENT_ITEMS}`,
      'Active borrowed items at once'
    ),
    buildBookingLimit(
      'Monthly facility hours',
      `${facilityHoursUsed.toFixed(1)}/${POLICIES.MAX_FACILITY_HOURS_PER_MONTH} hrs`,
      'Confirmed/Pending/Completed this month'
    ),
    buildBookingLimit(
      'Monthly room hours',
      `${roomHoursUsed.toFixed(1)}/${POLICIES.MAX_ROOM_HOURS_PER_MONTH} hrs`
    ),
    buildBookingLimit(
      'Monthly equipment borrows',
      `${equipmentBorrows}/${POLICIES.MAX_EQUIPMENT_BORROWS_PER_MONTH}`
    ),
    buildBookingLimit(
      'Library',
      `${POLICIES.MAX_BOOKS_PER_STUDENT} book at a time`,
      'Must pick up within 24 hours'
    ),
    buildBookingLimit(
      'Advance window',
      `${POLICIES.ADVANCE_BOOKING_DAYS} days`,
      'How far ahead you can book'
    ),
  ];

  const penaltyRules = [
    { label: 'No-show (facility/room/equipment)', points: POLICIES.PENALTY_NO_SHOW },
    { label: 'Late return', points: POLICIES.PENALTY_LATE_RETURN },
    { label: 'Damage or lost item', points: POLICIES.PENALTY_DAMAGE },
    { label: 'Late cancellation', points: POLICIES.PENALTY_CANCELLATION },
    { label: 'Library: late return', points: POLICIES.PENALTY_BOOK_LATE_RETURN },
    { label: 'Library: no pickup', points: POLICIES.PENALTY_BOOK_NO_PICKUP },
    { label: 'Reschedule fee', points: POLICIES.RESCHEDULE_PENALTY_POINTS },
  ];

  const escalationSteps = [
    {
      level: 'Level 0',
      threshold: POLICIES.PENALTY_THRESHOLD_LEVEL_0,
      action: `${POLICIES.SUSPENSION_DURATION_LEVEL_0} day suspension & points reset`,
    },
    {
      level: 'Level 1',
      threshold: POLICIES.PENALTY_THRESHOLD_LEVEL_1,
      action: `${POLICIES.SUSPENSION_DURATION_LEVEL_1} day suspension & points reset`,
    },
    {
      level: 'Level 2',
      threshold: POLICIES.PENALTY_THRESHOLD_LEVEL_2,
      action: 'Permanent block',
    },
  ];

  const canBookState = canUserBook({
    penaltyPoints: user.penaltyPoints,
    suspendedUntil: user.suspendedUntil,
  });

  const faqItems = [
    {
      q: 'How many bookings can I hold at once?',
      a: 'Up to 3 total active bookings across all types, with sub-limits of 2 facilities, 1 room, and 5 equipment items.',
    },
    {
      q: 'When do penalties apply?',
      a: 'Common cases: no-show, late return, damage/loss, late cancellation, missing a library pickup, or rescheduling fees.',
    },
    {
      q: 'What happens when I hit a threshold?',
      a: 'You move to the next suspension level. Level 0 → 7-day suspension, Level 1 → 10-day suspension, Level 2 → permanent block. After a suspension, active penalty points reset to 0.',
    },
    {
      q: 'How do I avoid getting blocked?',
      a: 'Check in on time, return items promptly, cancel early, and track your points. The page shows your current level and next outcome.',
    },
    {
      q: 'Who can help if I am blocked or suspended?',
      a: 'Reach out to support@sst.scaler.com with your email and a short note. Admins can review and advise next steps.',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card/70 px-3 py-1 text-xs text-text-muted">
          <Shield className="h-4 w-4 text-accent-blue" />
          Live view of your limits, penalties, and blocks
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-main">Rules, limits & penalties</h1>
            <p className="text-text-muted">
              See what you can do, how many bookings you can hold, and how penalties & blocks work.
              Points show both system units and easy-to-read values (4 system pts = 1 point).
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isBlocked ? (
              <Badge variant="destructive" glow icon="⛔">
                Permanently blocked
              </Badge>
            ) : isSuspended ? (
              <Badge variant="warning" glow icon="⚠️">
                Suspended until {formatDate(user.suspendedUntil!)}
              </Badge>
            ) : (
              <Badge variant="success" glow icon="✅">
                Booking access active
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          emoji="⚖️"
          label="Active penalty points"
          value={`${user.penaltyPoints} (${formatUserPoints(user.penaltyPoints)})`}
          trend="neutral"
          trendValue={`Next action at ${currentThreshold} (${formatUserPoints(currentThreshold)})`}
        />
        <StatCard
          emoji="🛡️"
          label="Escalation level"
          value={levelLabel}
          trend="neutral"
          trendValue={nextOutcome}
        />
        <StatCard
          emoji={canBookState.allowed ? '🟢' : '🔴'}
          label="Booking status"
          value={canBookState.allowed ? 'Allowed' : 'Not allowed'}
          trend="neutral"
          trendValue={canBookState.reason || 'Within limits'}
        />
      </div>

      <Card variant="glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-accent-blue" />
            Your current status
          </CardTitle>
          <CardDescription>
            Personalized snapshot of your penalties, suspensions, and block state.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <p className="text-sm text-text-muted">
                Active penalty points: <span className="font-semibold text-text-main">{user.penaltyPoints}</span>{' '}
                (<span className="text-text-main">{formatUserPoints(user.penaltyPoints)}</span>)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent-blue" />
              <p className="text-sm text-text-muted">
                Current level: <span className="font-semibold text-text-main">{levelLabel}</span>. Next outcome:{' '}
                <span className="font-semibold text-text-main">{nextOutcome}</span> at{' '}
                <span className="font-semibold text-text-main">
                  {currentThreshold} ({formatUserPoints(currentThreshold)})
                </span>
                .
              </p>
            </div>
            {isSuspended && (
              <div className="flex items-center gap-2">
                <Ban className="h-4 w-4 text-destructive" />
                <p className="text-sm text-text-muted">
                  Suspended until <span className="font-semibold text-text-main">{formatDate(user.suspendedUntil!)}</span>. You
                  cannot book until this ends.
                </p>
              </div>
            )}
            {isBlocked && (
              <div className="flex items-center gap-2">
                <Ban className="h-4 w-4 text-destructive" />
                <p className="text-sm text-text-muted">
                  Account is permanently blocked. Contact support@sst.scaler.com if you believe this is an error.
                </p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <p className="text-sm text-text-muted">
                Active penalties: <span className="font-semibold text-text-main">{activePenaltyCount}</span>. Last updates are listed
                below.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-card-border bg-card/70 p-4 space-y-3">
            <p className="text-sm font-semibold text-text-main">What you&apos;re currently allowed to do</p>
            <ul className="space-y-2 text-sm text-text-muted">
              <li>• Hold up to 3 active bookings in total (within per-type limits).</li>
              <li>• Book up to {POLICIES.ADVANCE_BOOKING_DAYS} days in advance.</li>
              <li>• Reschedule once per booking; each reschedule costs {formatUserPoints(POLICIES.RESCHEDULE_PENALTY_POINTS)}.</li>
              <li>• Borrow up to {POLICIES.MAX_BOOKS_PER_STUDENT} library book at a time.</li>
              <li>• Keep facility usage under {POLICIES.MAX_FACILITY_HOURS_PER_MONTH} hrs/month and rooms under {POLICIES.MAX_ROOM_HOURS_PER_MONTH} hrs/month.</li>
            </ul>
            <div className="rounded-lg border border-accent-blue/30 bg-accent-blue/10 p-3 text-xs text-accent-blue">
              Tip: Points use system units. 4 system pts = 1 regular point. We show both so you always know where you stand.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card variant="glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-accent-blue" />
            Booking limits & allowances
          </CardTitle>
          <CardDescription>
            Live counts where available. Limits come from current policy settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bookingLimits.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-card-border bg-card/70 p-4 hover:border-accent-blue/40 transition-colors"
            >
              <p className="text-sm text-text-muted">{item.label}</p>
              <p className="text-xl font-semibold text-text-main">{item.value}</p>
              {item.helper && <p className="text-xs text-text-muted mt-1">{item.helper}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card variant="glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Penalty rules & escalation
          </CardTitle>
          <CardDescription>Know what triggers points and what happens at each level.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-text-main">Common penalty actions</p>
            <div className="space-y-2">
              {penaltyRules.map((rule) => (
                <div
                  key={rule.label}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-card-border bg-card/70 px-3 py-2"
                >
                  <p className="text-sm text-text-main">{rule.label}</p>
                  <Badge variant="secondary" icon="⚡">
                    {rule.points} ({formatUserPoints(rule.points)})
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-text-main">Escalation steps</p>
            <div className="space-y-2">
              {escalationSteps.map((step) => (
                <div
                  key={step.level}
                  className="rounded-lg border border-card-border bg-card/70 p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="info" icon="📈">
                        {step.level}
                      </Badge>
                      <span className="text-sm text-text-muted">
                        Threshold: {step.threshold} ({formatUserPoints(step.threshold)})
                      </span>
                    </div>
                    <span className="text-xs text-text-muted">{step.action}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
              All active penalties are served/reset when a suspension starts. Permanent block happens at Level 2 threshold.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card variant="glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-accent-blue" />
            Recent penalties & actions
          </CardTitle>
          <CardDescription>Your latest penalty events (most recent first).</CardDescription>
        </CardHeader>
        <CardContent>
          {recentPenalties.length === 0 ? (
            <p className="text-text-muted text-sm">No penalties on record. Keep it up! 🎉</p>
          ) : (
            <div className="space-y-3">
              {recentPenalties.map((penalty) => {
                const isWaived = Boolean(penalty.waivedBy);
                const isServed = penalty.served;
                return (
                  <div
                    key={penalty._id.toString()}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-card-border bg-card/70 p-4"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-text-main">{penalty.reason}</p>
                      <p className="text-xs text-text-muted">
                        {formatDateTime(penalty.createdAt)} • {penalty.points} ({formatUserPoints(penalty.points)})
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isWaived ? (
                        <Badge variant="success" icon="✅">
                          Waived
                        </Badge>
                      ) : isServed ? (
                        <Badge variant="secondary" icon="⏱️">
                          Served
                        </Badge>
                      ) : (
                        <Badge variant="warning" icon="⚠️">
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card variant="glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-accent-blue" />
            FAQs & tips
          </CardTitle>
          <CardDescription>Quick answers for common questions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {faqItems.map((item) => (
            <div
              key={item.q}
              className="rounded-lg border border-card-border bg-card/70 p-4 hover:border-accent-blue/30 transition-colors"
            >
              <p className="font-semibold text-text-main">{item.q}</p>
              <p className="text-sm text-text-muted mt-1">{item.a}</p>
            </div>
          ))}
          <div className="rounded-lg border border-accent-blue/30 bg-accent-blue/10 p-3 text-xs text-accent-blue">
            Need help? Email <a className="underline" href="mailto:support@sst.scaler.com">support@sst.scaler.com</a>.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

