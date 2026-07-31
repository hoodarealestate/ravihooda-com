// email.ts — re-exports from brevo.ts for backward compatibility
// All sending goes through Brevo (300/day free, 9,000/month)
export { sendEmail, sendBatch } from './brevo'
