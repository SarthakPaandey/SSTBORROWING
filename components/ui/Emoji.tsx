'use client';

import { useState, memo } from 'react';
import Image from 'next/image';

// CDN base URL for Fluent Emoji 3D
const FLUENT_EMOJI_CDN = 'https://raw.githubusercontent.com/nicerlab/fluent-3d-emoji/main/emoji';

// Mapping of Unicode emojis to Fluent Emoji 3D filenames
// These are the premium 3D versions from Microsoft
const EMOJI_MAP: Record<string, string> = {
    // Sports & Activities
    '⚽': 'Soccer Ball.png',
    '🏀': 'Basketball.png',
    '🏈': 'American Football.png',
    '⚾': 'Baseball.png',
    '🎾': 'Tennis.png',
    '🏐': 'Volleyball.png',
    '🏉': 'Rugby Football.png',
    '🎱': 'Pool 8 Ball.png',
    '🏓': 'Ping Pong.png',
    '🏸': 'Badminton.png',
    '🏒': 'Ice Hockey.png',
    '🏑': 'Field Hockey.png',
    '🥊': 'Boxing Glove.png',
    '🏏': 'Cricket Game.png',
    '⛳': 'Flag in Hole.png',
    '🎯': 'Bullseye.png',
    '🎳': 'Bowling.png',

    // Technology & Equipment
    '💻': 'Laptop.png',
    '🖥️': 'Desktop Computer.png',
    '🖨️': 'Printer.png',
    '⌨️': 'Keyboard.png',
    '🖱️': 'Computer Mouse.png',
    '📱': 'Mobile Phone.png',
    '📲': 'Mobile Phone with Arrow.png',
    '🎮': 'Video Game.png',
    '🕹️': 'Joystick.png',
    '🎧': 'Headphone.png',
    '🎤': 'Microphone.png',
    '📷': 'Camera.png',
    '📹': 'Video Camera.png',
    '📺': 'Television.png',
    '🔌': 'Electric Plug.png',
    '💡': 'Light Bulb.png',
    '🔋': 'Battery.png',

    // Library & Education
    '📚': 'Books.png',
    '📖': 'Open Book.png',
    '📕': 'Closed Book.png',
    '📗': 'Green Book.png',
    '📘': 'Blue Book.png',
    '📙': 'Orange Book.png',
    '📓': 'Notebook.png',
    '📔': 'Notebook with Decorative Cover.png',
    '📒': 'Ledger.png',
    '📝': 'Memo.png',
    '✏️': 'Pencil.png',
    '🖊️': 'Pen.png',
    '📎': 'Paperclip.png',
    '📐': 'Triangular Ruler.png',
    '📏': 'Straight Ruler.png',
    '🎓': 'Graduation Cap.png',

    // Facilities & Places
    '🏟️': 'Stadium.png',
    '🏢': 'Office Building.png',
    '🏫': 'School.png',
    '🏛️': 'Classical Building.png',
    '🚪': 'Door.png',
    '🪟': 'Window.png',
    '🛗': 'Elevator.png',

    // Status & Actions
    '✅': 'Check Mark Button.png',
    '❌': 'Cross Mark.png',
    '⚠️': 'Warning.png',
    '❓': 'Red Question Mark.png',
    '❗': 'Red Exclamation Mark.png',
    '✨': 'Sparkles.png',
    '⭐': 'Star.png',
    '🌟': 'Glowing Star.png',
    '💫': 'Dizzy.png',
    '🔥': 'Fire.png',
    '💯': 'Hundred Points.png',
    '🎉': 'Party Popper.png',
    '🎊': 'Confetti Ball.png',
    '🏆': 'Trophy.png',
    '🥇': '1st Place Medal.png',
    '🥈': '2nd Place Medal.png',
    '🥉': '3rd Place Medal.png',
    '🎖️': 'Military Medal.png',
    '🏅': 'Sports Medal.png',

    // Time & Calendar
    '📅': 'Calendar.png',
    '📆': 'Tear-Off Calendar.png',
    '🗓️': 'Spiral Calendar.png',
    '⏰': 'Alarm Clock.png',
    '⏱️': 'Stopwatch.png',
    '⏲️': 'Timer Clock.png',
    '🕐': 'One O Clock.png',

    // Weather & Nature
    '☀️': 'Sun.png',
    '🌙': 'Crescent Moon.png',
    '🌅': 'Sunrise.png',
    '🌆': 'Cityscape at Dusk.png',
    '🌇': 'Sunset.png',
    '❄️': 'Snowflake.png',
    '🌸': 'Cherry Blossom.png',
    '🌷': 'Tulip.png',
    '🌺': 'Hibiscus.png',
    '🌻': 'Sunflower.png',
    '🍂': 'Fallen Leaf.png',
    '🍁': 'Maple Leaf.png',
    '🌴': 'Palm Tree.png',
    '🎃': 'Jack-O-Lantern.png',
    '🎄': 'Christmas Tree.png',
    '💝': 'Heart with Ribbon.png',

    // Faces & Emotions
    '😀': 'Grinning Face.png',
    '😃': 'Grinning Face with Big Eyes.png',
    '😄': 'Grinning Face with Smiling Eyes.png',
    '😁': 'Beaming Face with Smiling Eyes.png',
    '😊': 'Smiling Face with Smiling Eyes.png',
    '🤔': 'Thinking Face.png',
    '😎': 'Smiling Face with Sunglasses.png',
    '🤩': 'Star-Struck.png',
    '😍': 'Smiling Face with Heart-Eyes.png',
    '🥳': 'Partying Face.png',
    '😇': 'Smiling Face with Halo.png',

    // People & Gestures
    '👋': 'Waving Hand.png',
    '👍': 'Thumbs Up.png',
    '👎': 'Thumbs Down.png',
    '👏': 'Clapping Hands.png',
    '🙌': 'Raising Hands.png',
    '🤝': 'Handshake.png',
    '✋': 'Raised Hand.png',
    '👆': 'Backhand Index Pointing Up.png',
    '👥': 'Busts in Silhouette.png',
    '👤': 'Bust in Silhouette.png',
    '🧑‍🎓': 'Student.png',

    // Security & Keys
    '🔒': 'Locked.png',
    '🔓': 'Unlocked.png',
    '🔑': 'Key.png',
    '🛡️': 'Shield.png',
    '🚫': 'Prohibited.png',
    '🚷': 'No Pedestrians.png',

    // Communication
    '📧': 'E-Mail.png',
    '📩': 'Envelope with Arrow.png',
    '📨': 'Incoming Envelope.png',
    '📢': 'Loudspeaker.png',
    '📣': 'Megaphone.png',
    '🔔': 'Bell.png',
    '🔕': 'Bell with Slash.png',

    // Misc
    '🎁': 'Wrapped Gift.png',
    '🗑️': 'Wastebasket.png',
    '➕': 'Plus.png',
    '⚙️': 'Gear.png',
    '🔧': 'Wrench.png',
    '⚡': 'High Voltage.png',
    '💰': 'Money Bag.png',
    '📌': 'Pushpin.png',
    '📍': 'Round Pushpin.png',
    '⏳': 'Hourglass Not Done.png',
    '⌛': 'Hourglass Done.png',
    '🔄': 'Counterclockwise Arrows Button.png',
    '❎': 'Cross Mark Button.png',
};

// Size configurations
const SIZES = {
    xs: { width: 16, height: 16, className: 'w-4 h-4' },
    sm: { width: 20, height: 20, className: 'w-5 h-5' },
    md: { width: 24, height: 24, className: 'w-6 h-6' },
    lg: { width: 32, height: 32, className: 'w-8 h-8' },
    xl: { width: 48, height: 48, className: 'w-12 h-12' },
    '2xl': { width: 64, height: 64, className: 'w-16 h-16' },
    '3xl': { width: 96, height: 96, className: 'w-24 h-24' },
} as const;

type EmojiSize = keyof typeof SIZES;

interface FluentEmojiProps {
    /** The emoji character to display */
    emoji: string;
    /** Size of the emoji */
    size?: EmojiSize;
    /** Additional CSS classes */
    className?: string;
    /** Alt text for accessibility */
    alt?: string;
}

/**
 * FluentEmoji - Renders Microsoft Fluent 3D Emojis
 * Provides consistent, premium 3D emoji rendering across all platforms
 */
const FluentEmoji = memo(function FluentEmoji({
    emoji,
    size = 'md',
    className = '',
    alt,
}: FluentEmojiProps) {
    const [hasError, setHasError] = useState(false);
    const fileName = EMOJI_MAP[emoji];
    const sizeConfig = SIZES[size];

    // If emoji not in map or failed to load, fallback to native
    if (!fileName || hasError) {
        return (
            <span
                className={`inline-flex items-center justify-center ${sizeConfig.className} ${className}`}
                style={{
                    fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
                    fontSize: `${sizeConfig.width * 0.8}px`,
                    lineHeight: 1,
                }}
                role="img"
                aria-label={alt || emoji}
            >
                {emoji}
            </span>
        );
    }

    const imageUrl = `${FLUENT_EMOJI_CDN}/${encodeURIComponent(fileName)}`;

    return (
        <Image
            src={imageUrl}
            alt={alt || emoji}
            width={sizeConfig.width}
            height={sizeConfig.height}
            className={`inline-block object-contain ${sizeConfig.className} ${className}`}
            onError={() => setHasError(true)}
            unoptimized // CDN images don't need Next.js optimization
            loading="lazy"
        />
    );
});

export default FluentEmoji;

// Named export for convenience
export { FluentEmoji };

// Simple wrapper for inline emoji usage (lighter weight)
export function Emoji({
    symbol,
    size = 'md',
    className = ''
}: {
    symbol: string;
    size?: EmojiSize;
    className?: string;
}) {
    return <FluentEmoji emoji={symbol} size={size} className={className} />;
}
