/**
 * Validate required environment variables at startup
 * FIX EC-74: Early validation prevents cryptic runtime errors
 */

const REQUIRED_ENV_VARS = [
    'MONGODB_URI',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
] as const;

const OPTIONAL_ENV_VARS = [
    'QR_HMAC_SECRET',
    'CRON_SECRET',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM_EMAIL',
] as const;

export function validateEnv() {
    const missing: string[] = [];
    const warnings: string[] = [];

    // Check required variables
    for (const varName of REQUIRED_ENV_VARS) {
        if (!process.env[varName]) {
            missing.push(varName);
        }
    }

    // Check optional but recommended variables
    for (const varName of OPTIONAL_ENV_VARS) {
        if (!process.env[varName]) {
            warnings.push(varName);
        }
    }

    // Fail fast if required vars are missing
    if (missing.length > 0) {
        console.error('❌ FATAL: Missing required environment variables:');
        missing.forEach(varName => console.error(`   - ${varName}`));
        console.error('\nPlease set these in your .env file and restart the application.');
        process.exit(1);
    }

    // Warn about optional vars
    if (warnings.length > 0) {
        console.warn('⚠️  Optional environment variables not set:');
        warnings.forEach(varName => console.warn(`   - ${varName}`));
        console.warn('\nSome features may not work without these variables.\n');
    }

    console.log('✅ Environment variables validated successfully\n');
}
